# Coach — Product Vision & Scope

> **Required reading for any task framed as "ship," "finish," "make production-ready," or "what's next."**
> This is the single source of truth for _what_ Coach is and _when_ it's done.
> Companion docs: `docs/competitive-analysis.md` (market landscape), `docs/cal-ai-gap-analysis.md` (backend feature parity), `marketing/coach/BRIEF.md` (positioning + voice).
>
> **Status:** First pass drafted 2026-04-27 from existing strategy docs + BRIEF. Sections marked **`[DECIDE]`** require Sumiya's judgment before this doc is load-bearing.

---

## 1. Target user

**Primary:** Mongolian users, 22–40, in Ulaanbaatar or the diaspora (Korea/Japan), who:

- Want to understand and improve their nutrition + training but find calorie counting tedious.
- Eat traditional Mongolian food daily (бууз, хуушуур, цуйван, сүүтэй цай) — foods that are _missing or wrong_ in MyFitnessPal/Cal AI/YAZIO.
- Have a smartphone and use Telegram + Facebook + Instagram daily.
- Are price-sensitive: gym membership is 80–200K MNT/mo; Netflix is 15K MNT/mo. They will not pay $10–20/mo USD pricing.

**Secondary:** Mongolian personal trainers and small gyms who want a tool to recommend to clients.

**Not the target:**

- Bodybuilders / advanced lifters who want a dedicated strength tracker (Hevy/Strong own that).
- Endurance athletes who want GPS + segments (Strava owns that).
- Clinical / medical nutrition use cases.
- Non-Mongolian markets in v1.

## 2. Core value proposition

> **The fastest way for a Mongolian to log what they actually eat and see real progress — in Mongolian, with foods their grandmother would recognize.**

Three things only Coach does:

1. **MN food database** — бууз, хуушуур, цуйван, аарууль, etc. with verified nutrition. No global app will ever build this.
2. **Zero-friction logging** — photo + voice in Mongolian. Manual logging is a fallback, not the primary path.
3. **AI coach with memory** — conversational, in Mongolian, remembers your goals across sessions.

Everything else (workout logging, water, weight) is table stakes — must work, but is not the reason someone downloads Coach.

## 3. MVP scope — what "v1 ready to charge money" means

- voice logging fully functional

A user can pay for Coach when **all** of the following are true:

### Must-have (blocks public launch)

- [x] Auth (email, Google, Apple) — done
- [x] Onboarding → goals + targets — done (but P0-5: needs skip/back/edit)
- [x] AI photo meal logging in MN — done
- [x] AI voice meal logging in MN via Telegram — done
- [x] Manual food search + quick-add — done
- [x] Macro/calorie dashboard — done
- [x] Water + weight logging — done
- [x] AI Coach chat with memory — done
- [x] Subscription via QPay — done
- [ ] **MN food database: 200+ verified traditional foods** (P0-4) — _currently partial; this is the moat_
- [ ] **Streaks + daily check-in** (P0-3) — _retention floor_
- [ ] **Crash-free rate ≥ 99.5%** (P0-6) — _trust floor_
- [ ] **Onboarding: skip/back/progress + edit-later** (P0-5) — _activation floor_
- [ ] **Device step tracking: phone motion steps shown in dashboard** — _current v1 scope_
- [ ] **Apple Health: read steps + weight, write nutrition** — _post-v1 unless Sumiya re-promotes it_

### Explicitly NOT in v1 (deferred to v1.1+ unless data says otherwise)

- Social features (feed, friends, groups) — biggest scope risk; **`[DECIDE]`** if v1.1 or v2
- Apple Watch app
- Web dashboard
- Recipe builder
- Meal planning
- Workout logging
- Body composition tracking
- In-app AI chat screen
- In-app voice logging
- Weekly reports/summaries
- Adaptive targets, meal timing insights, and meal nudges
- Rest timer + progressive overload
- LiDAR portion estimation
- FatSecret/USDA federated search
- Most items in `cal-ai-gap-analysis.md` P2–P7

### Backend gaps that need to land before public launch

From `cal-ai-gap-analysis.md`, only these are v1-blocking; everything else defers:

- P1.2 — switch BMR to Mifflin-St Jeor (1-day fix, accuracy floor)
- P4.2 — implement data export (GDPR floor; processor is currently a stub)

Everything else in that doc is post-v1.

## 4. Definition of "production-ready"

When Claude is asked to "make Coach production-ready," it means **all** of these — not a vibe:

### Quality bars

- **Crash-free rate ≥ 99.5%** (Sentry, last 7 days, iOS)
- **No P0/P1 Sentry issues open** older than 7 days
- **API p95 latency < 500ms** for dashboard, meal logs, food search
- **Worker job success rate ≥ 99%** for photo, voice, weekly summary processors
- **`npm run lint && npm run typecheck && npm run test --workspaces`** all green
- **Maestro E2E flows pass** for: onboarding → log meal (photo) → log meal (voice) → see dashboard → log weight
- **i18n: zero untranslated keys** in MN locale; all user-facing copy reviewed by Sumiya

### Product bars

- All "Must-have" boxes in §3 checked.
- App Store listing approved (screenshots, description, privacy labels, review).
- QPay subscription tested end-to-end with real MNT payment.
- Privacy: data export + account deletion working (not stub).
- Terms of Service + Privacy Policy live at nexuskairos.com/coach/legal.

### What "production-ready" does NOT mean

- It does **not** mean "implement everything in cal-ai-gap-analysis.md."
- It does **not** mean "feature parity with MyFitnessPal."
- It does **not** mean "add social, watch app, recipes, meal plans."

If a task isn't moving a quality bar or product bar above, it's not v1 work.

## 5. Non-goals (stop building these)

When Claude is tempted to add these, it should ask first:

- **Generic features that don't compound the MN moat.** Example: a beautifully refactored generic food-search service is wasted effort vs. adding 50 more MN foods.
- **Feature flags / configurability for things only one user (Sumiya) controls.** Just hardcode it.
- **Abstractions for hypothetical future requirements.** Three repeated lines is fine; premature abstraction isn't.
- **Backwards-compat shims for code that has zero production users yet.** Coach is in TestFlight — change the schema, write the migration, move on.
- **Monitoring/observability beyond Sentry + Pino + the daily monitor.** No new dashboards, no APM, no custom metrics pipelines.
- **Multi-tenant / multi-org / team features.** Coach is solo-consumer. Trainer/B2B is post-v1.
- **English-first UX.** MN is the default language; English is a courtesy.
- **"Cleaning up" code adjacent to a fix.** Surgical changes only (per global CLAUDE.md rule 3).

## 6. Long-term vision (12–24 months)

**`[DECIDE]`** — this section is my read of the strategy docs; Sumiya: confirm direction.

### Year 1 (post-launch, 0–12 mo)

1. Win the Mongolian market: 20–50K downloads, 600–2,500 paying users, ~60–250M MNT ARR (per competitive-analysis revenue projection).
2. Lock in the food database as the moat: 500+ MN foods verified, restaurant menu data for top UB chains.
3. Add the highest-leverage missing features driven by user feedback (likely streaks done, then social v1, then Apple Watch — but **let usage data decide, not this doc**).
4. Build the gym partnership channel (3–5 UB gyms with referral codes).

### Year 2+ (12–24 mo)

1. **Mongolian diaspora** (Korea ~35K, Japan ~12K) — same food culture, higher purchasing power.
2. **B2B trainer platform** — trainer dashboard, client management, referral revenue. Distribution play.
3. **Central Asian expansion** — Kazakhstan / Kyrgyzstan if MN model works. Similar food culture, underserved market.

### What Coach is _not_ trying to become

- A general global fitness app (lose to MFP/Strava/Hevy on every axis).
- A medical / clinical tool.
- A wearables hardware company.
- A social network with fitness as a feature.

## 7. How to use this doc

**Before starting any task:**

- If the task is framed as "ship", "finish", "production-ready", "what's next" — re-read §3, §4, §5.
- If the user asks for a feature not in §3's must-have list and not obviously fixing a bug — **ask whether it's v1 scope or post-v1**, don't just build it.
- If a feature is on the §5 non-goals list — **push back before building**.

**When this doc is wrong:**

- If the user makes a decision that contradicts this doc, update the doc in the same change. Don't let it drift stale.
- Sections marked `[DECIDE]` are placeholders — call them out explicitly when relevant rather than guessing.
