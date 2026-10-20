# Deploy ui-component-aggregator.com

From your Mac. AWS CLI profile **`personal`**, account **`848989864994`**. CloudFormation is allowed only in **`us-east-2`**. The CloudFront ACM cert already exists in **`us-east-1`** and is DNS-validated — this stack imports it; it does not create the cert or Route 53 records.

```
arn:aws:acm:us-east-1:848989864994:certificate/2c5c65c0-a371-4371-9b67-417c5dff1216
```

Hosted zone **`Z0691530X4EHVLH71WJW`**. After deploy, alias apex + www to the CloudFront domain this stack outputs.

## One-time

```bash
export AWS_PROFILE=personal
export AWS_REGION=us-east-2
export APP_DOMAIN=ui-component-aggregator.com
export CERT_ARN=arn:aws:acm:us-east-1:848989864994:certificate/2c5c65c0-a371-4371-9b67-417c5dff1216

# 1. Ingest secret (SSM SecureString — CloudFormation cannot create these)
aws ssm put-parameter \
  --region us-east-2 \
  --name /component-library/INGEST_SECRET \
  --type SecureString \
  --value "$(openssl rand -base64 32)"

# 2. CDK bootstrap once per account/region (us-east-2 only)
cd infra
npm install
npx cdk bootstrap aws://848989864994/us-east-2
cd ..
```

## Every deploy

```bash
export AWS_PROFILE=personal
export AWS_REGION=us-east-2
export APP_DOMAIN=ui-component-aggregator.com
export CERT_ARN=arn:aws:acm:us-east-1:848989864994:certificate/2c5c65c0-a371-4371-9b67-417c5dff1216

npm ci
npm test
npm run lint
npm run typecheck
npm run lambda:build

cd infra
npm install
npx cdk deploy \
  --profile personal \
  -c domain=ui-component-aggregator.com \
  -c certificateArn="$CERT_ARN"
cd ..
```

Copy these outputs from the deploy: `DistributionDomain`, `ClusterArn`, `SecretArn`, `FunctionName`, `AssetsBucket`.

## After first deploy — DNS, migrate, seed

```bash
export AWS_PROFILE=personal
export AWS_REGION=us-east-2
export APP_DOMAIN=ui-component-aggregator.com
export HOSTED_ZONE_ID=Z0691530X4EHVLH71WJW

# 3. Alias ui-component-aggregator.com + www → CloudFront
./scripts/dns-alias.sh "$DISTRIBUTION_DOMAIN"

# 4. Schema + extensions (vector, pg_trgm) + seed via RDS Data API
export AURORA_CLUSTER_ARN="$CLUSTER_ARN"
export AURORA_SECRET_ARN="$SECRET_ARN"
export AURORA_DATABASE=component_library

npm run db:migrate:dataapi
npm run db:seed:dataapi
```

Pull ARNs from the stack if you do not have them in the shell:

```bash
aws cloudformation describe-stacks \
  --profile personal --region us-east-2 \
  --stack-name ComponentLibraryStack \
  --query "Stacks[0].Outputs" --output table
```

## Synth check (no AWS calls that create resources)

```bash
cd infra && npm install && npm run synth
```

Uses the existing us-east-1 cert ARN from `infra/cdk.json`.

## Notes

| Item | Value |
| --- | --- |
| Apex | `ui-component-aggregator.com` |
| Redirect | `www.ui-component-aggregator.com` → apex (CloudFront Function + `proxy.ts`) |
| Hosted zone | `Z0691530X4EHVLH71WJW` |
| Region | `us-east-2` (stack, Lambda, Aurora, SSM) |
| Cert | `arn:aws:acm:us-east-1:848989864994:certificate/2c5c65c0-a371-4371-9b67-417c5dff1216` |
| App | Node 22 **arm64** zip + Lambda Web Adapter layer. No Docker/ECR |
| Static | S3 behind CloudFront (`/_next/static/*`, `*.svg`, favicon) |
| Origin | CloudFront sends `X-Origin-Verify`; `proxy.ts` rejects direct Function URL hits |
| DB | Aurora PostgreSQL 16 Serverless v2, min 0 / max 1 ACU, Data API, no NAT |
| Ingest | SSM `/component-library/INGEST_SECRET` |
| Update Lambda only | `npm run lambda:build` then `aws lambda update-function-code --zip-file fileb://dist/function.zip` |
