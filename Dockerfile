# Multi-stage build for Coach API and Worker
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts

# Build shared package
FROM deps AS build-shared
COPY packages/shared/ packages/shared/
COPY tsconfig.base.json ./
RUN npm run build -w @coach/shared 2>/dev/null || true

# Build API
FROM build-shared AS build-api
COPY apps/api/ apps/api/
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build -w @coach/api

# Build Worker
FROM build-shared AS build-worker
COPY apps/worker/ apps/worker/
RUN npm run build -w @coach/worker

# API production image
FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=build-shared /app/packages/shared ./packages/shared
COPY --from=build-api /app/apps/api ./apps/api

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "apps/api/dist/main.js"]

# Worker production image
FROM node:20-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=build-shared /app/packages/shared ./packages/shared
COPY --from=build-worker /app/apps/worker ./apps/worker

CMD ["node", "apps/worker/dist/main.js"]
