# Sentry Report — 2026-04-07

## Summary
- 5 unresolved errors found (all pre-dating the 24h window; no new errors in last 24h)
- 2 fixed, 3 already addressed or not actionable

## Fixed

- **PrismaClientKnownRequestError: operator does not exist: uuid = text** (coach-api) — Changed `WHERE "user_id" = ${userId}::uuid` to `WHERE "user_id"::text = ${userId}` in `StreaksService.getStreaks`. Two previous fixes tried `CAST(${userId} AS uuid)` then `${userId}::uuid` but both failed on production. Casting the UUID column to text avoids the Prisma parameter binding type mismatch entirely.
  - Sentry ID: 7369857803 (NODE-2)
  - Files changed: `apps/api/src/streaks/streaks.service.ts`

- **NoSuchKey: The specified key does not exist** (coach-worker) — Suppressed Sentry capture for `NoSuchKey` S3 errors in `processSttJob`. This error is expected when audio files are deleted (TTL/user cancellation) before the STT job processes them. The job still marks the draft as failed and rethrows, but no longer pollutes Sentry.
  - Sentry ID: 7370129983 (NODE-3)
  - Files changed: `apps/worker/src/processors/stt.processor.ts`

## Already Addressed (Pre-existing Fixes, Sentry Not Yet Resolved)

- **PrismaClientKnownRequestError: Invalid UUID in RevenueCat webhook** (coach-api) — Already fixed in commit `a3f5610` (2026-03-29) with UUID regex validation guard and try/catch for unknown RC anonymous ID formats. Last seen 2026-03-30 after the deploy. No new occurrences. Sentry issue can be manually resolved.
  - Sentry ID: 7369611835 (NODE-1)

- **error: column "updated_at" of relation "voice_drafts" does not exist** (coach-worker) — Already fixed in migration `20260329000003_add_voice_drafts_updated_at` (2026-03-29). Single occurrence on 2026-03-29 before the migration ran. Sentry issue can be manually resolved.
  - Sentry ID: 7373038060 (NODE-4)

## Needs Review

- **Error: First error** (react-native) — Appears to be a Sentry SDK integration test from 2026-03-21. Only 3 occurrences, all tagged `environment: development`. Stack points to `SettingsScreen.tsx:486` which is a comment — source maps out of sync with the dev build. Not a production issue. Can be manually resolved/ignored.
  - Sentry ID: 7354516444 (REACT-NATIVE-1)
  - Stacktrace summary: `RNButton.props.onPress(SettingsScreen.tsx:486)` — development environment only
