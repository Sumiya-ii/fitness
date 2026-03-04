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

## Tech Stack

- **Backend**: NestJS (TypeScript) with REST
- **Workers**: BullMQ for async jobs
- **Mobile**: React Native (TypeScript)
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + BullMQ
- **Search**: Typesense
- **Auth**: Firebase Auth
- **Observability**: OpenTelemetry + Sentry
