# Unused fallback. Production uses the arm64 zip + Lambda Web Adapter layer
# (npm run lambda:build). See DEPLOY.md.

FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 AS adapter
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG APP_DOMAIN=ui-component-aggregator.com
ENV APP_DOMAIN=$APP_DOMAIN
ENV APP_URL=https://$APP_DOMAIN
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV AWS_LWA_READINESS_CHECK_PATH=/api/health
ENV AWS_LWA_ASYNC_INIT=true
COPY --from=adapter /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
EXPOSE 8080
CMD ["node", "server.js"]
