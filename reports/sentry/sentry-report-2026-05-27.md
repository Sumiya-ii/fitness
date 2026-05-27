# Sentry Report — 2026-05-27

## Summary
- 0 new errors in last 24h
- 2 existing unresolved issues reviewed (both from weeks ago, no recent recurrence)
- 1 code improvement applied (NODE-5), 1 already fixed by previous run (NODE-6)

## Fixed

- **NODE-6: `error: column p.goal_type does not exist`** (node/coach-worker) — Already fixed by previous automated run on 2026-05-23 (commit `581b718`). The coach-memory processor was querying `p.goal_type` (profiles table alias) but `goal_type` lives on the `targets` table. Fixed to `t.goal_type`. No further action needed; Sentry issue has not recurred since May 4.
  - Sentry ID: 7459412311
  - Files changed: `apps/worker/src/processors/coach-memory.processor.ts` (fixed 2026-05-23)

- **NODE-5: `LINK_CODE_SECRET environment variable is required`** (node/coach-api) — Improved error handling: changed raw `throw new Error(...)` to `throw new InternalServerErrorException(...)` so NestJS returns a proper 503-style response with a user-safe message instead of an opaque 500. Root cause is still a missing env var in Railway (see below).
  - Sentry ID: 7445552823
  - Files changed: `apps/api/src/telegram/telegram.service.ts`

## Needs Review

- **NODE-5: `LINK_CODE_SECRET` not set in Railway** — The `LINK_CODE_SECRET` environment variable is required for the Telegram link-code feature (`POST /api/v1/telegram/link-code`) but is absent from the Railway API service environment. The env var must be added to Railway manually. Suggested value: any random 32-byte hex string (e.g., `openssl rand -hex 32`). It is already listed in `.env.example`. Until it is set, users who attempt to link their Telegram account will receive a 500 error. Last seen: 2026-04-27 (7 events, 1 user affected).
  - Sentry ID: 7445552823
  - Action: Add `LINK_CODE_SECRET=<random-hex>` to Railway environment for the `coach-api` service

## No New Errors
No new unresolved errors in the last 24 hours.
