#!/usr/bin/env bash
# Build the Next.js standalone zip payload on Apple Silicon or Linux (arm64/x64 JS).
# Produces:
#   dist/lambda   — Lambda Web Adapter handler (run.sh + standalone server)
#   dist/static   — public/ + _next/static for the CloudFront S3 origin
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_DOMAIN="${APP_DOMAIN:-ui-component-aggregator.com}"
export APP_DOMAIN
export APP_URL="${APP_URL:-https://${APP_DOMAIN}}"
export NEXT_TELEMETRY_DISABLED=1
export NODE_ENV=production

if [[ ! -d node_modules ]]; then
  npm ci
fi

echo "Building Next.js standalone for ${APP_DOMAIN}..."
npm run build

rm -rf dist/lambda dist/static
mkdir -p dist/lambda dist/static

if [[ ! -f .next/standalone/server.js ]]; then
  echo "Expected .next/standalone/server.js after next build" >&2
  exit 1
fi

# Standalone already traces server deps. Copy the tree as-is.
cp -R .next/standalone/. dist/lambda/
mkdir -p dist/lambda/.next
if [[ -d .next/static ]]; then
  cp -R .next/static dist/lambda/.next/static
fi
if [[ -d public ]]; then
  mkdir -p dist/lambda/public
  cp -R public/. dist/lambda/public/
  cp -R public/. dist/static/
  # Local screenshots point at local DB rows; production previews live in S3 under previews/.
  rm -rf dist/lambda/public/previews dist/static/previews
fi
if [[ -d .next/static ]]; then
  mkdir -p dist/static/_next
  cp -R .next/static dist/static/_next/static
fi

cat > dist/lambda/run.sh <<'EOF'
#!/bin/bash
set -euo pipefail
exec node server.js
EOF
chmod +x dist/lambda/run.sh

# Optional zip for `aws lambda update-function-code` without a full CDK redeploy.
if command -v zip >/dev/null 2>&1; then
  (cd dist/lambda && zip -qr ../function.zip .)
  echo "Wrote dist/function.zip ($(du -h dist/function.zip | awk '{print $1}'))"
fi

echo "Lambda payload: dist/lambda"
echo "Static assets:  dist/static"
