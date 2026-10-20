#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AWS_ACCOUNT, AWS_REGION } from "../lib/config";
import { ComponentLibraryStack } from "../lib/stack";

const app = new cdk.App();
const account =
  (app.node.tryGetContext("account") as string | undefined) ??
  process.env.CDK_DEFAULT_ACCOUNT ??
  AWS_ACCOUNT;
const region =
  (app.node.tryGetContext("region") as string | undefined) ?? AWS_REGION;

new ComponentLibraryStack(app, "ComponentLibraryStack", {
  env: { account, region },
  description:
    "component-library catalog: Lambda zip (arm64) + CloudFront + Aurora Serverless v2 Data API",
});
