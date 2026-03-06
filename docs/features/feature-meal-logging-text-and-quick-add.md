# Meal Logging (Text + Quick Add)

Last updated: 2026-03-06

## Scope
- Structured meal logging from selected foods.
- Manual quick-add calorie/macro entries.

## User flow
1. User picks foods/servings/quantities or enters quick-add values.
2. API computes nutrition totals.
3. Meal log and immutable item snapshots are saved.
4. Dashboard and progress screens consume saved totals.

## API surface
- `POST /meal-logs`
- `POST /meal-logs/quick-add`
- `GET /meal-logs`
- `GET /meal-logs/:id`
- `DELETE /meal-logs/:id`

## Data model
- `MealLog`
- `MealLogItem` (snapshot fields: food name + macros at log time)

## Current logic/rules
- Snapshot values are immutable history.
- Totals are precomputed at write time for dashboard performance.
- Source types include `text`, `quick_add`, `barcode`, `voice`, `photo`, `telegram`.

## Current gaps / next improvements
- No meal-edit endpoint; current pattern is create/delete.
