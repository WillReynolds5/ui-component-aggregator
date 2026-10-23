import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import {
  DATABASE_NAME,
  INGEST_SECRET_PARAMETER,
  LAMBDA_ADAPTER_ARM64_LAYER,
  domainConfig,
} from "./config";

/**
 * Real-deploy stack (us-east-2).
 *
 * Compute: Node 22 arm64 zip + Lambda Web Adapter layer (no Docker/ECR).
 * Edge: CloudFront. ACM cert is imported (must already exist in us-east-1).
 * DNS: not created here — output the CloudFront domain and alias it from the Mac.
 * DB: Aurora PostgreSQL 16 Serverless v2, min 0 / max 1 ACU, Data API, no NAT.
 * Static: S3 origin for /_next/static/*, public files, and /previews/* screenshots.
 * Previews: a capture function screenshots new items, invoked by ingest and swept daily.
 */
export class ComponentLibraryStack extends cdk.Stack {
  get availabilityZones(): string[] {
    return ["us-east-2a", "us-east-2b"];
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domains = domainConfig(this);
    const assetRoots = ensureAssetRoots();
    const originVerify = `ov-${cdk.Names.uniqueId(this).replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)}`;

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC },
      ],
    });

    const dbSg = new ec2.SecurityGroup(this, "DbSg", {
      vpc,
      description: "Aurora; Data API only, no inbound Postgres",
      allowAllOutbound: true,
    });

    const cluster = new rds.DatabaseCluster(this, "CatalogDb", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.of("16.8", "16"),
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [dbSg],
      writer: rds.ClusterInstance.serverlessV2("writer", {
        publiclyAccessible: false,
        enablePerformanceInsights: false,
      }),
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: 1,
      defaultDatabaseName: DATABASE_NAME,
      storageEncrypted: true,
      enableDataApi: true,
      backup: { retention: cdk.Duration.days(1) },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const assets = new s3.Bucket(this, "Assets", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const appLogs = new logs.LogGroup(this, "AppLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const fn = new lambda.Function(this, "App", {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "run.sh",
      code: lambda.Code.fromAsset(assetRoots.lambdaDir),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          this,
          "WebAdapter",
          LAMBDA_ADAPTER_ARM64_LAYER,
        ),
      ],
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
        AWS_LWA_PORT: "8080",
        PORT: "8080",
        AWS_LWA_READINESS_CHECK_PATH: "/api/health",
        NODE_ENV: "production",
        EMBEDDING_PROVIDER: "stub",
        APP_DOMAIN: domains.domain,
        APP_URL: `https://${domains.domain}`,
        NEXT_PUBLIC_APP_NAME: "component-library",
        ORIGIN_VERIFY_SECRET: originVerify,
        AURORA_CLUSTER_ARN: cluster.clusterArn,
        AURORA_SECRET_ARN: cluster.secret?.secretArn ?? "",
        AURORA_DATABASE: DATABASE_NAME,
        INGEST_SECRET: process.env.INGEST_SECRET ?? (() => { throw new Error("Set INGEST_SECRET (aws ssm get-parameter --with-decryption)"); })(),
      },
      logGroup: appLogs,
    });

    cluster.grantDataApiAccess(fn);
    cluster.secret?.grantRead(fn);
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${INGEST_SECRET_PARAMETER}`,
        ],
      }),
    );

    // Preview screenshots. x86_64 because @sparticuz/chromium's npm build is x64-only; the
    // app stays arm64. Triggered by ingest (DB already awake) plus one daily sweep: a
    // frequent schedule would keep waking Aurora from 0 ACU, which costs more than the job.
    const root = path.join(__dirname, "../..");
    const captureLogs = new logs.LogGroup(this, "CaptureLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const capture = new nodejs.NodejsFunction(this, "CapturePreviews", {
      entry: path.join(root, "functions/capture-previews.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.X86_64,
      // Peaked at ~1.9 GB of 2 GB during the first backfill; more memory also means more CPU.
      memorySize: 3008,
      timeout: cdk.Duration.minutes(5),
      retryAttempts: 1,
      projectRoot: root,
      depsLockFilePath: path.join(root, "package-lock.json"),
      bundling: {
        tsconfig: path.join(root, "tsconfig.json"),
        target: "node22",
        minify: true,
        // @sparticuz/chromium is ESM-only, so the bundle must be ESM too (a CJS bundle dies on
        // require() at init). The banner gives bundled CJS dependencies a working require().
        format: nodejs.OutputFormat.ESM,
        mainFields: ["module", "main"],
        banner:
          "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
        // Chromium ships as brotli files beside its JS, so it can't be bundled; install it.
        nodeModules: ["@sparticuz/chromium", "playwright-core"],
      },
      environment: {
        AURORA_CLUSTER_ARN: cluster.clusterArn,
        AURORA_SECRET_ARN: cluster.secret?.secretArn ?? "",
        AURORA_DATABASE: DATABASE_NAME,
        PREVIEWS_BUCKET: assets.bucketName,
      },
      logGroup: captureLogs,
    });
    cluster.grantDataApiAccess(capture);
    cluster.secret?.grantRead(capture);
    assets.grantPut(capture, "previews/*");
    capture.grantInvoke(fn);
    fn.addEnvironment("CAPTURE_FUNCTION_NAME", capture.functionName);

    new events.Rule(this, "CaptureDailySweep", {
      description: "Retry preview screenshots that failed or were missed",
      schedule: events.Schedule.cron({ minute: "17", hour: "9" }),
      targets: [
        new targets.LambdaFunction(capture, {
          event: events.RuleTargetInput.fromObject({ limit: 25 }),
          retryAttempts: 0,
        }),
      ],
    });

    const functionUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });
    const functionHost = cdk.Fn.select(2, cdk.Fn.split("/", functionUrl.url));

    const certificate = domains.certificateArn
      ? acm.Certificate.fromCertificateArn(this, "Cert", domains.certificateArn)
      : undefined;

    const redirectFn = new cloudfront.Function(this, "WwwToApex", {
      comment: `301 ${domains.wwwDomain} → ${domains.domain}`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(wwwRedirectFunction(domains.domain)),
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(assets);
    const appOrigin = new origins.HttpOrigin(functionHost, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      customHeaders: { "X-Origin-Verify": originVerify },
    });

    const staticBehavior: cloudfront.BehaviorOptions = {
      origin: s3Origin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      compress: true,
    };

    // Live component renders (npm run components:extract) are third-party code. This header
    // keeps them in a sandbox with an opaque origin even when opened outside the iframe.
    const renderSandbox = new cloudfront.ResponseHeadersPolicy(this, "RenderSandbox", {
      comment: "Sandbox live component renders",
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy: "sandbox allow-scripts allow-pointer-lock allow-forms",
          override: true,
        },
        contentTypeOptions: { override: true },
      },
      // Renders run in an opaque origin, so their fetch()es and @font-faces of mirrored demo
      // assets are cross-origin. These are public static files.
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ["*"],
        accessControlAllowMethods: ["GET", "HEAD"],
        accessControlAllowOrigins: ["*"],
        originOverride: true,
      },
    });

    const distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: domains.domain,
      defaultBehavior: {
        origin: appOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        functionAssociations: [
          {
            function: redirectFn,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        "/_next/static/*": staticBehavior,
        // Screenshots from `npm run previews:capture`, content-hashed so they cache forever.
        "/previews/*": staticBehavior,
        "/renders/*": { ...staticBehavior, responseHeadersPolicy: renderSandbox },
        "/favicon.ico": staticBehavior,
        "*.svg": staticBehavior,
      },
      domainNames: certificate
        ? [domains.domain, domains.wwwDomain]
        : undefined,
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    new s3deploy.BucketDeployment(this, "StaticDeploy", {
      sources: [s3deploy.Source.asset(assetRoots.staticDir)],
      destinationBucket: assets,
      distribution,
      distributionPaths: ["/_next/static/*", "/*"],
      prune: false,
      memoryLimit: 512,
    });

    new cdk.CfnOutput(this, "DistributionDomain", {
      value: distribution.distributionDomainName,
      description:
        "Create Route 53 A/AAAA aliases to this CloudFront domain (do not create records in this stack).",
    });
    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
    });
    new cdk.CfnOutput(this, "CanonicalUrl", {
      value: `https://${domains.domain}`,
    });
    new cdk.CfnOutput(this, "WwwUrl", {
      value: `https://${domains.wwwDomain}`,
    });
    new cdk.CfnOutput(this, "HostedZoneId", {
      value: domains.hostedZoneId,
    });
    new cdk.CfnOutput(this, "FunctionUrl", { value: functionUrl.url });
    new cdk.CfnOutput(this, "FunctionName", { value: fn.functionName });
    new cdk.CfnOutput(this, "CaptureFunctionName", { value: capture.functionName });
    new cdk.CfnOutput(this, "AssetsBucket", {
      value: assets.bucketName,
      description: "Also PREVIEWS_BUCKET for npm run previews:capture.",
    });
    new cdk.CfnOutput(this, "ClusterArn", { value: cluster.clusterArn });
    new cdk.CfnOutput(this, "SecretArn", {
      value: cluster.secret?.secretArn ?? "",
    });
    new cdk.CfnOutput(this, "DatabaseName", { value: DATABASE_NAME });
    new cdk.CfnOutput(this, "DnsHint", {
      value: `UPSERT A/AAAA ${domains.domain} and ${domains.wwwDomain} in ${domains.hostedZoneId} → ${distribution.distributionDomainName} (CloudFront zone Z2FDTNDATAQYW2)`,
    });
  }
}

function ensureAssetRoots() {
  const root = path.join(__dirname, "../..");
  const lambdaDir = path.join(root, "dist/lambda");
  const staticDir = path.join(root, "dist/static");
  if (!fs.existsSync(path.join(lambdaDir, "run.sh"))) {
    execSync("node scripts/ensure-lambda-stub.mjs", {
      cwd: root,
      stdio: "inherit",
    });
  }
  return { lambdaDir, staticDir };
}

function wwwRedirectFunction(canonical: string): string {
  return `function handler(event) {
  var request = event.request;
  var host = ((request.headers.host || {}).value || '').toLowerCase();
  if (host === 'www.${canonical}') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: 'https://${canonical}' + request.uri + queryString(request.querystring) }
      }
    };
  }
  return request;
}

function queryString(querystring) {
  var parts = [];
  if (!querystring) return '';
  var keys = Object.keys(querystring);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var entry = querystring[key];
    var values = entry && entry.multiValue ? entry.multiValue : entry ? [entry] : [];
    for (var j = 0; j < values.length; j++) {
      var value = values[j] && values[j].value != null ? values[j].value : '';
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}
`;
}
