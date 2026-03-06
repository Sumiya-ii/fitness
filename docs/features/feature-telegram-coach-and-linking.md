# Telegram Coach & Linking

Last updated: 2026-03-06

## Scope
- Telegram account linking via one-time code.
- Telegram text logging, quick-add fallback, and coaching status replies.
- Reminder-ready channel integration.

## User flow
1. User generates code in app and sends `/link <code>` to bot.
2. Bot confirms link and stores telegram identity.
3. User sends food text; bot parses/matches foods and asks confirm (or quick-add).
4. User can ask coaching queries (e.g., calories left).

## API surface
- `POST /telegram/link-code`
- `POST /telegram/confirm` (public)
- `GET /telegram/status`
- `POST /telegram/unlink`
- `POST /telegram/webhook` (public)

## Data model
- `TelegramLink`
- `IdempotencyKey` for webhook dedupe
- `MealLog` via telegram source

## Current logic/rules
- Link code is Redis-backed with 5-minute TTL.
- One telegram account cannot be linked to multiple active users.
- Incoming message idempotency prevents duplicate logs.

## Current gaps / next improvements
- Callback payload state can be externalized to reduce inline callback size limits.
