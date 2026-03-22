# Coach — Database Schema Registry

Complete catalog of every table in the system: what exists, what is missing for MVP launch, and what is planned for later tiers. Use this document to track schema progress and make build decisions.

**Status legend**

| Symbol | Meaning |
|---|---|
| ✅ | Exists in `schema.prisma` |
| 🚧 | Missing — needed before MVP launch |
| 📋 | Missing — planned feature (roadmap) |
| 💡 | Missing — future / v2 |

---

## Summary

| Status | Count |
|---|---|
| ✅ Exists | 33 |
| 🚧 MVP gap | 4 |
| 📋 Roadmap | 17 |
| 💡 Future | 6 |
| **Total** | **60** |

---

## Domain: Identity & Profile

| Table | Status | Purpose |
|---|---|---|
| `users` | ✅ | Core identity, Firebase UID anchor |
| `profiles` | ✅ | Display name, locale, body stats, diet preference |
| `targets` | ✅ | Calorie + macro targets with history; new record on each change |
| `consents` | ✅ | GDPR/health data consent records with version + IP |
| `privacy_requests` | ✅ | Export and deletion request tracking |

---

## Domain: Food Database

| Table | Status | Purpose |
|---|---|---|
| `foods` | ✅ | Master food record — name, locale, status, source type |
| `food_servings` | ✅ | Serving size definitions (label, grams per unit, default flag) |
| `food_nutrients` | ✅ | Macros per 100 g — calories, protein, carbs, fat, fiber |
| `food_aliases` | ✅ | Alternate names for search (handles spelling variants, Mongolian variants) |
| `food_localizations` | ✅ | Translated food names per locale |
| `food_sources` | ✅ | Where each food record came from — seed, import, user submission |
| `barcodes` | ✅ | Product barcode → food mapping |
| `meal_templates` | 💡 | User-saved multi-item meals (e.g., "My usual breakfast") for one-tap re-log |

**Note on `meal_templates`:** Different from `favorites` (single food) — a template is a full meal with 2–5 items that a user eats regularly. MyFitnessPal calls these "meals". High leverage for returning users because logging friction drops to one tap.

---

## Domain: Meal & Nutrition Logging

| Table | Status | Purpose |
|---|---|---|
| `meal_logs` | ✅ | Per-meal log with denormalized nutrition totals and source (photo/voice/text/barcode/telegram) |
| `meal_log_items` | ✅ | Individual food items per meal with immutable nutrition snapshot |
| `water_logs` | ✅ | Per-glass water intake with timestamp |
| `daily_summaries` | 🚧 | **See note below** |

### 🚧 `daily_summaries` — MVP gap

**What it stores:** One row per user per calendar day. Calories consumed, protein, carbs, fat, water_ml, meals_count, calorie_goal_met (bool), protein_goal_met (bool), water_goal_met (bool).

**Why it's missing matters:** Today every request that needs "how did this user do this week" must join across `meal_logs`, `meal_log_items`, and `water_logs` with a GROUP BY DATE. This works fine at 10 users and breaks at 10,000. More importantly, the coach context computation, weekly report generation, streak detection, and leaderboard all need this aggregation — they all run it independently right now.

**How premium apps handle this:** Materialized/cached daily rollups. Written on every `POST /meal-logs` write and every `POST /water-logs` write via an upsert (not recomputed from scratch). Zero read latency. The row for "today" is always fresh because it updates inline with the user's action.

**Fields:** `user_id`, `date`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `water_ml`, `meals_count`, `calorie_goal_met`, `water_goal_met`, `created_at`, `updated_at`

---

## Domain: Weight & Workout

| Table | Status | Purpose |
|---|---|---|
| `weight_logs` | ✅ | Daily weight entries with date-unique constraint per user |
| `workout_logs` | ✅ | Workout sessions — type, duration, note. Exists but is underbuilt (see below) |
| `exercises` | 📋 | Exercise library — name (mn/en), category, equipment, MET value, muscle groups |
| `workout_set_logs` | 📋 | Granular sets × reps × weight per exercise within a session. Current `workout_logs` only stores type + duration — not enough for strength tracking |
| `workout_plan_templates` | 📋 | Pre-built workout plans (name, description, total_weeks, days_per_week) |
| `workout_plan_days` | 📋 | Per-day exercise schedule within a plan |
| `user_active_plans` | 📋 | Which plan a user has activated + current week + current day |
| `activity_logs` | 📋 | Daily step count + active_energy_burned pulled from Apple Health / Google Fit |

**Note on `workout_logs`:** The existing model stores workout type and duration — sufficient for "did they work out today" but not for progressive overload tracking, volume analysis, or muscle group balance. `workout_set_logs` is the missing layer between a session and individual sets.

---

## Domain: AI & Coaching

| Table | Status | Purpose |
|---|---|---|
| `ai_parse_results` | ✅ | Food parsing results from photo/voice/text with confidence + user edits |
| `coach_memories` | ✅ | 30-day GPT-summarized user patterns (food preferences, habits, goals) injected into prompts |
| `outbound_messages` | ✅ | Every message sent to users — channel, content, AI metadata (tokens, latency), delivery status |
| `voice_drafts` | ✅ | Temporary voice processing state (S3 key, transcription, parsed items, expiry) |
| `chat_messages` | 🚧 | **See note below** |

### 🚧 `chat_messages` — MVP gap (the #1 missing table for quality visibility)

**What it stores:** Every message in every coaching conversation — both user messages and coach replies. `user_id`, `role` (user/assistant), `content`, `channel` (app/telegram), `message_type` (chat/proactive/food_log_confirmation), `token_count`, `sent_at`.

**Why the gap exists:** Chat history is currently stored only in Redis with a 7-day TTL. This means:
- Conversations disappear after a week — you can never go back and read them
- You have `outbound_messages` for proactive coach messages but no record of what users asked or how the coach responded in conversation
- You can't analyze what questions users ask most frequently
- You can't audit coach reply quality per topic
- The coach memory job summarizes 30 days of logs — but the actual conversation it should also summarize is lost

**What premium apps do:** Persist every message to a `chat_messages` table. Redis remains the hot path (low-latency history for the active session), but every message also writes async to Postgres. This gives you a permanent, queryable conversation log. You can then run admin queries like "show me all coach responses to questions about Mongolian food" or "which users haven't had a real conversation in 14 days."

**Fields:** `id`, `user_id`, `role` (user/assistant), `channel` (app/telegram), `content`, `message_type` (chat/proactive/food_confirmation), `ai_model`, `prompt_tokens`, `completion_tokens`, `generation_ms`, `parent_message_id` (nullable, for threading), `created_at`

**Index on:** `user_id + created_at`, `channel`, `role + created_at` (for admin review)

---

## Domain: Engagement & Gamification

| Table | Status | Purpose |
|---|---|---|
| `user_stats` | 🚧 | **See note below** |
| `daily_check_ins` | 📋 | End-of-day mood (1–5) + energy (1–5) + optional note |
| `progress_photos` | 📋 | Body progress photos — S3 key, taken_at, weight_kg snapshot for side-by-side comparison |
| `challenges` | 📋 | Weekly coach-generated challenges (type, target_value, start/end dates) |
| `challenge_progress` | 📋 | Per-user daily completion record on an active challenge |
| `user_badges` | 📋 | Earned achievement badges — type, earned_at, displayed flag |

### 🚧 `user_stats` — MVP gap

**What it stores:** One row per user. Current streak, longest streak, total days logged, last_logged_at, 7-day consistency %, 30-day consistency %, leaderboard_opt_in flag.

**Why it's a gap:** The roadmap Tier 1 item 3 (Streak & consistency score) is a UI card that requires this data. Without the table, every streak query does a full scan of `meal_logs` grouped by date — which is fine at launch but becomes expensive with daily crons and coach context reads at scale. The right pattern is: increment/update `user_stats` inside the same transaction as `POST /meal-logs`. Single write, zero read cost thereafter.

**Why premium apps have this:** Duolingo, MyFitnessPal, Headspace — every habit app maintains a streak counter as a first-class entity. It's the single most-displayed number in the app and the primary driver of daily retention. It should never require a JOIN to display.

**Fields:** `user_id` (unique), `current_streak`, `longest_streak`, `total_logged_days`, `last_logged_at`, `consistency_7d` (%), `consistency_30d` (%), `leaderboard_opt_in`, `updated_at`

---

## Domain: Health & Biometrics

| Table | Status | Purpose |
|---|---|---|
| `biometric_logs` | 📋 | Blood glucose (mmol/L), blood pressure (systolic/diastolic), HRV (ms), resting heart rate — generic metric+value design |
| `sleep_logs` | 📋 | Sleep duration (hours) + quality (1–5) + source (manual/apple_health) |
| `cycle_logs` | 📋 | Menstrual cycle start dates for phase detection; phase injected into coach system prompt |
| `supplements` | 📋 | User-defined supplement list — name, dose, timing (morning/noon/evening) |
| `supplement_logs` | 📋 | Daily check-off per supplement |

**Note on `biometric_logs` design:** Use a generic `metric` enum (`blood_glucose`, `blood_pressure_systolic`, etc.) + `value` float rather than separate columns per metric. This avoids schema migrations every time a new biometric type is added. Same pattern as `AnalyticsEvent` in this codebase.

---

## Domain: Social & Accountability

| Table | Status | Purpose |
|---|---|---|
| `accountability_pairs` | 📋 | Linked user pairs + shared Telegram group chat ID for daily summary fan-out |

---

## Domain: Subscriptions & Payments

| Table | Status | Purpose |
|---|---|---|
| `subscriptions` | ✅ | Current tier (free/pro), status, provider, period dates |
| `subscription_ledger` | ✅ | Immutable event log — started, renewed, canceled, refunded |
| `qpay_invoices` | ✅ | QPay invoice lifecycle — QR code, status, paid_at |
| `referral_codes` | 💡 | Unique referral code per user + usage count |
| `referral_events` | 💡 | Who referred whom, signup_at, reward type, granted_at |

---

## Domain: Notifications & Messaging

| Table | Status | Purpose |
|---|---|---|
| `telegram_links` | ✅ | Telegram ↔ app user binding — chatId, username, active flag |
| `notification_preferences` | ✅ | Channel preferences, quiet hours, timezone |
| `device_tokens` | ✅ | Expo push tokens per device — platform, active flag |
| `outbound_messages` | ✅ | Full outbound log — content, channel, type, AI metadata, delivery status |

---

## Domain: Platform & Operations

| Table | Status | Purpose |
|---|---|---|
| `moderation_queue` | ✅ | Pending food / barcode submissions awaiting admin review |
| `audit_logs` | ✅ | Admin action history with actor, action, entity, changes |
| `analytics_events` | ✅ | Raw event stream for PostHog fan-out (onboarding_completed, first_meal_logged, etc.) |
| `outbox_events` | ✅ | Transactional outbox for reliable event publishing |
| `idempotency_keys` | ✅ | External event deduplication (Telegram update_id, QPay webhook, Apple IAP) |
| `feature_flags` | 💡 | Per-feature enable/disable with optional user_id override for gradual rollout |
| `app_config` | 💡 | Remote config (min_app_version, maintenance_mode, announcement_banner) — avoids app store update for config changes |

---

## MVP Launch Gaps — Priority Order

These 4 tables are the highest-leverage missing pieces before launch. Everything else is a roadmap feature.

### 1. `chat_messages` — highest priority

The coach is the core product differentiator. Right now you can't read a conversation you had with a user two weeks ago. You can't improve the coach without seeing what it said. You can't build the coach memory feature to its full potential. This is the most important missing table.

**Build now:** Write every chat message to this table in addition to Redis. Redis stays the hot path. Postgres is the durable record.

### 2. `daily_summaries` — before you hit 500 users

Right now every coach context build, weekly report job, streak calculation, and admin stats query joins `meal_logs` at runtime. This will become the slowest query in the system as you scale. The fix is a materialized daily rollup maintained with every log write.

**Build now:** Add the table and update `POST /meal-logs` and `POST /water-logs` to upsert the summary row inline. One extra write per user action; eliminates scan aggregation everywhere else.

### 3. `user_stats` — before Tier 1 streak feature ships

The streak card is Roadmap Tier 1 item 3. You can't display a streak without a streak table. Computed-on-demand streaks are fine for < 200 users; they're a problem at 2,000.

**Build with the streak feature.**

### 4. `exercises` — before workout logging UI ships

The `WorkoutLog` table exists but the exercise library doesn't. You can't build the `ExercisePickerScreen` without it. This is a data task: schema + 200-item seed file.

**Build when starting Tier 2.**

---

## What Premium Apps Track That This App Doesn't Yet

Beyond the missing tables, here are the data signals that top-tier nutrition apps (Noom, Fastic, MacroFactor) use that Coach should eventually collect:

| Signal | Missing table | Why it matters |
|---|---|---|
| Full conversation history | `chat_messages` | Coach quality review, memory improvement, churn signals |
| Daily nutrition rollups | `daily_summaries` | All trend analysis, coach context, performance |
| Mood + energy correlation | `daily_check_ins` | "Your energy is highest when you hit protein targets" — GPT insight |
| Body progress over time | `progress_photos` | Strongest visual motivation in fitness apps, high shareability |
| Sleep correlation | `sleep_logs` | "You log fewer meals the day after poor sleep" |
| Supplement adherence | `supplements` + `supplement_logs` | Upsell surface, retention loop, coach coaching |
| Streak as first-class entity | `user_stats` | Displayed on every screen, drives daily opens |
| Calorie quality (not just quantity) | (column on `meal_logs`) | `quality_score` per meal — protein density, fiber, processing level |
| Exercise granularity | `workout_set_logs` | Progressive overload tracking — the core of any serious training app |

---

> Last updated: March 2026
