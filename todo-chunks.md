# Coach Implementation To-Do (AI-Sized Chunks)

Document status: Active tracker  
Last updated: 2026-03-04  
Source of truth reference: `/Users/sumiyaganbaatar/Desktop/fitness/requirements.md`

## How to use this tracker

1. Give one chunk at a time to the AI model.
2. Do not combine chunks unless marked `parallel-safe`.
3. Require the AI to update tests and docs in the same chunk.
4. Move status through: `Not Started` -> `In Progress` -> `Review` -> `Done`.

## Status Board

| Chunk ID | Title                                        | Area              | Depends On         | Parallel Safe | Status      | Owner | PR  |
| -------- | -------------------------------------------- | ----------------- | ------------------ | ------------- | ----------- | ----- | --- |
| C-001    | Monorepo scaffold                            | Platform          | -                  | No            | Done        | AI    |     |
| C-002    | CI pipeline baseline                         | Platform          | C-001              | Yes           | Done        | AI    |     |
| C-003    | Env config and secret loading                | Platform          | C-001              | Yes           | Done        | AI    |     |
| C-004    | PostgreSQL schema bootstrap                  | Data              | C-001              | No            | Done        | AI    |     |
| C-005    | Redis + queue bootstrap                      | Platform          | C-001              | Yes           | Done        | AI    |     |
| C-006    | Auth provider wiring                         | Backend           | C-003,C-004        | No            | Done        | AI    |     |
| C-007    | User/profile APIs                            | Backend           | C-006              | No            | Done        | AI    |     |
| C-008    | Goals and target calculation service         | Backend           | C-007              | Yes           | Done        | AI    |     |
| C-009    | Food core tables and CRUD APIs               | Backend           | C-004              | No            | Done        | AI    |     |
| C-010    | Food search index sync job                   | Backend           | C-009,C-005        | Yes           | Done        | AI    |     |
| C-011    | Text logging API (`FR-020`)                  | Backend           | C-009              | No            | Done        | AI    |     |
| C-012    | Quick add API (`FR-021`)                     | Backend           | C-011              | Yes           | Done        | AI    |     |
| C-013    | Favorites and recents API (`FR-027`)         | Backend           | C-011              | Yes           | Done        | AI    |     |
| C-014    | Barcode lookup API (`FR-022`)                | Backend           | C-009              | Yes           | Done        | AI    |     |
| C-015    | Unknown barcode submission (`FR-023`)        | Backend           | C-014              | Yes           | Done        | AI    |     |
| C-016    | Meal log immutable snapshot rules            | Backend           | C-011              | No            | Done        | AI    |     |
| C-017    | Telegram account link flow (`FR-040`)        | Backend           | C-006              | No            | Done        | AI    |     |
| C-018    | Telegram text logging (`FR-041`)             | Backend           | C-017,C-011        | No            | Done        | AI    |     |
| C-019    | Telegram idempotency guard (`FR-045`)        | Backend           | C-018              | No            | Done        | AI    |     |
| C-020    | STT worker abstraction layer                 | AI/Backend        | C-005              | No            | Done        | AI    |     |
| C-021    | In-app voice draft parse API (`FR-024`)      | AI/Backend        | C-020,C-011        | No            | Done        | AI    |     |
| C-022    | Telegram voice note pipeline (`FR-042`)      | AI/Backend        | C-020,C-018        | No            | Done        | AI    |     |
| C-023    | Photo upload + draft parse API (`FR-025`)    | AI/Backend        | C-005,C-011        | No            | Done        | AI    |     |
| C-024    | Daily dashboard API (`FR-030`,`FR-031`)      | Backend           | C-011,C-016        | Yes           | Done        | AI    |     |
| C-025    | Weight logging + trend API (`FR-032`)        | Backend           | C-007              | Yes           | Done        | AI    |     |
| C-026    | Weekly summary API (`FR-033`)                | Backend           | C-024,C-025        | No            | Done        | AI    |     |
| C-027    | Subscription entitlements (`FR-050..052`)    | Backend           | C-006              | No            | Done        | AI    |     |
| C-028    | Consent + privacy request APIs               | Backend           | C-006,C-004        | Yes           | Done        | AI    |     |
| C-029    | Admin moderation APIs (`FR-060..062`)        | Backend           | C-009,C-015        | No            | Done        | AI    |     |
| C-030    | Notification preference APIs (`FR-044`)      | Backend           | C-007              | Yes           | Done        | AI    |     |
| C-031    | Reminder scheduler jobs                      | Backend           | C-005,C-030,C-017  | No            | Done        | AI    |     |
| C-032    | Analytics event pipeline                     | Data              | C-001,C-004        | Yes           | Done        | AI    |     |
| C-033    | API contract and OpenAPI publish             | Platform          | C-007..C-031       | No            | Done        | AI    |     |
| C-034    | Error tracking + observability wiring        | Platform          | C-001,C-003        | Yes           | Done        | AI    |     |
| C-035    | Performance test pack (`NFR-001..003`)       | QA                | C-024,C-011,C-013  | No            | Done        | AI    |     |
| C-036    | Reliability test pack (`NFR-010..012`)       | QA                | C-019,C-031        | No            | Done        | AI    |     |
| C-037    | Security/privacy verification pack           | QA                | C-028,C-029        | No            | Done        | AI    |     |
| C-038    | v1 release checklist and go/no-go report     | PM/QA             | C-001..C-037       | No            | Done        | AI    |     |
| C-039    | Mobile app shell + navigation                | Mobile UI         | C-001              | No            | Done        | AI    |     |
| C-040    | Design system foundation (tokens/components) | Mobile UI/UX      | C-039              | Yes           | Done        | AI    |     |
| C-041    | Onboarding UX screens                        | Mobile UI/UX      | C-040,C-007,C-008  | No            | Done        | AI    |     |
| C-042    | Auth UI screens and session UX               | Mobile UI/UX      | C-039,C-006        | No            | Done        | AI    |     |
| C-043    | Food logging home screen UX                  | Mobile UI/UX      | C-040,C-011,C-013  | No            | Done        | AI    |     |
| C-044    | Text search logging flow UI                  | Mobile UI/UX      | C-043,C-011        | No            | Done        | AI    |     |
| C-045    | Quick add flow UI                            | Mobile UI/UX      | C-043,C-012        | Yes           | Done        | AI    |     |
| C-046    | Barcode scanner UI flow                      | Mobile UI/UX      | C-043,C-014,C-015  | No            | Done        | AI    |     |
| C-047    | Voice logging UI flow                        | Mobile UI/UX      | C-043,C-021        | No            | Done        | AI    |     |
| C-048    | Photo logging UI flow                        | Mobile UI/UX      | C-043,C-023        | No            | Done        | AI    |     |
| C-049    | Meal templates/favorites/recents UI          | Mobile UI/UX      | C-043,C-013,C-026  | No            | Done        | AI    |     |
| C-050    | Dashboard UI + daily summary UX              | Mobile UI/UX      | C-024              | No            | Done        | AI    |     |
| C-051    | Weight log + trend chart UI                  | Mobile UI/UX      | C-025              | Yes           | Done        | AI    |     |
| C-052    | Weekly summary report UI                     | Mobile UI/UX      | C-026              | Yes           | Done        | AI    |     |
| C-053    | Telegram connect/settings UX                 | Mobile UI/UX      | C-017,C-030        | No            | Done        | AI    |     |
| C-054    | Subscription/paywall UI                      | Mobile UI/UX      | C-027              | No            | Done        | AI    |     |
| C-055    | Settings UX (language, units, privacy)       | Mobile UI/UX      | C-007,C-028,C-030  | No            | Done        | AI    |     |
| C-056    | Empty/loading/error states pass              | Mobile UX Quality | C-041..C-055       | No            | Done        | AI    |     |
| C-057    | Accessibility pass (a11y + dynamic type)     | Mobile UX Quality | C-041..C-055       | No            | Done        | AI    |     |
| C-058    | Mobile E2E test pack (critical flows)        | Mobile QA         | C-041..C-057       | No            | Done        | AI    |     |
| C-059    | UX telemetry events in mobile client         | Mobile/Data       | C-032,C-041..C-055 | No            | Done        | AI    |     |
| C-060    | UI polish and localization QA (mn/en)        | Mobile UX Quality | C-041..C-059       | No            | Done        | AI    |     |

## Chunk Details (copy/paste ready)

Use this format to assign each task to an AI model.

### C-001 Monorepo scaffold

- Goal: Initialize backend, worker, and mobile app folders with shared TypeScript configs.
- Output: Working repo structure + run scripts + README commands.
- Done when: `npm run lint` and `npm run test` placeholders pass in CI.
- PRD links: Section 17.2, 17.3.

### C-002 CI pipeline baseline

- Goal: Add GitHub Actions for lint, test, and typecheck on PRs.
- Output: `.github/workflows/ci.yml`.
- Done when: Pipeline runs on pull request and blocks on failures.
- PRD links: Section 17.2.

### C-003 Env config and secret loading

- Goal: Centralize environment variable schema and startup validation.
- Output: typed config module + `.env.example`.
- Done when: App fails fast on missing required env keys.
- PRD links: Section 17.4.

### C-004 PostgreSQL schema bootstrap

- Goal: Create initial migration for core entities in PRD section 9.
- Output: migration files + ORM models + seed script skeleton.
- Done when: clean database can migrate up/down without errors.
- PRD links: Section 9.

### C-005 Redis + queue bootstrap

- Goal: Configure Redis and job queue infrastructure.
- Output: queue module + healthcheck + retry/DLQ defaults.
- Done when: test job can be enqueued and processed.
- PRD links: Section 7.2, 17.2.

### C-006 Auth provider wiring

- Goal: Implement auth verification middleware and user session bootstrap.
- Output: auth guards/middleware + user creation on first login.
- Done when: protected endpoint rejects invalid token and accepts valid token.
- PRD links: `FR-001`, `FR-002`.

### C-007 User/profile APIs

- Goal: Implement profile read/update including language and unit settings.
- Output: `/v1/profile` GET/PUT.
- Done when: profile updates persist and validation rules are enforced.
- PRD links: `FR-003`.

### C-008 Goals and target calculation service

- Goal: Implement calorie/macro target logic and weekly rate handling.
- Output: target calculator service + tests for edge cases.
- Done when: API returns stable targets for all goal types.
- PRD links: `FR-010..014`.

### C-009 Food core tables and CRUD APIs

- Goal: Build `foods`, servings, nutrients, aliases, localizations, source metadata.
- Output: CRUD endpoints for admin-safe operations.
- Done when: food with multiple servings/locales can be created and queried.
- PRD links: Section 9.1.

### C-010 Food search index sync job

- Goal: Sync approved food records from Postgres to Typesense.
- Output: indexer job + reindex command.
- Done when: search returns localized results for mn/en queries.
- PRD links: Section 17.2, 9.4.

### C-011 Text logging API (`FR-020`)

- Goal: Log meals from selected food + serving + quantity.
- Output: `/v1/meal-logs` POST (text source).
- Done when: saved meal contains macro totals and item breakdown.
- PRD links: `FR-020`.

### C-012 Quick add API (`FR-021`)

- Goal: Add manual calories/macros entries without food lookup.
- Output: quick-add endpoint and validation.
- Done when: quick-add item appears in diary totals.
- PRD links: `FR-021`.

### C-013 Favorites and recents API (`FR-027`)

- Goal: Track and serve frequently used foods/meals.
- Output: recents/favorites read + mutation endpoints.
- Done when: latest logs affect recents ordering deterministically.
- PRD links: `FR-027`.

### C-014 Barcode lookup API (`FR-022`)

- Goal: Scan barcode and return mapped product nutrition.
- Output: barcode lookup endpoint + service.
- Done when: known barcode can be logged in <= 2 API actions.
- PRD links: `FR-022`.

### C-015 Unknown barcode submission (`FR-023`)

- Goal: Submit unknown barcode with label photos + nutrition payload.
- Output: upload + moderation queue entry.
- Done when: submission appears in moderation queue with audit trail.
- PRD links: `FR-023`, `FR-062`.

### C-016 Meal log immutable snapshot rules

- Goal: Persist immutable nutrition snapshot per logged item.
- Output: snapshot model + migration + service enforcement.
- Done when: changing food master data does not alter historical logs.
- PRD links: Section 9.3.

### C-017 Telegram account link flow (`FR-040`)

- Goal: Implement one-time code link between app user and Telegram user.
- Output: code generation/verification endpoints.
- Done when: one Telegram account can only link to one active app user.
- PRD links: `FR-040`.

### C-018 Telegram text logging (`FR-041`)

- Goal: Parse Telegram text into draft meal log and request confirmation.
- Output: Telegram webhook handler + draft confirmation state.
- Done when: unconfirmed drafts are not committed to meal logs.
- PRD links: `FR-041`, `AIR-001`.

### C-019 Telegram idempotency guard (`FR-045`)

- Goal: Prevent duplicate logs from webhook retries.
- Output: idempotency middleware/table integration.
- Done when: replaying same webhook does not create new meal logs.
- PRD links: `FR-045`, `NFR-012`.

### C-020 STT worker abstraction layer

- Goal: Add pluggable STT provider interface (Google primary, Chimege fallback).
- Output: provider adapter pattern + failover policy.
- Done when: mocked provider failure triggers fallback path.
- PRD links: Section 17.6.

### C-021 In-app voice draft parse API (`FR-024`)

- Goal: Accept app voice input and return editable draft.
- Output: upload endpoint + async parse + draft retrieval.
- Done when: confirmed draft saves; rejected draft is discarded.
- PRD links: `FR-024`, `AIR-002`.

### C-022 Telegram voice note pipeline (`FR-042`)

- Goal: Process Telegram voice notes through STT and draft parser.
- Output: download/queue/transcribe/parse workflow.
- Done when: voice message generates draft and confirmation prompt.
- PRD links: `FR-042`.

### C-023 Photo upload + draft parse API (`FR-025`)

- Goal: Store photo and generate assistive draft with confidence.
- Output: media upload + parse job + draft endpoint.
- Done when: no auto-save occurs without explicit user confirmation.
- PRD links: `FR-025`, `AIR-001`.

### C-024 Daily dashboard API (`FR-030`,`FR-031`)

- Goal: Return consumed/remaining calories and macros with protein emphasis fields.
- Output: dashboard endpoint with day aggregates.
- Done when: totals match meal logs for test fixtures.
- PRD links: `FR-030`, `FR-031`.

### C-025 Weight logging + trend API (`FR-032`)

- Goal: Create/read weight logs and trend points.
- Output: weight endpoints + trend calculation.
- Done when: daily and weekly trend responses are available.
- PRD links: `FR-032`.

### C-026 Weekly summary API (`FR-033`)

- Goal: Build weekly adherence summary endpoint.
- Output: averages + adherence score + weight delta.
- Done when: summary works for incomplete logging weeks.
- PRD links: `FR-033`.

### C-027 Subscription entitlements (`FR-050..052`)

- Goal: Add entitlement checks and payment webhook state transitions.
- Output: subscription status service + webhook handlers.
- Done when: entitlement changes within 60 seconds of webhook arrival.
- PRD links: `FR-050..052`.

### C-028 Consent + privacy request APIs

- Goal: Implement consent capture, data export request, and account deletion request.
- Output: consent endpoints + privacy request workflow records.
- Done when: all flows create auditable records with status transitions.
- PRD links: `NFR-021..024`, `NFR-030`.

### C-029 Admin moderation APIs (`FR-060..062`)

- Goal: Build moderation queue actions: approve/reject/merge/verify.
- Output: admin-only endpoints + audit logs.
- Done when: every moderation action writes audit entry.
- PRD links: `FR-060..062`.

### C-030 Notification preference APIs (`FR-044`)

- Goal: CRUD for reminder channels, locale, and quiet hours.
- Output: notification preference endpoints.
- Done when: scheduler can read preferences without extra joins.
- PRD links: `FR-044`.

### C-031 Reminder scheduler jobs

- Goal: Send morning/evening reminders for app and Telegram channels.
- Output: scheduled job processor + templates.
- Done when: reminders respect timezone and user preferences.
- PRD links: `FR-044`, `NFR-010`.

### C-032 Analytics event pipeline

- Goal: Emit required events and persist server-side analytics logs.
- Output: event publisher + schema validation.
- Done when: all events in PRD section 10.2 are emitted at least once in integration tests.
- PRD links: Section 10.2.

### C-033 API contract and OpenAPI publish

- Goal: Ensure `/v1` contracts are documented and generated.
- Output: OpenAPI spec + docs route/export artifact.
- Done when: CI verifies spec generation on each PR.
- PRD links: Section 17.3.

### C-034 Error tracking + observability wiring

- Goal: Add tracing, structured logs, and error reporting.
- Output: OpenTelemetry config + Sentry integration.
- Done when: request trace IDs appear in logs and test exceptions are captured.
- PRD links: Section 17.2.

### C-035 Performance test pack (`NFR-001..003`)

- Goal: Build automated checks for log speed, latency, and dashboard load.
- Output: load test scripts + baseline report.
- Done when: reports explicitly pass/fail against NFR thresholds.
- PRD links: `NFR-001..003`.

### C-036 Reliability test pack (`NFR-010..012`)

- Goal: Validate queue retries, DLQ behavior, webhook idempotency, duplicate handling.
- Output: integration test suite + replay fixtures.
- Done when: duplicate external events are safely ignored.
- PRD links: `NFR-010..012`.

### C-037 Security/privacy verification pack

- Goal: Validate RBAC, consent flows, export/delete controls, and audit completeness.
- Output: security checklist + automated tests where possible.
- Done when: all privacy and admin controls are test-evidenced.
- PRD links: `NFR-020..031`.

### C-038 v1 release checklist and go/no-go report

- Goal: Produce final release readiness report with unresolved risk list.
- Output: signed checklist and go/no-go recommendation.
- Done when: every v1 must-ship requirement has status and evidence.
- PRD links: Sections 5.1, 11, 13.

### C-039 Mobile app shell + navigation

- Goal: Set up app shell, route structure, tab navigation, authenticated vs guest stacks.
- Output: navigation architecture and screen placeholders.
- Done when: app can navigate across all major sections without backend data.
- PRD links: Section 5.1, 17.2.

### C-040 Design system foundation (tokens/components)

- Goal: Define spacing, typography, color tokens, and reusable base components.
- Output: component library (`Button`, `Input`, `Card`, `Sheet`, `Modal`, `Toast`).
- Done when: all new screens use shared components/tokens, not one-off styles.
- PRD links: Section 13.

### C-041 Onboarding UX screens

- Goal: Build profile and goal onboarding flow with progressive steps.
- Output: onboarding screens for profile, goal type, target rate, macro preference.
- Done when: validated onboarding payload submits successfully and resume works.
- PRD links: `FR-003`, `FR-010..014`.

### C-042 Auth UI screens and session UX

- Goal: Implement login/signup screens for OTP and social sign-in states.
- Output: auth screens, loading/error states, session restore UX.
- Done when: auth success lands on main app; invalid auth shows actionable errors.
- PRD links: `FR-001`, `FR-002`.

### C-043 Food logging home screen UX

- Goal: Build primary logging hub with entry points for text/voice/photo/barcode/quick-add.
- Output: log screen with fast actions and diary preview.
- Done when: top 5 daily actions reachable in one tap from this screen.
- PRD links: `FR-020..027`, `NFR-001`.

### C-044 Text search logging flow UI

- Goal: Implement search results, serving selection, quantity editing, and confirm log.
- Output: searchable flow tied to backend APIs with optimistic UI.
- Done when: user can complete a text log in <= 15 seconds with recent/favorite food.
- PRD links: `FR-020`, `NFR-001`.

### C-045 Quick add flow UI

- Goal: Implement manual calories/macros entry dialog and save flow.
- Output: quick-add form with strict validation and shortcut action.
- Done when: saved quick-add immediately updates daily totals.
- PRD links: `FR-021`.

### C-046 Barcode scanner UI flow

- Goal: Implement scanner camera screen, success result view, and unknown barcode fallback.
- Output: scanner UX including permission handling and manual fallback.
- Done when: unknown barcode path routes to submission UI reliably.
- PRD links: `FR-022`, `FR-023`.

### C-047 Voice logging UI flow

- Goal: Build record/stop/upload flow and editable parsed draft confirmation screen.
- Output: voice logging UX with confidence and edit-before-save.
- Done when: no parsed draft is auto-saved without user confirmation.
- PRD links: `FR-024`, `AIR-001`, `AIR-002`.

### C-048 Photo logging UI flow

- Goal: Build photo capture/upload and parsed draft confirmation UX.
- Output: camera/gallery flow, draft UI, confidence display, edit controls.
- Done when: user must confirm before save; uncertainty is visibly communicated.
- PRD links: `FR-025`, `AIR-001`, `AIR-002`.

### C-049 Meal templates/favorites/recents UI

- Goal: Build views for frequently used meals/foods and one-tap re-log.
- Output: favorites and recents tabs with sorting/filter UX.
- Done when: recently logged items appear first and re-log is one action.
- PRD links: `FR-026`, `FR-027`.

### C-050 Dashboard UI + daily summary UX

- Goal: Build daily dashboard with calories/macros and protein emphasis.
- Output: dashboard cards, progress visualizations, refresh states.
- Done when: all displayed totals match backend response and update live after logging.
- PRD links: `FR-030`, `FR-031`.

### C-051 Weight log + trend chart UI

- Goal: Build weight entry UI and trend chart with daily/weekly toggle.
- Output: add-weight modal and chart screen.
- Done when: user can add/edit today weight and see trend shift.
- PRD links: `FR-032`.

### C-052 Weekly summary report UI

- Goal: Build weekly summary experience for adherence and averages.
- Output: weekly report screen with metrics and explanatory labels.
- Done when: incomplete weeks render clear partial-data UX.
- PRD links: `FR-033`.

### C-053 Telegram connect/settings UX

- Goal: Build connect Telegram screen and reminder toggle settings.
- Output: link instructions, status indicator, unlink/relink controls.
- Done when: user sees real-time linked state and can recover failed linking.
- PRD links: `FR-040`, `FR-044`.

### C-054 Subscription/paywall UI

- Goal: Build free/pro feature gating screens and upgrade prompts.
- Output: paywall, entitlement-aware feature lock UI, restore purchase entry point.
- Done when: locked features show clear reason and upgrade path.
- PRD links: `FR-050..052`.

### C-055 Settings UX (language, units, privacy)

- Goal: Build settings for units/language, privacy export/delete, notification preferences.
- Output: settings screens and confirmation dialogs.
- Done when: privacy actions create requests and users can track status.
- PRD links: `FR-003`, `NFR-022`, `NFR-030`.

### C-056 Empty/loading/error states pass

- Goal: Standardize all empty/loading/error states across mobile screens.
- Output: reusable state components + per-screen coverage.
- Done when: every major screen has non-happy-path UX coverage.
- PRD links: Section 13.

### C-057 Accessibility pass (a11y + dynamic type)

- Goal: Improve accessibility labels, focus order, contrast, and dynamic type scaling.
- Output: accessibility fixes + audit checklist.
- Done when: core flows are screen-reader usable and meet contrast rules.
- PRD links: Section 13.

### C-058 Mobile E2E test pack (critical flows)

- Goal: Add end-to-end tests for login, onboarding, text log, dashboard, and weight log.
- Output: E2E suite and CI integration.
- Done when: critical flows pass in CI on each release branch.
- PRD links: Sections 5.1, 13.

### C-059 UX telemetry events in mobile client

- Goal: Emit client-side events for funnel and UX performance.
- Output: event instrumentation map and implementation.
- Done when: onboarding/logging/upgrade funnels are measurable end-to-end.
- PRD links: Section 10.2.

### C-060 UI polish and localization QA (mn/en)

- Goal: Final UX polish and localization QA for Mongolian and English.
- Output: issue list, fixes, and sign-off checklist.
- Done when: no blocking localization/truncation defects remain.
- PRD links: Section 3.1, Section 13.

## Prompt Template for Each Chunk

Use this prompt when assigning any chunk to an AI model:

```text
Implement chunk <CHUNK_ID> from /Users/sumiyaganbaatar/Desktop/fitness/todo-chunks.md.

Rules:
1) Only implement this chunk; do not expand scope.
2) Follow /Users/sumiyaganbaatar/Desktop/fitness/requirements.md exactly.
3) Add/adjust tests for this chunk.
4) Update docs/comments for changed behavior.
5) Return:
   - changed files
   - migration notes (if any)
   - test results
   - risks/assumptions
```

## Owner Action Items (manual steps required)

These items cannot be done by the AI and need to be completed by you.

### After C-001..C-007 completion

- [ ] **Set up PostgreSQL locally** — Install PostgreSQL and create a `coach` database. Then copy `.env.example` to `.env` and fill in `DATABASE_URL` (e.g. `postgresql://coach:coach@localhost:5432/coach`).
- [ ] **Set up Redis locally** — Install Redis and ensure it runs on the default port. Fill in `REDIS_URL` in `.env` (e.g. `redis://localhost:6379`).
- [ ] **Set up Firebase project** — Create a Firebase project in the Firebase Console. Enable Email/Phone OTP, Google, and Apple sign-in providers. Download the service account key and fill in `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in `.env`.
- [ ] **Run the first database migration** — After setting up `.env`, run: `npm run db:migrate -w @coach/api` to create all tables.
- [ ] **Verify the API starts** — Run `npm run start:dev -w @coach/api` and visit `http://localhost:3000/api/v1/health` to confirm it returns `{ status: "ok" }`.
- [ ] **Review the Prisma schema** — Check `apps/api/prisma/schema.prisma` and confirm all entities match your expectations from the PRD Section 9.

### After C-009..C-025 completion

- [ ] **Set up Typesense** — Install and run Typesense locally (Docker recommended: `docker run -p 8108:8108 typesense/typesense:0.25.2 --data-dir=/data --api-key=your-api-key`). Fill in `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_API_KEY` in `.env`.
- [ ] **Seed the food database** — After running migrations, prepare initial Mongolian food data (CSV or JSON) and load via the seed script or admin API. Minimum ~100 common Mongolian foods for testing.
- [ ] **Test barcode scanning** — Acquire a few local product barcodes and test the `/api/v1/barcodes/:code` lookup flow manually.
- [ ] **Test the dashboard** — After logging a few test meals, verify `/api/v1/dashboard` returns correct consumed/remaining totals matching your test data.
- [ ] **Test weight trend** — Log weights for a few days and verify `/api/v1/weight-logs/trend` returns sensible weekly averages.

### After C-026..C-030 completion

- [ ] **Subscription webhook verification** — Before production, implement real Apple/Google receipt verification in the webhook handler. Currently the webhook endpoint is `@Public()` and trusts the payload.
- [x] **Admin RBAC** — Implemented in API via `ADMIN_USER_IDS` allowlist guard for `/api/v1/admin/*` routes.
- [ ] **Privacy legal copy** — Provide the consent text versions (health_data, marketing, analytics) and their exact legal wording for each locale (mn/en). These need legal review.
- [ ] **Data export/deletion jobs** — The privacy service creates request records but doesn't actually process them. Background jobs for data export (generate JSON/CSV, upload to S3) and account deletion need to be wired into the worker.
- [ ] **App Store / Google Play setup** — Set up in-app purchase products and subscription tiers in both stores.

### After C-032, C-034 completion

- [ ] **Set up Sentry** — Create a Sentry project and add `SENTRY_DSN` to `.env` for error tracking. All unhandled exceptions will be reported automatically.
- [ ] **Set up OpenTelemetry** — If using distributed tracing, deploy an OTLP collector (e.g., Jaeger, Grafana Tempo) and set `OTEL_EXPORTER_OTLP_ENDPOINT` in `.env`.
- [ ] **Set up PostHog (optional)** — For product analytics aggregation, configure `POSTHOG_API_KEY` and `POSTHOG_HOST` in `.env`. The analytics events are currently stored in the DB; PostHog integration would be a future enhancement.

### After C-017..C-023 completion

- [ ] **Create Telegram Bot** — Go to @BotFather on Telegram, create a bot, and set `TELEGRAM_BOT_TOKEN` in `.env`.
- [ ] **Set Telegram Webhook URL** — After deploying, configure the webhook URL via: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain/api/v1/telegram/webhook`
- [ ] **Test Telegram linking** — Use the in-app link code flow: call `POST /api/v1/telegram/link-code` to get a 6-digit code, then send it to the bot on Telegram.
- [x] **STT Provider** — Wire Google STT via `GOOGLE_STT_API_KEY` env var. SttService calls Google Speech-to-Text API with mn-MN + en-US support. Worker processor implemented.
- [ ] **S3 Storage** — Configure `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` for photo upload storage. Currently photo uploads pass a reference path in the job data; actual S3 upload needs provider-specific implementation.
- [ ] **Run Prisma migration** — The `TelegramLink` model was updated with a `chatId` field. Run `npm run db:migrate -w @coach/api` after connecting to the database.

### After C-039..C-055 completion

- [ ] **Install Expo CLI** — Run `npm install -g expo-cli` or use `npx expo` commands.
- [ ] **Start the mobile app** — Run `npx expo start` from `apps/mobile/` and scan the QR code with Expo Go on your phone.
- [x] **Update API base URL** — Implemented in mobile client via `EXPO_PUBLIC_API_BASE_URL` env var (with sane localhost/emulator defaults).
- [ ] **Wire Firebase Auth SDK** — The auth screens use placeholder API calls. Install `@react-native-firebase/auth` or Expo's Firebase SDK and connect to your Firebase project.
- [ ] **Configure app.json** — Update the Expo config in `apps/mobile/app.json` with your app name, bundle identifier, and splash screen assets.
- [ ] **Load custom fonts** — The design system references Inter font family. Use `expo-font` to load Inter weights (Regular, Medium, SemiBold, Bold).
- [ ] **Test barcode scanning** — Barcode scanning requires a physical device (not simulator). Test with expo-camera on a real phone.
- [x] **Configure Telegram bot username** — Implemented via `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` env var.
- [ ] **Set up IAP** — Wire `react-native-purchases` or `expo-in-app-purchases` for subscription flows in `SubscriptionScreen.tsx`.

## Weekly Tracking Snapshot

| Week Of    | Planned Chunks | Completed      | Blocked | Notes                          |
| ---------- | -------------- | -------------- | ------- | ------------------------------ |
| 2026-03-04 | C-001..C-007   | C-001..C-007   |         | Foundation + auth + profile    |
| 2026-03-09 |                |                |         |                                |
| 2026-03-16 |                |                |         |                                |
| 2026-03-23 |                |                |         |                                |

## Maintenance Checklist

- [x] 2026-03-04: Mobile lint error cleanup pass completed (navigation + home/progress screen imports/unused vars).
- [x] 2026-03-04: Reduced manual setup by implementing Admin RBAC allowlist + mobile env-driven API base URL + Telegram bot username config.
- [x] 2026-03-05: CalAI-inspired UI redesign — dark-first aesthetic with gradient accents, circular macro indicators, redesigned HomeScreen/LogScreen/ProgressScreen/SettingsScreen/WeeklySummaryScreen/SearchScreen/TelegramConnectScreen/SubscriptionScreen, new CircularMacro component, enhanced ProgressRing with gradient support, dark tab bar.
- [x] 2026-03-05: Cal AI-style onboarding overhaul — 10-step progressive flow (Goal → DesiredWeight → WeeklyRate → Gender → BirthDate → Height → Weight → ActivityLevel → DietPreference → Motivation → TargetReview). Backend `POST /onboarding/complete` endpoint (transactional profile+target creation). Prisma schema updated: `weightKg`, `goalWeightKg`, `dietPreference`, `onboardingCompletedAt` on Profile. Shared constants for `Gender`, `ActivityLevel`, `DietPreference`. Diet-preference-aware macro calculator. Reusable `OnboardingLayout` component with progress bar.
- [x] 2026-03-05: QPay payment integration — Full QPay v2 API integration for Mongolian bank payments. Backend: `QPayService` (token management, invoice creation, payment verification), `QPayController` (POST /qpay/invoice, GET /qpay/callback, GET /qpay/invoice/:id/status), `QPayModule`. Prisma: `QPayInvoice` model tracking invoices. Env: `QPAY_API_URL`, `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE`. Mobile: Redesigned `SubscriptionScreen` with MNT pricing (19,900₮/month, 149,900₮/year), QPay QR code display, bank app deeplinks (Khan Bank, TDB, XacBank, etc.), payment status polling, success confirmation screen. Subscription model updated to support `qpay` provider.
- [x] 2026-03-05: MVP UAT readiness — Full E2E voice logging (expo-av + Google STT via GOOGLE_STT_API_KEY). Full E2E photo logging (OpenAI GPT-4o Vision via OPENAI_API_KEY). Real worker processors for STT, photo parsing, and Telegram reminders. SearchScreen navigates into TextSearch with pre-populated query. SettingsScreen wired: language/units pickers, edit profile name, delete account, export data. Telegram NLP food parsing with DB lookup, inline confirmation keyboard, and coaching queries (calories left/today). ~100 Mongolian food seed data (traditional, dairy, proteins, grains, vegetables, fruits, modern, snacks, supplements) with mn/en localizations. i18n integration (en/mn) into MainTabs, HomeScreen, LogScreen, SettingsScreen. Docker deployment (Dockerfile multi-stage + docker-compose with postgres, redis, typesense, api, worker).
