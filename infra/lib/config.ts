export const AWS_ACCOUNT = "848989864994";
export const AWS_REGION = "us-east-2";
export const CLOUDFRONT_HOSTED_ZONE_ID = "Z2FDTNDATAQYW2";
export const HOSTED_ZONE_ID = "Z0691530X4EHVLH71WJW";
export const DEFAULT_DOMAIN = "ui-component-aggregator.com";
export const CERTIFICATE_ARN =
  "arn:aws:acm:us-east-1:848989864994:certificate/2c5c65c0-a371-4371-9b67-417c5dff1216";
export const DATABASE_NAME = "component_library";
export const INGEST_SECRET_PARAMETER = "/component-library/INGEST_SECRET";
export const LAMBDA_ADAPTER_ARM64_LAYER =
  "arn:aws:lambda:us-east-2:753240598075:layer:LambdaAdapterLayerArm64:30";

type ContextSource = {
  node: { tryGetContext: (key: string) => unknown };
};

export type AppDomainConfig = {
  domain: string;
  wwwDomain: string;
  certificateArn?: string;
  hostedZoneId: string;
};

function readString(scope: ContextSource, key: string): string | undefined {
  const value = scope.node.tryGetContext(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function domainConfig(scope: ContextSource): AppDomainConfig {
  const domain =
    readString(scope, "domain") ?? process.env.APP_DOMAIN ?? DEFAULT_DOMAIN;
  return {
    domain,
    wwwDomain: `www.${domain}`,
    certificateArn:
      readString(scope, "certificateArn") ??
      process.env.CERTIFICATE_ARN ??
      CERTIFICATE_ARN,
    hostedZoneId:
      readString(scope, "hostedZoneId") ??
      process.env.HOSTED_ZONE_ID ??
      HOSTED_ZONE_ID,
  };
}
