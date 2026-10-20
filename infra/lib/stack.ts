import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
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
 * Static: S3 origin for /_next/static/* and public files.
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
        version: rds.AuroraPostgresEngineVersion.VER_16_6,
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
        INGEST_SECRET: cdk.SecretValue.ssmSecure(INGEST_SECRET_PARAMETER).unsafeUnwrap(),
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
    new cdk.CfnOutput(this, "AssetsBucket", { value: assets.bucketName });
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
