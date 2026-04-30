# Sentry Triage — 2026-04-29

## Baseline

- **Node (API/worker) open issues**: 1 (NODE-5, now fixed)
- **React Native (mobile) open issues**: 0
- **Crash-free rate**: not calculable (Sentry returns `null` — insufficient session volume in 7-day window; app is in TestFlight beta with limited users)

---

## Fixed Issues

| Sentry ID | Title | Fix commit |
|-----------|-------|------------|
| NODE-5 | `Error: LINK_CODE_SECRET environment variable is required` | `2b3bffb` |

**Root cause**: `TelegramService.hashLinkCode` was reading `process.env.LINK_CODE_SECRET`
directly, bypassing the validated `ConfigService`. `LINK_CODE_SECRET` was not in the env
schema so Railway had no prompt to set it. Every user who tapped "Link Telegram" got a 500.

**Fix**: Added `LINK_CODE_SECRET` to `@coach/shared` env schema (optional), switched to
`this.config.get('LINK_CODE_SECRET')`, updated `.env.example` with generation instructions.

**Action needed**: Set `LINK_CODE_SECRET` in Railway production env vars for `coach-api`:
```
openssl rand -hex 32
# paste output into Railway → coach-api → Variables → LINK_CODE_SECRET
```
Until this is done the endpoint still throws — the code fix is deployed but the secret must be provisioned.

---

## Deferred Issues

None. No additional unresolved Sentry issues were found in the 7-day window.

---

## CI Failures Fixed (Phase 1)

| File | Problem | Fix commit |
|------|---------|------------|
| `apps/mobile/src/__tests__/auth-store.test.ts` | Missing `@react-native-async-storage/async-storage` mock caused entire suite to fail to run | `125ef77` |

---

## Railway Log Findings

- **API**: Clean startup, no errors in 200-line window. The service restarted recently with a fresh deployment.
- **Worker**: Service name `coach-worker` not found via `railway logs` in this worktree (Railway CLI is linked to a different service). No errors visible in the API logs that would indicate worker failures propagating upstream.

---

## Observability Gaps (not bugs, but worth noting)

1. **`LINK_CODE_SECRET` still not set in Railway** — the Sentry error will recur until this is provisioned. Not a code fix.
2. **Crash-free rate baseline unavailable** — TestFlight beta has insufficient session volume. Will become calculable once production is live.
3. **`coach-worker` Railway logs** — could not pull worker logs; Railway CLI in this environment is linked to the API service only. Worker health must be checked from the Railway dashboard directly.
