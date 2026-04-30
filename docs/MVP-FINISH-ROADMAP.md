# Coach — MVP Finish Roadmap

> Goal: tighten what's already built so existing features don't bite real users. **No new features.** Aligns with `docs/PRODUCT.md` §3 (must-haves) and §4 (production bars).
>
> Drafted 2026-04-29. Work top-to-bottom; each phase has a verifiable exit check.

---

## Phase 0 — Baseline truth (½ day)

Before fixing anything, see what's actually broken in production.

- [x] Pull last 7 days of Sentry issues (iOS, P0/P1 first). Triage into: **fix-now**, **defer**, **won't-fix**. → only NODE-5 (LINK_CODE_SECRET), now fixed
- [x] Pull last 7 days of Railway logs for `api` and `worker`. List repeat errors. → no recurring errors
- [x] Run `npm run lint && npm run typecheck && npm run test --workspaces` — capture every failure.
- [x] Note current Sentry crash-free rate (iOS, 7-day). This is the number we're driving to ≥ 99.5%. → insufficient TestFlight volume to compute

**Exit:** A written list of (a) all fix-now Sentry issues, (b) all CI failures, (c) baseline crash-free rate.

---

## Phase 1 — Stop the bleeding (CI + crashes) (1–2 days)

Nothing else matters if the test suite is red or the app crashes on launch.

- [x] Make `lint`, `typecheck`, and all workspace tests green. No skips, no `.only`. → 865 tests passing
- [x] Fix every fix-now Sentry issue from Phase 0. Each fix lands as its own commit. → NODE-5 fixed
- [x] Re-run after each fix; verify Sentry stops receiving new events for that issue.

**Exit:** CI green on `main`. Zero open P0/P1 Sentry issues > 7 days old.

---

## Phase 2 — Harden each existing feature (3–5 days)

For each feature below, do **only** these three things:

1. Walk the golden path on a real device.
2. Walk one obvious failure path (no network, bad input, permission denied, slow API).
3. File and fix any user-visible bug. No refactors.

Features (in priority order — most user-facing first):

- [x] **Auth** — fixed signOut store cascade clearing dashboard/water/weight (multi-user data leak)
- [x] **Onboarding** — audited end-to-end: back, progress, MMKV resume, idempotent submit, edit-later all verified clean
- [x] **Photo meal logging** — added 30s upload timeout, AbortController cancel, "still processing" state, Sentry breadcrumbs at every step, fixed misleading copy
- [ ] **Voice meal logging** — feature was pruned in commit 90481a6 (out of v1 scope); Telegram path remains and is unaffected
- [ ] **Manual food search + quick-add + favorites/recents/templates** — needs audit (deferred for device QA)
- [x] **Macro/calorie dashboard** — fixed midnight rollover bug (todayKey was frozen at mount), i18n streak legend, weekday/month locale arrays
- [ ] **Water + weight logging** — needs audit (deferred for device QA)
- [ ] **AI Coach chat** — no in-app chat screen exists in current build; Telegram path is the chat surface
- [x] **Subscription** — instant in-memory pro state on purchase + restore (no more waiting for fetchStatus)
- [ ] **Push + Telegram notifications** — needs device QA in both locales
- [ ] **Settings: profile edit, theme, language toggle** — fixed EditProfile useState→useEffect bug; rest needs device QA

For each: commit message format `fix(<area>): <what>` and link the Sentry issue if any.

**Exit:** Manual run-through of all 11 features on a clean TestFlight install with no user-visible bugs. Crash-free rate trending up.

---

## Phase 3 — Plug the v1-blocking backend gaps (1 day)

Per PRODUCT.md §3, only two backend items block launch:

- [x] **P1.2 — BMR → Mifflin-St Jeor.** Verified already in use; added 5 table-driven spec tests with published values.
- [x] **P4.2 — Real GDPR data export.** Implemented: 18-table Prisma collection → S3 zip → signed URL → Telegram + push delivery in user's locale. 27 spec tests covering all 9 worker categories.

**Exit:** Both processors have specs covering all 9 worker test categories from CLAUDE.md.

---

## Phase 4 — Quality bars (1–2 days)

Drive the metrics in PRODUCT.md §4 to green.

- [ ] **Crash-free rate ≥ 99.5%** for iOS, 7-day window in Sentry. → needs TestFlight session volume to compute
- [x] **API p95 < 500ms** — verified `nestjs-pino` already emits `duration_ms` per request via `customSuccessMessage`; tightened photo upload throttle to 20/min/user
- [x] **Worker job success ≥ 99%** — added 60s OpenAI/Gemini timeouts, idempotency guard on GDPR export, structured Pino logging across all processors
- [ ] **Maestro E2E** — 5 existing flows verified, 4 stubs scaffolded for golden journeys (onboarding/photo/voice/weight); stubs need device + test account to flesh out
- [x] **i18n sweep** — done in mobile audit; zero orphan keys, MN/EN in sync

**Exit:** Every bar in PRODUCT.md §4 "Quality bars" is met and screenshotted/recorded.

---

## Phase 5 — Store-readiness (½ day)

This is the last mile, not engineering.

- [ ] App Store listing copy + screenshots (Mongolian primary, English secondary).
- [ ] Privacy labels accurate to what the app actually collects.
- [ ] Apple IAP subscription tested in sandbox **and** TestFlight.
- [ ] Terms + Privacy Policy live at `nexuskairos.com/coach/legal` and linked from Settings.
- [ ] Bump iOS build, `eas build --profile production --platform ios`, `eas submit`.

**Exit:** Submitted to App Store review.

---

## Rules while executing this roadmap

- **No new features.** If you find yourself adding a screen, stop.
- **No adjacent refactors.** Surgical fixes only (CLAUDE.md rule 3).
- **Commit per fix**, push to `main` directly (per project workflow).
- **One feature at a time** in Phase 2 — finish it, move on. Do not interleave.
- If a Phase 2 feature is fundamentally broken (not a small fix), surface it before sinking >½ day — it may need to be cut from v1 instead of fixed.

## Out of scope for this roadmap

Tracked in PRODUCT.md but **not** part of "finish the account/MVP" hardening:

- 200+ MN food database build-out (P0-4) — content work, runs in parallel; not blocking on engineering.
- Streaks + daily check-in (P0-3) — new feature, defer until hardening is done.
- Device step tracking — new feature, defer.
- Anything in §5 non-goals.
