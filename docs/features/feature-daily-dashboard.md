# Daily Dashboard

Last updated: 2026-03-06

## Scope
- Daily consumed/remaining calories and macros.
- Per-meal grouped breakdown for home screen.

## User flow
1. Home screen requests daily dashboard.
2. API aggregates today meal logs + active target.
3. UI renders calorie ring, macro progress, meal cards, and remaining budget.

## API surface
- `GET /dashboard?date=YYYY-MM-DD` (optional date)

## Data model
- Reads from `MealLog`, `MealLogItem`, `Target`

## Current logic/rules
- Date window is day-start to day-end.
- Macro totals are summed from denormalized meal log totals.
- Remaining/progress are computed only when active target exists.

## Current gaps / next improvements
- No explicit caching layer for heavy-user scale yet.
