# Coach

AI-enabled nutrition and training app for Mongolian users.

## Monorepo Structure

```
coach/
├── apps/
│   ├── api/          # NestJS backend API
│   ├── worker/       # BullMQ background workers
│   └── mobile/       # React Native mobile app
├── packages/
│   └── shared/       # Shared types, constants, and utilities
├── requirements.md   # Product requirements (source of truth)
└── todo-chunks.md    # Implementation tracker
```

## Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL (for later chunks)
- Redis (for later chunks)

## Getting Started

```bash
# Install all dependencies
npm install

# Run all linters
npm run lint

# Run all tests
npm run test

# Type-check all workspaces
npm run typecheck

# Format code
npm run format

# Start API in dev mode
npm run start:dev -w @coach/api

# Start worker in dev mode
npm run start:dev -w @coach/worker
```

## Mobile Runtime Config

For `apps/mobile`, configure these Expo public env vars instead of editing source files:

- `EXPO_PUBLIC_API_BASE_URL` (example: `http://192.168.1.x:3000/api/v1` for physical device testing)
- `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` (example: `MyCoachBot`, with or without `@`)
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` (optional)
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` (optional)
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (optional)

## Deployment & Migrations

Deploy config is **config-as-code** in `apps/api/railway.toml` (API) and `apps/worker/railway.toml` (worker) — not the Railway dashboard.

**Migration strategy — forward-only, non-destructive.** Production applies committed Prisma migrations via `prisma migrate deploy` in the pre-deploy step (`preDeployCommand` in `apps/api/railway.toml`). We do **not** run `prisma db push` in production — it is destructive and bypasses migration history.

- Author a migration locally: `npm run db:migrate -w @coach/api` (`prisma migrate dev`) → commit the folder under `apps/api/prisma/migrations/`.
- Production applies pending migrations automatically on deploy.

**⚠️ One-time production baseline (do this before the first `migrate deploy`).** Prod was previously managed with `db push`, so its `_prisma_migrations` table may not record the existing migrations. Point `DATABASE_URL` at prod, then:

```bash
npx prisma migrate status --schema=apps/api/prisma/schema.prisma        # inspect drift
# If a migration's changes are already present but it shows "not applied", mark it applied:
npx prisma migrate resolve --applied 00000000000000_baseline --schema=apps/api/prisma/schema.prisma
# repeat --applied for every migration folder already reflected in the live DB
```

**Railway adoption (dashboard overrides win over `railway.toml`).** In coach-api → Settings → Deploy: **clear** the custom Start Command (currently `prisma db push --accept-data-loss && …`) and custom Build Command so `railway.toml` takes effect, and set the config path to `apps/api/railway.toml`.

**Required prod env vars:** `DATABASE_URL`, `REDIS_URL`, `FIREBASE_*`, `REVENUECAT_WEBHOOK_SECRET` (webhooks 401 without it), `LINK_CODE_SECRET`, `TELEGRAM_WEBHOOK_SECRET`; optional `IP_HASH_SECRET`, `BULL_BOARD_USER`/`BULL_BOARD_PASSWORD` (admin dashboard denied when unset). Validated at boot by `packages/shared/src/config/env.schema.ts`.

**Portability.** `apps/api/Dockerfile` builds both `api` and `worker` targets and `docker-compose.yml` runs the full stack locally, so any Docker host (Fly.io, Render, a VPS) can deploy these images — only `DATABASE_URL`/`REDIS_URL` + env vars change.

**Before scaling the API past 1 replica (post-MVP):** `ThrottlerModule` uses in-memory storage (per-replica rate limits) and `@Cron` jobs fire once per replica. Move throttle storage to Redis and run schedulers on a single instance before adding replicas.

## Tech Stack

- **Backend**: NestJS (TypeScript) with REST
- **Workers**: BullMQ for async jobs
- **Mobile**: React Native (TypeScript)
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + BullMQ
- **Auth**: Firebase Auth
- **Observability**: Sentry + Pino structured logging
