FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# Install workspace dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts

# Build the shared package (consumed by both api and worker).
# NOTE: no `|| true` — a shared build failure must fail the image build fast,
# not silently continue and surface as a confusing downstream error.
FROM deps AS build-shared
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
RUN npm run build -w @coach/shared

# Build API
FROM build-shared AS build-api
COPY apps/api/ apps/api/
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build -w @coach/api

# Build worker (raw pg + BullMQ; no Prisma client needed)
FROM build-shared AS build-worker
COPY apps/worker/ apps/worker/
RUN npm run build -w @coach/worker

# ── Production image: API (docker-compose `target: api`) ─────────────
FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget
COPY --from=build-api /app/node_modules ./node_modules
COPY --from=build-api /app/package.json ./
COPY --from=build-shared /app/packages/shared ./packages/shared
COPY --from=build-api /app/apps/api ./apps/api
COPY apps/api/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]

# ── Production image: Worker (docker-compose `target: worker`) ───────
FROM node:20-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build-worker /app/node_modules ./node_modules
COPY --from=build-worker /app/package.json ./
COPY --from=build-shared /app/packages/shared ./packages/shared
COPY --from=build-worker /app/apps/worker ./apps/worker
CMD ["node", "apps/worker/dist/main.js"]
