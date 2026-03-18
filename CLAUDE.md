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

## Running the stack locally

```bash
# Start infrastructure (Postgres, Redis, Typesense)
docker compose up postgres redis typesense

# API (in another terminal)
npm run start:dev --workspace=apps/api

# Worker (in another terminal)
npm run start:dev --workspace=apps/worker

# Mobile
npm run start --workspace=apps/mobile
# Then press i (iOS) or a (Android)
```

## Key commands

```bash
# Across all workspaces
npm run lint
npm run typecheck
npm run test
npm run build
npm run format         # prettier --write
npm run format:check   # prettier --check

# Per workspace (append --workspace=apps/api etc.)
npm run lint --workspace=apps/api
npm run test --workspace=apps/mobile

# Database (API workspace)
npm run db:migrate --workspace=apps/api    # run pending migrations
npm run db:generate --workspace=apps/api   # regenerate Prisma client
npm run db:studio --workspace=apps/api     # open Prisma Studio
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
