---
name: add-worker
description: Scaffold a new BullMQ worker processor with all required test categories. Use when user asks to add or create a new worker, processor, or background job.
disable-model-invocation: true
---

Scaffold a new BullMQ worker processor: $ARGUMENTS

## Project Conventions

- Worker processors live in `apps/worker/src/processors/`
- Pino structured logging — no `console.log`
- Environment variable checks at the start
- Error handling with `logMessage()` for delivery status tracking
- Every processor MUST have co-located `*.spec.ts` with ALL 9 test categories
- Mock patterns: OpenAI (default export constructor), Telegraf, Redis (stateful store), PostgreSQL (Pool)

## Reference

- Existing processors: `apps/worker/src/processors/`
- Dispatch map: `apps/worker/src/processors/index.ts`
- Mock patterns: see AGENTS.md worker mock conventions
- Shared services: `expo-push`, `message-log.service`, `s3`, `db`

## Steps

1. Read 1-2 existing processors in `apps/worker/src/processors/` to match exact patterns
2. Read `apps/worker/src/processors/index.ts` to understand the dispatch map
3. Create `apps/worker/src/processors/<processorName>.ts` with:
   - Standard processor function signature matching existing processors
   - Environment variable checks at the top (return early if missing)
   - Pino structured logging at key boundaries
   - `logMessage()` calls for delivery status tracking
   - Error handling: catch errors, log with `logMessage({ status: 'failed', errorMessage })`, no crashes
4. Register the processor in `apps/worker/src/processors/index.ts` dispatch map
5. Create `apps/worker/src/processors/<processorName>.spec.ts` with ALL 9 required test categories:
   1. **Missing env vars** — return early/skip when required env vars unset
   2. **Happy path** — mock all deps, verify correct API calls, delivery, return values
   3. **Both delivery channels** — test Telegram and Push independently and together
   4. **No deliverable channels** — skip gracefully when chatId missing, pushTokens empty
   5. **Locale handling** — test `mn` (default), `en`, undefined, unknown locale (fallback)
   6. **AI fallbacks** — null/empty GPT response content uses static fallback message
   7. **External service errors** — OpenAI/Telegram/Push failure with correct error logging
   8. **Error logging** — verify `logMessage()` called with `status: 'failed'` and `errorMessage`
   9. **Edge case data** — null/undefined optional fields, empty arrays, boundary values
6. Follow the mock patterns from AGENTS.md (OpenAI, Telegraf, Redis, PostgreSQL, shared services)
7. Run `npm run test --workspace=apps/worker` to verify all tests pass
8. Report what was created and where it was registered
