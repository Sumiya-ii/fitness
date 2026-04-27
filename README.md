# Coach

AI-enabled nutrition and training app for Mongolian users.

## Monorepo Structure

```
coach/
├── apps/
│   ├── api/          # NestJS backend API
│   ├── worker/       # BullMQ background workers
│   └── mobile/       # React Native mobile app
├── packages/
│   └── shared/       # Shared types, constants, and utilities
├── requirements.md   # Product requirements (source of truth)
└── todo-chunks.md    # Implementation tracker
```

## Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL (for later chunks)
- Redis (for later chunks)

## Getting Started

```bash
# Install all dependencies
npm install

# Run all linters
npm run lint

# Run all tests
npm run test

# Type-check all workspaces
npm run typecheck

# Format code
npm run format

# Start API in dev mode
npm run start:dev -w @coach/api

# Start worker in dev mode
npm run start:dev -w @coach/worker
```

## Mobile Runtime Config

For `apps/mobile`, configure these Expo public env vars instead of editing source files:

- `EXPO_PUBLIC_API_BASE_URL` (example: `http://192.168.1.x:3000/api/v1` for physical device testing)
- `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` (example: `MyCoachBot`, with or without `@`)
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` (optional)
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` (optional)
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (optional)

## Tech Stack

- **Backend**: NestJS (TypeScript) with REST
- **Workers**: BullMQ for async jobs
- **Mobile**: React Native (TypeScript)
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + BullMQ
- **Auth**: Firebase Auth
- **Observability**: OpenTelemetry + Sentry
