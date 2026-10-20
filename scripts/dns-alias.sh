#!/usr/bin/env bash
# Upsert apex + www A/AAAA aliases to a CloudFront distribution.
# Usage: AWS_PROFILE=personal ./scripts/dns-alias.sh d111111abcdef8.cloudfront.net
set -euo pipefail

DIST_DOMAIN="${1:?CloudFront domain name required (e.g. d111111abcdef8.cloudfront.net)}"
PROFILE="${AWS_PROFILE:-personal}"
DOMAIN="${APP_DOMAIN:-ui-component-aggregator.com}"
WWW="www.${DOMAIN}"
ZONE_ID="${HOSTED_ZONE_ID:-Z0691530X4EHVLH71WJW}"
CF_ZONE="Z2FDTNDATAQYW2"
DIST_DOMAIN="${DIST_DOMAIN%.}"

tmp="$(mktemp)"
cat > "$tmp" <<EOF
{
  "Comment": "ui-component-aggregator.com CloudFront aliases",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN}",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "${CF_ZONE}",
          "DNSName": "${DIST_DOMAIN}",
          "EvaluateTargetHealth": false
        }
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN}",
        "Type": "AAAA",
        "AliasTarget": {
          "HostedZoneId": "${CF_ZONE}",
          "DNSName": "${DIST_DOMAIN}",
          "EvaluateTargetHealth": false
        }
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${WWW}",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "${CF_ZONE}",
          "DNSName": "${DIST_DOMAIN}",
          "EvaluateTargetHealth": false
        }
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${WWW}",
        "Type": "AAAA",
        "AliasTarget": {
          "HostedZoneId": "${CF_ZONE}",
          "DNSName": "${DIST_DOMAIN}",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
  --profile "$PROFILE" \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch "file://${tmp}"

rm -f "$tmp"
echo "Aliased ${DOMAIN} and ${WWW} → ${DIST_DOMAIN} (zone ${ZONE_ID})"
