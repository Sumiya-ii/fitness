# Coach Requirements (Single Source of Truth)

Document status: Draft for implementation
Version: 1.0
Last updated: 2026-03-04
Owner: Product (you)
Primary consumers: Engineering, Design, QA, Data

## 1. Purpose

This document is the single source of truth for building **Coach**, an AI-enabled nutrition and training app for Mongolian users.

It defines:

- What we are building now (`v1` MVP)
- What is explicitly deferred (`v1.5+` and `v2`)
- Testable requirements and acceptance criteria
- Non-functional constraints (performance, privacy, reliability)
- Delivery plan, risks, and decision/change log

## 2. Product Vision

Coach helps users log food quickly (text/barcode/voice/photo) and receive daily, actionable calorie/macro + training guidance, with Telegram accountability.

## 3. Product Goals and Non-Goals

### 3.1 Goals (v1)

- Make food logging fast enough for daily use.
- Support Mongolian language and local foods from day one.
- Deliver Telegram-based check-ins and basic coaching.
- Support fat-loss, maintenance, and muscle-gain targets.

### 3.2 Non-goals (v1)

- Medical diagnosis or treatment advice.
- Fully automatic photo logging without user confirmation.
- Advanced adaptive metabolism engine (MacroFactor-level).
- Full smartwatch and wearable ecosystem integrations.

## 4. Target Users

- Beginner fat-loss users who need simple tracking.
- Gym lifters who care about macros/protein and progression.
- Busy users who prefer voice + Telegram interactions.
- Mongolian-language-first users needing local food support.

## 5. Release Scope and Boundaries

### 5.1 v1 MVP (must ship)

- Auth (email/phone OTP, Google, Apple)
- Profile + goal setup
- Calorie/macro target generation (rule-based)
- Food logging: text, quick add, favorites/recent, barcode
- Voice logging (in-app and Telegram) with confirmation before save
- Photo logging (capture/upload + assisted estimate + mandatory confirmation)
- Local-first food database (seed Mongolian foods + packaged SKUs)
- Daily dashboard (calories/macros/protein)
- Weight logging + trend
- Telegram account linking + daily reminders + meal logging
- Freemium subscription gating
- Admin moderation for foods/barcodes

### 5.2 v1.5 (next after MVP)

- Recipe URL import
- Meal templates improvements
- Better coaching prompts and localized content packs
- Basic step integration (Apple Health/Google Fit)

### 5.3 v2 (deferred)

- Program builder with generated training plans
- Adaptive expenditure engine from trend data
- Smart insights/correlation engine
- Community/challenges

## 6. Core Functional Requirements (testable)

Each item has an ID for implementation and QA traceability.

### 6.1 Identity and Profile

- `FR-001` User can create/sign in via email OTP, phone OTP, Google, Apple.
  - Acceptance: Auth success rate >= 99% on valid attempts in staging load tests.
- `FR-002` User can sign out and re-open app with persisted valid session.
- `FR-003` User can set language (`mn`, `en`) and units (metric default, imperial optional).

### 6.2 Goals and Targets

- `FR-010` User can set goal: lose fat / maintain / gain.
- `FR-011` User can set weekly target rate and macro preference.
- `FR-012` System computes calorie target from profile + activity using a documented formula.
- `FR-013` System enforces protein minimum guardrail (g/kg) and adjusts remaining macros.
- `FR-014` Weekly check-in updates targets by defined rule set (no ML required in v1).

### 6.3 Food Logging

- `FR-020` Text search returns foods with serving options and macro totals before save.
- `FR-021` User can quick-add calories/macros without food lookup.
- `FR-022` Barcode scan logs known product in <= 2 confirmation steps.
- `FR-023` If barcode unknown, user can submit product with label photos and nutrition fields.
- `FR-024` Voice logging (mn/en) creates editable draft; only confirmed drafts are saved.
- `FR-025` Photo logging creates editable draft with confidence display; save requires confirmation.
- `FR-026` User can save meals as templates and re-log in one action.
- `FR-027` Favorites and recents are available from log screen.

### 6.4 Dashboard and Progress

- `FR-030` Daily dashboard shows calories/macros consumed and remaining.
- `FR-031` Protein progress is visually emphasized.
- `FR-032` User can log weight; trend chart supports daily/weekly view.
- `FR-033` Weekly summary shows average calories, protein, adherence, and weight trend delta.

### 6.5 Telegram Coach

- `FR-040` User can link Telegram account through one-time code flow.
- `FR-041` Telegram text messages can create food-log draft and request confirmation.
- `FR-042` Telegram voice notes are transcribed, parsed, and returned for confirmation.
- `FR-043` Telegram bot answers “calories left / what to eat next” using current day data.
- `FR-044` Morning and evening reminders are configurable and localized.
- `FR-045` Telegram ingestion is idempotent (duplicate delivery does not create duplicate logs).

### 6.6 Subscription and Access Control

- `FR-050` Free tier includes manual logging + basic dashboard.
- `FR-051` Pro tier gates voice/photo AI and advanced Telegram coaching.
- `FR-052` Subscription status updates entitlement within 60 seconds of payment event.

### 6.7 Admin and Moderation

- `FR-060` Admin can create/update/delete foods, servings, and barcode links.
- `FR-061` Admin can verify foods and merge duplicates.
- `FR-062` User-submitted products enter moderation queue with audit log.

## 7. Non-Functional Requirements

### 7.1 Performance

- `NFR-001` For favorites/recent flow, meal logging completion median <= 15s.
- `NFR-002` API p95 latency <= 500ms for read endpoints under expected MVP load.
- `NFR-003` Dashboard first meaningful load <= 2.5s on mid-tier mobile network.

### 7.2 Reliability

- `NFR-010` Core logging API availability >= 99.9% monthly.
- `NFR-011` Async jobs (voice/photo parsing) use durable queue with retry + dead-letter queue.
- `NFR-012` Idempotency keys required for Telegram and payment webhooks.

### 7.3 Security and Privacy

- `NFR-020` TLS in transit and encryption at rest for health-related data.
- `NFR-021` Explicit consent required for health data processing.
- `NFR-022` User can export data (JSON/CSV) and delete account from settings.
- `NFR-023` Role-based access control for admin tools.
- `NFR-024` Data retention policy documented and enforced in code/jobs.

### 7.4 Compliance

- `NFR-030` Implement controls compatible with Mongolia PDPL obligations (consent, access, deletion).
- `NFR-031` Legal/privacy copy must be reviewed before production release.

## 8. AI and Safety Requirements

- `AIR-001` All AI-derived logs are assistive drafts, never auto-finalized.
- `AIR-002` UI must show confidence or uncertainty for voice/photo parsing.
- `AIR-003` Coach must avoid medical claims and include escalation guidance for medical conditions.
- `AIR-004` Prompts and outputs must support Mongolian-first language quality checks.

## 9. Data Model (MVP minimum)

### 9.1 Core entities

- `users`
- `profiles`
- `targets`
- `foods`
- `food_servings`
- `food_nutrients`
- `food_aliases`
- `food_localizations`
- `food_sources`
- `barcodes`
- `meal_logs`
- `meal_log_items`
- `weight_logs`
- `workout_logs` (basic)
- `telegram_links`
- `notification_preferences`
- `device_tokens`
- `subscriptions`
- `subscription_ledger`
- `moderation_queue`
- `consents`
- `privacy_requests`
- `idempotency_keys`
- `ai_parse_results`
- `outbox_events`
- `audit_logs`
- `analytics_events`

### 9.2 Required relationships

- One `user` has one `profile`, many `targets`, many `meal_logs`, many `weight_logs`.
- One `meal_log` has many `meal_log_items`; each item points to a food snapshot record.
- One `food` has many `food_servings`, `food_nutrients`, aliases, localizations, and optional barcodes.
- One `subscription` has many `subscription_ledger` events.
- One submitted food/product must have moderation state and audit trail.

### 9.3 Modeling rules

- Nutrition is normalized per 100g and converted using serving mappings.
- Log entries must persist immutable nutrition snapshots at log time.
- User-generated foods must store provenance (`source_type`, `source_ref`, confidence, verifier).
- All external webhook/bot events must be deduplicated by `idempotency_keys`.
- AI pipelines must store input/output, confidence, model version, and user edits in `ai_parse_results`.
- Consent text version accepted by user must be stored in `consents`.
- Data export/deletion flows must be tracked in `privacy_requests` with timestamps and status.

### 9.4 Indexing and constraints (minimum)

- Unique index: `barcodes(code)`.
- Unique index: active `telegram_links(telegram_user_id)`.
- Unique index: `idempotency_keys(external_system, external_event_id)`.
- Composite index: `meal_logs(user_id, logged_at desc)`.
- Composite index: `meal_log_items(meal_log_id, created_at)`.
- Composite index: `foods(locale, normalized_name)`.
- Foreign keys required on all parent-child relations above.

## 10. Analytics and KPIs

### 10.1 Product KPIs (MVP)

- Day-7 retention
- Logs per active user per day
- % users with >= 5 logged days in first 14 days
- Median meal-log completion time
- Telegram-linked user conversion rate
- Free-to-Pro conversion

### 10.2 Required event instrumentation

- `onboarding_completed`
- `target_generated`
- `meal_log_started`
- `meal_log_saved`
- `voice_log_processed`
- `photo_log_processed`
- `telegram_linked`
- `weekly_checkin_completed`
- `subscription_started`
- `subscription_canceled`

## 11. Delivery Plan with Exit Criteria

### Phase 0: Spec + Architecture lock (1-2 weeks)

Exit criteria:

- Architecture diagram approved
- Data model reviewed
- v1 backlog estimated

### Phase 1: Core MVP foundation

Exit criteria:

- Auth/profile/targets/logging API complete
- Mobile onboarding + manual logging + dashboard functional
- Admin food CRUD functional

### Phase 2: Market-baseline features

Exit criteria:

- Barcode scan and unknown barcode submission live
- Favorites/recents/templates live
- Weekly summaries live

### Phase 3: Differentiator

Exit criteria:

- Telegram link + text/voice logging live
- Reminder routines live
- Idempotency and queue handling tested

### Phase 4: AI assist quality upgrade

Exit criteria:

- Photo assist flow with confidence and explicit confirmation live
- Coaching response quality pass for mn/en test set

## 12. Risks and Mitigations

- Food DB coverage risk
  - Mitigation: start with curated Mongolian seed list + top SKUs + moderation SLA.
- Voice parsing quality risk (Mongolian quantities/slang)
  - Mitigation: require confirmation, build phrase dictionary, continuous parser eval set.
- Photo estimation trust risk
  - Mitigation: treat as draft only, always user-confirmed, clear uncertainty UX.
- Telegram retry/duplicate risk
  - Mitigation: idempotency keys + dedupe window + webhook replay tests.
- Compliance risk
  - Mitigation: privacy-by-design checklist in definition of done.

## 13. Definition of Done (applies to every feature)

- Acceptance criteria mapped to test cases
- Unit/integration tests passing
- Analytics events emitted and validated
- Security/privacy checks completed
- Copy localized for Mongolian and English
- Documentation updated in this file

## 14. Work Tracking (living section)

Use this table to keep implementation aligned with this spec.

| ID      | Requirement          | Owner | Status      | Target Sprint | Notes |
| ------- | -------------------- | ----- | ----------- | ------------- | ----- |
| FR-001  | Multi-provider auth  | TBD   | Not Started | TBD           |       |
| FR-020  | Text food logging    | TBD   | Not Started | TBD           |       |
| FR-022  | Barcode scan         | TBD   | Not Started | TBD           |       |
| FR-024  | In-app voice logging | TBD   | Not Started | TBD           |       |
| FR-040  | Telegram linking     | TBD   | Not Started | TBD           |       |
| FR-045  | Telegram idempotency | TBD   | Not Started | TBD           |       |
| FR-050  | Free vs Pro gating   | TBD   | Not Started | TBD           |       |
| NFR-001 | <=15s log flow       | TBD   | Not Started | TBD           |       |

Status values allowed: `Not Started`, `In Progress`, `Blocked`, `QA`, `Done`

## 15. Decision Log (living section)

Record major scope/architecture decisions here. Do not delete old decisions.

| Date       | Decision                                 | Why                            | Impact                       |
| ---------- | ---------------------------------------- | ------------------------------ | ---------------------------- |
| 2026-03-04 | v1 photo logging is assistive draft only | Accuracy and trust constraints | Lower risk, faster launch    |
| 2026-03-04 | Telegram is core MVP differentiator      | Market positioning             | Backend complexity increases |

## 16. Open Issues (must resolve before production)

- Finalize STT contracts and benchmark quality/latency/cost for Google (`mn-MN`) and Chimege fallback.
- Decide exact subscription price points and trial policy.
- Confirm initial seeded Mongolian food list and barcode acquisition plan.
- Define legal-approved privacy/consent copy and retention durations.
- Confirm if workout logging remains in MVP or shifts to v1.5 if timeline slips.

## 17. Reference Architecture and Tech Stack (v1 baseline)

This is the default stack unless an explicit decision is logged in Section 15.

### 17.1 Architecture style

- Modular monolith for MVP (single deployable backend, clear domain modules).
- Async processing for voice/photo/parsing and notification workloads.
- Event-driven integrations for Telegram, payments, analytics via outbox pattern.

### 17.2 Recommended stack

- Mobile app: `React Native (TypeScript)` with shared schema/types.
- Backend API: `NestJS (TypeScript)` with REST endpoints; background workers in same repo.
- Primary database: `PostgreSQL` (managed, daily backups, point-in-time recovery).
- Cache and queue broker: `Redis` (rate limit, sessions, BullMQ queues, idempotency helpers).
- Background jobs: `BullMQ` workers for STT/photo parsing, reminders, webhook retries.
- Object storage: `S3-compatible` bucket for audio/images and user-uploaded labels.
- Search engine: `Typesense` for food lookup/autocomplete/synonyms (mn/en).
- Auth: `Firebase Auth` or equivalent managed auth (OTP + Google + Apple).
- Analytics/product telemetry: `PostHog`.
- Observability: `OpenTelemetry` + centralized logs + error tracking (`Sentry`).
- CI/CD and infra: `GitHub Actions`, `Docker`, `Terraform`.

### 17.3 Data and API best practices

- Use migration tool (`Prisma Migrate` or equivalent) with versioned SQL in git.
- Require idempotency keys on Telegram, payment, and other external write endpoints.
- Use optimistic locking or version columns on mutable aggregate records.
- Keep API contracts versioned (`/v1`) and documented with OpenAPI.
- Enforce server-side validation with shared schemas (Zod/class-validator).

### 17.4 Security and privacy best practices

- Secrets stored in managed secret manager; never in source code.
- Row-level authorization checks on every user-owned resource.
- Encrypt sensitive data fields where needed in addition to disk-level encryption.
- Signed URL access for private media objects; short expiration.
- Maintain audit logs for admin actions, moderation actions, and data exports/deletions.

### 17.5 Scalability guidance

- Scale read-heavy flows first: cache food search and recents aggressively.
- Keep PostgreSQL as source of truth; avoid introducing a second primary database in v1.
- Avoid microservices before clear bottlenecks; split services only after measured constraints.
- If queue volume grows, move workers to separate autoscaled process group.

### 17.6 Recommended provider choices for v1

- STT primary: Google Speech-to-Text (`mn-MN`).
- STT fallback: Chimege API for Mongolian-specific recovery path.
- Payments: App Store/Google Play first; web/off-store only after legal/tax review.
