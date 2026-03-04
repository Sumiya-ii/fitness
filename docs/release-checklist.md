# Coach v1 Release Checklist

Pre-release verification for the Coach nutrition coaching app.

## Infrastructure

- [ ] **PostgreSQL** — Database provisioned, migrations applied (`npm run db:migrate:deploy -w @coach/api`)
- [ ] **Redis** — Redis instance running, `REDIS_URL` configured
- [ ] **Environment variables** — All required vars set per `.env.example`

## Environment Variables

- [ ] `DATABASE_URL` — PostgreSQL connection string
- [ ] `REDIS_URL` — Redis connection string
- [ ] `FIREBASE_PROJECT_ID` — Firebase project ID
- [ ] `FIREBASE_CLIENT_EMAIL` — Firebase service account email
- [ ] `FIREBASE_PRIVATE_KEY` — Firebase private key (base64-decoded)
- [ ] `TYPESENSE_HOST` — Typesense host
- [ ] `TYPESENSE_PORT` — Typesense port
- [ ] `TYPESENSE_API_KEY` — Typesense API key
- [ ] `S3_ENDPOINT` — S3-compatible storage endpoint
- [ ] `S3_BUCKET` — S3 bucket name
- [ ] `S3_ACCESS_KEY` — S3 access key
- [ ] `S3_SECRET_KEY` — S3 secret key
- [ ] `TELEGRAM_BOT_TOKEN` — Telegram bot token
- [ ] `STT_PROVIDER` — STT provider (e.g. `chimege`, `google`)
- [ ] `STT_API_KEY` — STT API key (if required)
- [ ] `SENTRY_DSN` — Sentry DSN for error tracking (optional)

## Database

- [ ] **Migration** — Run `npm run db:migrate:deploy -w @coach/api` in target env
- [ ] **Seed** — Initial food data loaded (if applicable)

## Firebase

- [ ] **Auth providers** — Email/Phone OTP, Google, Apple sign-in enabled
- [ ] **Service account** — Key downloaded and env vars set

## Redis

- [ ] **Connection** — Health check passes
- [ ] **Queues** — BullMQ queues operational

## Typesense

- [ ] **Index** — Food search index created and synced
- [ ] **Reindex** — Run indexer job to populate

## S3

- [ ] **Bucket** — Bucket created with correct permissions
- [ ] **Upload test** — Photo upload flow verified

## Telegram Bot

- [ ] **Bot created** — Via @BotFather
- [ ] **Webhook** — Set: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<API_URL>/api/v1/telegram/webhook`
- [ ] **Link flow** — One-time code linking tested

## CI

- [ ] **Pipeline green** — Lint, test, typecheck pass on release branch
- [ ] **E2E tests** — `npm run test:e2e -w @coach/api` pass
- [ ] **Test packs** — Run `npx jest --config ./test/jest-packs.json` from `apps/api` (performance, reliability, security)

## Security Review

- [ ] **Auth** — Protected routes require valid token; public routes accessible
- [ ] **Admin RBAC** — Moderation endpoints restricted to admin role
- [ ] **Input validation** — Zod schemas reject invalid/malicious input
- [ ] **Secrets** — No secrets in logs, env, or version control

## Monitoring

- [ ] **Error tracking** — Sentry (or equivalent) configured
- [ ] **Health endpoint** — `/api/v1/health` returns 200
- [ ] **Queue health** — `/api/v1/health/queues` (authenticated) shows queue status

## Backup Strategy

- [ ] **Database backups** — Automated PostgreSQL backups configured
- [ ] **Retention** — Backup retention policy defined
- [ ] **Restore tested** — Restore procedure verified

## Load Test Results

- [ ] **Health** — Response time < 100ms (NFR-001)
- [ ] **Dashboard** — Response time < 500ms (NFR-002)
- [ ] **Food search** — Response time < 500ms (NFR-003)
- [ ] **Load test report** — Baseline captured and documented

## Sign-off

| Role   | Name | Date | Signature |
|--------|------|------|-----------|
| Dev    |      |      |           |
| QA     |      |      |           |
| PM     |      |      |           |

## Go/No-Go

- [ ] All must-ship requirements have status and evidence
- [ ] Unresolved risks documented
- [ ] **Recommendation:** ☐ Go  ☐ No-Go
