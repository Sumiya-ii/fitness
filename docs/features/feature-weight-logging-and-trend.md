# Weight Logging & Trend

Last updated: 2026-03-10

## Scope
- Daily weight logging.
- 14-point trend and weekly delta summary.

## User flow
1. User logs weight from progress flow.
2. API upserts one entry per day.
3. Progress screen fetches history + trend summary.

## API surface
- `POST /weight-logs`
- `GET /weight-logs?days=30`
- `GET /weight-logs/trend`

## Data model
- `WeightLog` unique key: `(userId, loggedAt)`

## Current logic/rules
- Writes are normalized to date-only midnight.
- Trend compares recent 7-day average vs previous 7-day average.
- Progress screen initial loading uses structured skeleton placeholders (hero, period tabs, chart, stats) for consistent perceived performance.

## Current gaps / next improvements
- No smoothing/advanced trend models yet.
