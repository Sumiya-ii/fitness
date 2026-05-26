# Sentry Report — 2026-05-26

## Summary
- 0 new errors in last 24h
- 2 historical unresolved issues found (both from late April / early May 2026)
- 1 fixed (code improvement), 1 needs human review (env config)

## Fixed

- **`Error: LINK_CODE_SECRET environment variable is required`** (node/api) — Converted generic `Error` throw to `ServiceUnavailableException` (HTTP 503). When `LINK_CODE_SECRET` is not configured, users now receive a proper 503 instead of a 500, and Sentry no longer captures it as an unhandled crash.
  - Sentry ID: NODE-5
  - First/Last seen: 2026-04-27 (7 occurrences)
  - Files changed:
    - `apps/api/src/telegram/telegram.service.ts` — `hashLinkCode` now throws `ServiceUnavailableException`
    - `apps/api/src/telegram/telegram.service.spec.ts` — added test for missing secret case

## Needs Review

- **`error: column p.goal_type does not exist`** (node/worker) — PostgreSQL error in `deriveFacts()` inside the coach-memory processor. The current source code correctly uses `t.goal_type` (targets table alias), so this is not a bug in the current codebase. The error appeared 3 times on 2026-05-04, shortly after the Apr 29 rewrite, and has not recurred. Most likely cause: a brief Railway deploy window where the compiled `dist/` was out of sync with the new source. No code change needed — the issue should be marked resolved in Sentry.
  - Sentry ID: NODE-6
  - First/Last seen: 2026-05-04 (3 occurrences, all same day)
  - Stacktrace summary: `deriveFacts` → `Promise.all([...5 pg queries...])` in `coach-memory.processor.js:49`
  - Action: Mark as resolved in Sentry UI — current code is correct.

## No New Errors
No new unresolved errors in the last 24 hours across `node` (api + worker) and `react-native` projects.
