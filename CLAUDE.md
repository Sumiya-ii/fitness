# Coach — Agent Instructions

## Git workflow

- **Always commit and push directly to `main`**. Do not create feature branches or PRs unless explicitly asked.
- Commit frequently after each logical change so individual changes are easy to revert.
- Use clear, descriptive commit messages so each change is identifiable in the git log.

## Project overview

**Coach** is an AI-enabled nutrition and training mobile app for Mongolian users.

**Monorepo structure (npm workspaces):**
```
apps/
  mobile/    — React Native + Expo (@coach/mobile)
  api/       — NestJS REST API (@coach/api)
  worker/    — BullMQ background job processor (@coach/worker)
packages/
  shared/    — Shared Zod schemas, types, constants (@coach/shared)
```

## Tech stack

| Layer | Technology |
|---|---|
| Mobile | React Native 0.83, Expo ~55, NativeWind 4 (Tailwind), Zustand, React Navigation 7 |
| API | NestJS 10, Prisma 5 + PostgreSQL 16, Redis 7, Firebase Admin |
| AI | OpenAI GPT-4 Vision (food photos), Google Speech-to-Text / Chimege STT |
| Queue | BullMQ (via Redis) |
| Search | Typesense 0.25 |
| Auth | Firebase Authentication |
| Payments | QPay (Mongolia) |
| Observability | Sentry, OpenTelemetry |
| Infra | Docker Compose (local), GitHub Actions CI |

## Key commands

```bash
# Per workspace: append --workspace=apps/api | apps/mobile | apps/worker
npm run lint --workspace=apps/api
npm run typecheck --workspace=apps/api
npm run test --workspace=apps/api
npm run build --workspace=apps/api
npm run format         # prettier --write (all)

# Database (API workspace)
npm run db:migrate --workspace=apps/api    # run pending migrations
npm run db:generate --workspace=apps/api   # regenerate Prisma client
npm run db:seed --workspace=apps/api       # seed dev data

# Mobile
npx expo prebuild:ios                      # regenerate native iOS project
```

## Code style & conventions

- **TypeScript strict mode** everywhere. No `any` without justification.
- **Prettier** (enforced): singleQuote, semi, trailingComma: all, printWidth: 100, tabWidth: 2
- **ESLint** with `@typescript-eslint`; unused vars prefixed with `_` are allowed.
- **NativeWind** for all mobile styling — use `className` props, not `StyleSheet`.
- **Zustand** for client state in mobile; no Redux.
- **Zod** (`@coach/shared`) for all schema validation and type inference.
- **NestJS modules** for all API features; each feature in `apps/api/src/<feature>/`.

## Environment variables

Copy `.env.example` to `.env` in repo root. Key vars:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `FIREBASE_*` — Firebase Admin credentials
- `OPENAI_API_KEY` — GPT-4 Vision for food photo recognition
- `STT_PROVIDER` — `google` or `chimege` for speech-to-text

Mobile env vars are prefixed `EXPO_PUBLIC_*` in `apps/mobile/.env`.

## CI/CD

GitHub Actions runs on every push/PR to `main`:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run format:check`

All four must pass before merging.

## API modules

`admin`, `analytics`, `auth`, `barcodes`, `config`, `dashboard`, `favorites`, `foods`, `health`, `meal-logs`, `notifications`, `observability`, `onboarding`, `photos`, `prisma`

## Mobile architecture

- **Navigation**: React Navigation 7 (stack + tab navigators)
- **Screens**: feature-organized under `apps/mobile/app/`
- **State**: Zustand stores under `apps/mobile/stores/`
- **Hooks**: custom hooks under `apps/mobile/hooks/`
- **i18n**: internationalization support (Mongolian + English)
- **Auth**: Firebase phone/email auth with Expo SecureStore for tokens

## Testing strategy

**Stack**: Jest 29 + ts-jest in all workspaces. `npm run test --workspaces` runs in CI on every push.

### Layers

| Layer | Where | When to add |
|---|---|---|
| Unit | co-located `*.spec.ts` (API/worker) or `src/__tests__/*.test.ts` (mobile) | Pure logic, transforms, calculators, error mapping |
| Store/integration | `src/__tests__/*.test.ts` | Zustand stores, service functions with mocked boundaries |
| E2E | Not configured — skip unless Detox/Maestro is set up | Critical flows only, future |

### Rules for every feature or bugfix

1. **Pure logic** (calculators, parsers, validators, error maps): add a unit test. No exceptions.
2. **Zustand stores**: test state transitions + side effects (AsyncStorage, API calls) via `useXxxStore.setState()` / `.getState()`.
3. **NestJS services**: add a `*.spec.ts` co-located with the service. Mock `PrismaService` inline (see existing specs for pattern).
4. **New queue processors**: add routing test in `apps/worker/src/processors/index.spec.ts`.
5. **UI screens**: skip unless there is non-trivial branching logic. No `@testing-library/react-native` is configured.
6. **External APIs** (Firebase, OpenAI, QPay, Typesense): always mock at the boundary — never call real services in tests.
7. **If a change has no testable behavior** (pure styling, string changes, config tweaks): explicitly note "not test-worthy" in the commit message.

### Mock conventions

- **Mobile native modules** (expo-notifications, expo-constants, expo-secure-store): globally stubbed via `moduleNameMapper` in `jest.config.js`. Stubs live in `src/__mocks__/`.
- **AsyncStorage**: mock inline with `jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))`.
- **API client** in mobile: `jest.mock('../api/client', () => ({ api: { get: jest.fn(), post: jest.fn(), ... } }))`.
- **Firebase auth service** in mobile: mock the whole module; always include `configureGoogleSignIn: jest.fn()` and `subscribeToTokenRefresh: jest.fn(() => jest.fn())`.
- **PrismaService** in API: construct inline as a plain object of `jest.Mock` functions (see `auth.service.spec.ts`).

### Key commands

```bash
npm run test --workspace=apps/mobile     # mobile tests only
npm run test --workspace=apps/api        # API tests only
npm run test --workspace=apps/worker     # worker tests only
npm run test --workspace=packages/shared # shared schema tests only
npm run test --workspaces                # all (same as CI)
npm run test:cov --workspace=apps/api    # coverage report
```
