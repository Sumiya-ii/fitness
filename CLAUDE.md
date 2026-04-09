# Coach — Agent Instructions

## Project overview

**Coach** is an AI-enabled nutrition and training mobile app for Mongolian users.

```
apps/
  mobile/    — React Native + Expo (@coach/mobile)
  api/       — NestJS REST API (@coach/api)
  worker/    — BullMQ background job processor (@coach/worker)
packages/
  shared/    — Shared Zod schemas, types, constants (@coach/shared)
```

## Git workflow

- **Commit and push directly to `main`**. No feature branches or PRs unless explicitly asked.
- Commit frequently after each logical change.

## Tech stack

| Layer         | Technology                                                              |
| ------------- | ----------------------------------------------------------------------- |
| Mobile        | React Native 0.83, Expo ~55, NativeWind 4, Zustand, React Navigation 7  |
| API           | NestJS 10, Prisma 5 + PostgreSQL 16, Redis 7, Firebase Admin            |
| AI            | OpenAI GPT-4 Vision (food photos), Google Speech-to-Text / Chimege STT  |
| Queue         | BullMQ (via Redis)                                                      |
| Auth          | Firebase Authentication (global guard, all routes protected by default) |
| Payments      | QPay (Mongolia)                                                         |
| Observability | Sentry, Pino structured logging, OpenTelemetry                          |

## Commands

```bash
# ── Workspace-scoped commands ────────────────────────────
npm run lint --workspace=apps/api
npm run typecheck --workspace=apps/api
npm run test --workspace=apps/api
npm run build --workspace=apps/api
npm run format                              # prettier --write (all)
npm run db:migrate --workspace=apps/api     # run pending migrations
npm run db:generate --workspace=apps/api    # regenerate Prisma client
npm run test --workspaces                   # all tests (same as CI)

# ── Mobile (Expo) ────────────────────────────────────────
cd apps/mobile
npx expo start --tunnel                     # dev server (tunnel mode default)
npx expo prebuild --clean                   # regenerate native projects
eas build --profile development --platform ios   # dev client build
eas build --profile production --platform ios    # production build
eas submit --platform ios                        # submit to TestFlight
eas update --branch production                   # OTA update via expo-updates

# ── API (NestJS) ─────────────────────────────────────────
npm run start:dev --workspace=apps/api      # dev server with watch
npm run test:e2e --workspace=apps/api       # API integration tests

# ── Worker (BullMQ) ──────────────────────────────────────
npm run start:dev --workspace=apps/worker   # worker dev with watch

# ── Docker (local infra) ─────────────────────────────────
docker compose up -d                        # postgres, redis, typesense
docker compose down                         # stop all services

# ── Quality gates (run before push) ──────────────────────
npm run lint && npm run typecheck && npm run test --workspaces

# ── Maestro E2E (mobile) ─────────────────────────────────
npm run test:e2e:mobile                     # runs maestro/flows/*.yaml
```

## Code style

- **TypeScript strict mode** everywhere. No `any` without justification.
- **Prettier**: singleQuote, semi, trailingComma: all, printWidth: 100, tabWidth: 2.
- **ESLint** with `@typescript-eslint`; unused vars prefixed with `_` are allowed.
- **File naming**: kebab-case everywhere (e.g., `meal-logs.service.ts`, `use-auth-store.ts`).

## Hard rules — violating these causes bugs

1. **Never add dependencies** without asking first. Check if an existing dep already solves it.
2. **Never use relative imports across workspace boundaries** — always `@coach/shared`.
3. **All API responses** must use `{ data: T }` envelope. Errors are `{ statusCode, message, requestId }`.
4. **Zod for all validation** — no `class-validator`, no NestJS `ValidationPipe`. Parse with `schema.safeParse(body)` in controllers, throw `BadRequestException(parsed.error.issues)` on failure.
5. **Controllers are thin** — validate input with Zod, delegate to service, return `{ data }`. Zero business logic.
6. **All business logic lives in services** — computations, DB queries, side effects.
7. **`@CurrentUser()` for auth context** — never read `req.user` directly. All data-access services must scope queries to `user.id`.
8. **Routes are protected by default** (global `AuthGuard`). Use `@Public()` only for webhooks, health checks.
9. **Prisma Decimal fields** must be converted with `Number()` before returning — Prisma returns `Decimal` objects, not numbers.
10. **Dates returned from API** must be ISO strings. Use `.toISOString().split('T')[0]` for date-only fields.
11. **NativeWind only** for mobile styling — use `className`, never `StyleSheet.create()` or inline styles.
12. **Zustand** for mobile state — no Redux, no Context for state management.
13. **Never call real external services in tests** — Firebase, OpenAI, QPay, Typesense must be mocked at the boundary.
14. **Conditional Prisma updates** use spread: `...(dto.field !== undefined && { field: value })`.

## API patterns (follow exactly)

```typescript
// ── Controller ──────────────────────────────────────
@Post()
async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException(parsed.error.issues);
  return { data: await this.service.create(user.id, parsed.data) };
}

// ── Service ─────────────────────────────────────────
@Injectable()
export class FooService {
  constructor(private readonly prisma: PrismaService) {}
  // All DB queries scoped to userId
}

// ── DTO ─────────────────────────────────────────────
export const createSchema = z.object({ ... });
export type CreateDto = z.infer<typeof createSchema>;

// ── Module ──────────────────────────────────────────
@Module({
  controllers: [FooController],
  providers: [FooService],
  exports: [FooService],
})
```

## Prisma conventions

- IDs: `String @id @default(uuid()) @db.Uuid`
- Columns: camelCase in TS, snake_case in DB via `@map("snake_case")`
- Tables: PascalCase model, snake_case via `@@map("table_name")`
- Relations: cascade deletes where parent owns child
- Indexes: composite indexes on common query patterns (`@@index([userId, createdAt(sort: Desc)])`)
- After schema changes: always run `npm run db:generate --workspace=apps/api`

## Mobile patterns

- **Navigation**: React Navigation 7 with typed `NativeStackScreenProps<ParamList, 'ScreenName'>`
- **Screens**: feature-organized under `apps/mobile/app/`
- **State**: Zustand `create<State>((set, get) => ({ ... }))` with AsyncStorage caching
- **Hooks**: `useColors()` for theme, `useLocale()` for i18n, `useProGate()` for subscription
- **Screen lifecycle**: `useFocusEffect(useCallback(() => { ... }, []))` — not `useEffect`
- **API calls**: use the `api` client from `src/api/client.ts` — never raw `fetch`
- **i18n**: all user-facing strings through translation keys (Mongolian + English)

## Testing

**Stack**: Jest 29 + ts-jest. CI runs `npm run test --workspaces` on every push.

**When to test**:

- Pure logic (calculators, parsers, validators): always unit test
- NestJS services: co-located `*.spec.ts`, mock PrismaService as plain object of jest.Mock
- Zustand stores: test via `.setState()` / `.getState()`
- Worker processors: co-located `*.spec.ts` for each processor (see below)
- Queue dispatcher: routing test in `apps/worker/src/processors/index.spec.ts`
- UI screens: skip unless non-trivial branching logic
- No testable behavior (styling, config): note "not test-worthy" in commit

**Mock conventions**:

- Mobile native modules: globally stubbed via `moduleNameMapper` in `jest.config.js`
- API client in mobile: `jest.mock('../api/client', () => ({ api: { get: jest.fn(), ... } }))`
- Firebase auth: mock whole module; include `configureGoogleSignIn: jest.fn()` and `subscribeToTokenRefresh: jest.fn(() => jest.fn())`
- PrismaService in API: inline plain object of `jest.Mock` (see `auth.service.spec.ts`)

### Worker processor test requirements

Every worker processor **must** have a co-located `*.spec.ts` with tests covering these categories:

1. **Missing env vars**: return early / skip when `OPENAI_API_KEY`, `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, etc. are unset
2. **Happy path**: mock all external deps, verify correct API calls, delivery, and return values
3. **Both delivery channels**: test Telegram and Push independently and together
4. **No deliverable channels**: skip gracefully when chatId missing, pushTokens empty, or channels list empty
5. **Locale handling**: test `mn` (default), `en`, undefined locale, and unknown locale (should fallback)
6. **AI fallbacks**: null/empty GPT response content → processor uses static fallback message
7. **External service errors**: OpenAI failure, Telegram failure, Push failure → correct error logging, no crash
8. **Error logging**: verify `logMessage()` called with `status: 'failed'` and `errorMessage` on delivery errors
9. **Edge case data**: null/undefined optional fields, empty arrays, boundary values (confidence 0/1, zero kcal)

**Worker mock patterns** (follow for all processors):

```typescript
// OpenAI — mock the default export constructor
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

// Telegraf — mock bot constructor
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: { sendMessage: jest.fn().mockResolvedValue(undefined) },
  })),
}));

// Redis — mock with stateful store
const mockRedis = { get: jest.fn(), setex: jest.fn(), disconnect: jest.fn() };
jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));

// PostgreSQL — mock Pool for coach-memory and similar
const mockPoolQuery = jest.fn();
jest.mock('pg', () => ({ Pool: jest.fn().mockImplementation(() => ({ query: mockPoolQuery, end: jest.fn() })) }));

// Shared worker services — always mock at module level
jest.mock('../expo-push', () => ({ sendExpoPush: jest.fn() }));
jest.mock('../message-log.service', () => ({ logMessage: jest.fn() }));
jest.mock('../s3', () => ({ downloadFromS3: jest.fn(), deleteFromS3: jest.fn() }));
jest.mock('../db', () => ({ setVoiceDraftActive: jest.fn(), setVoiceDraftCompleted: jest.fn(), setVoiceDraftFailed: jest.fn() }));

// Environment — save/restore in beforeEach/afterEach
let originalEnv: NodeJS.ProcessEnv;
beforeEach(() => { originalEnv = { ...process.env }; process.env.OPENAI_API_KEY = 'test-key'; });
afterEach(() => { process.env = originalEnv; jest.restoreAllMocks(); });
```

**When adding a new worker processor**: create the spec file immediately with all 9 test categories above. Do not merge a processor without tests.

## Environment variables

Copy `.env.example` to `.env` in repo root. Mobile env vars prefixed `EXPO_PUBLIC_*` in `apps/mobile/.env`.

## Deployment & Infrastructure

### Hosting

| Service   | Platform    | Config file          | Notes                                      |
| --------- | ----------- | -------------------- | ------------------------------------------ |
| API       | Railway     | `railway.toml`       | Auto-deploys on push to `main`             |
| Worker    | Railway     | `apps/worker/railway.toml` | Separate Railway service              |
| Database  | Railway     | —                    | PostgreSQL 16, internal networking          |
| Redis     | Railway     | —                    | Redis 7 for BullMQ + caching               |
| Mobile    | Expo / EAS  | `apps/mobile/eas.json` | TestFlight (iOS), EAS Build + Submit      |

### CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — runs on push/PR to `main`: lint, typecheck, test, e2e, format check
- **`.github/workflows/daily-monitor.yml`** — daily at 6 AM UTC: pulls Railway logs, runs DB analysis, emails report, commits to `reports/daily-monitor/`

### Mobile release process

```bash
# 1. Build for TestFlight
eas build --profile production --platform ios

# 2. Submit to TestFlight
eas submit --platform ios

# 3. OTA update (JS-only changes, no native module changes)
eas update --branch production --message "description of change"
```

- iOS bundle ID: `com.coach.mobile`
- Apple Team ID: `DZ9RLGDX2M`
- Current iOS build number: **17**
- EAS project ID: `cf5c8344-d39a-4869-b00f-69b8720bfea8`

### Local development setup

```bash
# 1. Clone and install
git clone https://github.com/Sumiya-ii/fitness.git && cd fitness
cp .env.example .env   # fill in secrets
npm ci

# 2. Start infrastructure
docker compose up -d    # postgres, redis, typesense

# 3. Set up database
npm run db:generate --workspace=apps/api
npm run db:migrate --workspace=apps/api

# 4. Start services (in separate terminals)
npm run start:dev --workspace=apps/api
npm run start:dev --workspace=apps/worker
cd apps/mobile && npx expo start --tunnel
```

## Claude Code configuration

### Hooks (already configured in `.claude/settings.json`)

- **Stop hook**: runs `typecheck` + `test` on all workspaces before completing a task
- **PostToolUse hook** (local): auto-formats with Prettier and auto-lints with ESLint after every Edit/Write

### Recommended Claude Code practices

- Use `@coach/shared` for any cross-workspace imports — never relative paths
- After changing Prisma schema, always run `npm run db:generate --workspace=apps/api`
- After changing Babel/Metro/NativeWind config, restart Expo dev server
- Run quality gates (`lint`, `typecheck`, `test`) before every push
- Keep `docs/features/` in sync when changing feature behavior (per AGENTS.md)
- Maestro E2E flows live in `maestro/flows/` — update when adding new screens

## Project status

**Status**: Beta (TestFlight, build 17)

### Features built

- Firebase auth (email/password, Google, Apple Sign-In)
- Full onboarding flow (16 screens: gender, birthdate, height, weight, goals, activity, diet, targets)
- AI meal logging: photo (GPT-4 Vision), voice (STT), text search, barcode scan, quick-add, favorites/recents, templates
- Water logging with daily targets
- Macro/calorie tracking dashboard with ring visualization
- Weight logging and progress charts
- Body composition logging
- Workout logging (custom exercises, timer, history)
- AI Coach chat (personalized, memory-enabled via coach-memory processor)
- Adaptive calorie targets (auto-adjust based on progress)
- Weekly summary reports (AI-generated, delivered via Telegram + push)
- Meal nudge reminders (smart timing)
- Telegram bot integration for notifications
- Push notifications (Expo)
- QPay payment integration (Mongolia)
- Subscription management
- GDPR privacy: data export + account deletion via BullMQ
- OTA updates via expo-updates
- Sentry error tracking
- Daily production monitoring (automated GitHub Action)
- i18n: Mongolian + English
- Dark/light theme support

## Engineering Workflow

### Core Philosophy
- Optimize for shipping velocity, but never through reckless large rewrites.
- Prefer the smallest correct change that moves the product forward.
- Work in short iteration loops: inspect → plan → patch → test → verify → summarize.
- Use existing architecture and conventions unless there is a strong reason to change them.
- Do not overengineer. Build the simplest production-worthy solution first.
- When uncertain, investigate with available tools before guessing.
- Treat logs, traces, analytics, crash reports, and runtime signals as first-class sources of truth.
- Be proactive about finding the real root cause, not just suppressing symptoms.

### How to Work
For every non-trivial task:
1. First understand the request and inspect the relevant code paths.
2. Produce a short plan with concrete steps.
3. Identify the minimum viable code change.
4. Check whether MCP tools, Sentry, or Railway logs can provide useful context before making assumptions.
5. Implement in small, reviewable edits.
6. Run the fastest meaningful verification: `npm run lint && npm run typecheck && npm run test --workspaces`
7. Summarize: what changed, why it changed, risks/follow-ups, confidence level.

### Iteration Rules
- Do not make broad refactors unless explicitly requested or clearly necessary.
- Do not rewrite large files just because you can.
- Preserve naming, NestJS module architecture, Zustand stores, and existing patterns.
- When touching a large file, isolate the change to the smallest safe surface area.
- If you see unrelated issues, mention them separately instead of mixing them into the same patch.
- If there are multiple possible fixes, prefer the one with the lowest blast radius.

### MCP Usage
Actively use connected MCP tools whenever they reduce guesswork. Use MCP to:
- Inspect Sentry error reports and crash traces
- Inspect Railway deployment logs
- Inspect database state via Prisma
- Inspect BullMQ job failures
- Inspect Telegram bot delivery status

Prefer MCP evidence over speculation. When debugging:
1. Gather evidence from Sentry/logs/traces first
2. Identify exact failing path
3. Form 1-3 likely hypotheses
4. Test the most likely hypothesis with available evidence
5. Then patch the root cause

### Debugging Standard
When debugging:
1. Restate the symptom precisely.
2. Identify likely layer: Mobile UI → Zustand state → API client → NestJS controller → Service → Prisma/DB → BullMQ worker → OpenAI → QPay → Firebase Auth → Telegram → build/config
3. Use code inspection + Sentry/Railway logs together.
4. Find the root cause — fix root cause first.
5. Add or improve instrumentation if observability is weak.
6. Add a guardrail test or assertion when appropriate.

### Logging & Observability
When touching meaningful runtime behavior, ask:
- If this breaks again, how would we know?
- Would current Sentry/Pino logs make the bug obvious?
- Should we add structured logging or a Sentry breadcrumb?

Instrument at critical boundaries:
- User action (meal log, workout, weight entry)
- API request/response
- BullMQ job lifecycle (enqueue, process, complete, fail)
- OpenAI GPT-4 Vision calls (food photo analysis)
- QPay payment flow
- Firebase auth flow
- Telegram notification delivery
- Weekly summary generation
- App startup / initialization

Rules: no secrets/tokens in logs, include userId and requestId for correlation, use Pino structured logging in API/worker, use Sentry for client-side errors.

### Testing & Verification
After making changes:
- Run targeted workspace tests first: `npm run test --workspace=apps/api`
- Then broader suite only if needed: `npm run test --workspaces`
- If tests are missing, say so clearly.
- For bug fixes, provide at least one of: reproduction explanation, regression test, logging improvement, or validation checklist.

### Output Format
For each task, respond with:
1. **Understanding** — brief restatement of task and affected area
2. **Plan** — short, concrete steps
3. **Investigation** — code findings, Sentry/MCP findings if available, most likely root cause
4. **Changes made** — specific files/functions/behaviors changed
5. **Verification** — tests run, checks performed
6. **Risks / follow-ups** — anything uncertain, deferred, or worth monitoring

### Decision Rules
- If the request is ambiguous but implementation can proceed safely, make the most reasonable assumption and state it.
- If a missing secret, environment variable, or Railway config blocks the task, stop and state exactly what is missing.
- If a proposed change conflicts with best practices, warn clearly with ❗❗❗.
- If the issue appears broader than the requested fix, fix the smallest safe scope first and call out the broader problem separately.

### Large Tasks
Break work into phases:
- **Phase 1**: smallest working path
- **Phase 2**: hardening (tests, error handling, Sentry instrumentation)
- **Phase 3**: polish / cleanup

Always get Phase 1 working first before expanding scope.

### Priorities
1. Fast product iteration
2. Clean user experience
3. Production stability (Railway uptime, Sentry-clean)
4. Debuggability (structured Pino logs, Sentry breadcrumbs)
5. Low blast radius changes
6. Shipping useful increments quickly

Never prioritize elegance over a working, testable, reviewable solution.
