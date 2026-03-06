# Weekly Summary

Last updated: 2026-03-06

## Scope
- Weekly adherence and nutrition averages.
- Weekly weight delta.

## User flow
1. User opens weekly summary screen.
2. API computes Monday-Sunday window from current or requested week.
3. UI shows adherence, averages, and weight change.

## API surface
- `GET /weekly-summary?week=YYYY-MM-DD` (optional week anchor)

## Data model
- Aggregates from `MealLog` and `WeightLog`

## Current logic/rules
- `daysLogged` is count of distinct days with meal logs.
- `adherenceScore = (daysLogged / 7) * 100`.
- Weight delta uses first and last in-week weight entries.

## Current gaps / next improvements
- No explicit cross-week comparison endpoint yet.
