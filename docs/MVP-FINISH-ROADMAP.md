# Coach — MVP Finish Roadmap

> Goal: tighten what's already built so existing features don't bite real users. **No new features.** Aligns with `docs/PRODUCT.md` §3 (must-haves) and §4 (production bars).
>
> Drafted 2026-04-29. Work top-to-bottom; each phase has a verifiable exit check.

---

## Phase 0 — Baseline truth (½ day)

Before fixing anything, see what's actually broken in production.

- [ ] Pull last 7 days of Sentry issues (iOS, P0/P1 first). Triage into: **fix-now**, **defer**, **won't-fix**.
- [ ] Pull last 7 days of Railway logs for `api` and `worker`. List repeat errors.
- [ ] Run `npm run lint && npm run typecheck && npm run test --workspaces` — capture every failure.
- [ ] Note current Sentry crash-free rate (iOS, 7-day). This is the number we're driving to ≥ 99.5%.

**Exit:** A written list of (a) all fix-now Sentry issues, (b) all CI failures, (c) baseline crash-free rate.

---

## Phase 1 — Stop the bleeding (CI + crashes) (1–2 days)

Nothing else matters if the test suite is red or the app crashes on launch.

- [ ] Make `lint`, `typecheck`, and all workspace tests green. No skips, no `.only`.
- [ ] Fix every fix-now Sentry issue from Phase 0. Each fix lands as its own commit.
- [ ] Re-run after each fix; verify Sentry stops receiving new events for that issue.

**Exit:** CI green on `main`. Zero open P0/P1 Sentry issues > 7 days old.

---

## Phase 2 — Harden each existing feature (3–5 days)

For each feature below, do **only** these three things:

1. Walk the golden path on a real device.
2. Walk one obvious failure path (no network, bad input, permission denied, slow API).
3. File and fix any user-visible bug. No refactors.

Features (in priority order — most user-facing first):

- [ ] **Auth** — email, Google, Apple. Logout. Token refresh on cold start.
- [ ] **Onboarding** — every screen forward; back button; close-and-resume; finishing writes targets correctly. (Skip/back polish from P0-5 stays in scope here since it's an activation floor.)
- [ ] **Photo meal logging** — happy path + bad photo + offline + GPT timeout.
- [ ] **Voice meal logging** — record, upload, parse, confirm. Telegram path + in-app path. Worker failure surfaces a real error to the user, not a silent stuck draft.
- [ ] **Manual food search + quick-add + favorites/recents/templates** — empty state, no-results, duplicate add.
- [ ] **Macro/calorie dashboard** — correct math; updates after each log; date scrubbing; midnight rollover.
- [ ] **Water + weight logging** — add, edit, delete; chart renders with 0/1/many points.
- [ ] **AI Coach chat** — send, receive, memory persists across sessions, network failure shows retry.
- [ ] **Subscription** — paywall opens, purchase completes (sandbox), restore works, gated features actually unlock.
- [ ] **Push + Telegram notifications** — delivered in both locales (mn/en).
- [ ] **Settings: profile edit, theme, language toggle** — changes persist across cold start.

For each: commit message format `fix(<area>): <what>` and link the Sentry issue if any.

**Exit:** Manual run-through of all 11 features on a clean TestFlight install with no user-visible bugs. Crash-free rate trending up.

---

## Phase 3 — Plug the v1-blocking backend gaps (1 day)

Per PRODUCT.md §3, only two backend items block launch:

- [ ] **P1.2 — BMR → Mifflin-St Jeor.** One formula swap in the targets calculator + spec test for known input/output.
- [ ] **P4.2 — Real GDPR data export.** Replace the stub processor with one that actually writes the user's data to S3 and emails/pushes the link. Test on your own account.

**Exit:** Both processors have specs covering all 9 worker test categories from CLAUDE.md.

---

## Phase 4 — Quality bars (1–2 days)

Drive the metrics in PRODUCT.md §4 to green.

- [ ] **Crash-free rate ≥ 99.5%** for iOS, 7-day window in Sentry.
- [ ] **API p95 < 500ms** for `GET /dashboard`, `GET /meal-logs`, `GET /foods/search`. Add a Pino timing log if not already present; check the daily monitor report.
- [ ] **Worker job success ≥ 99%** for photo + voice processors. Check the BullMQ dashboard / DB.
- [ ] **Maestro E2E** flows pass: onboarding → photo meal → voice meal → dashboard → weight log. Fix any flaky flow rather than retry-loop it.
- [ ] **i18n sweep** — grep for hardcoded strings in `apps/mobile/app/`; ensure both `mn.json` and `en.json` have every key.

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
