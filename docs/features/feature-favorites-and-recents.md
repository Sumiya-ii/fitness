# Favorites & Recents

Last updated: 2026-03-15

## Scope
- Favorite foods management.
- Recent food shortcuts from recent meal log items.

## User flow
1. User marks food favorite.
2. User opens favorites/recents for one-tap relog workflows.

## API surface
- `POST /favorites/:foodId`
- `DELETE /favorites/:foodId`
- `GET /favorites`
- `GET /favorites/recents`

## Data model
- `Favorite`
- Derived recents from `MealLogItem`

## Current logic/rules
- Favorite uniqueness enforced by `(userId, foodId)`.
- Recents are deduplicated by `foodId` and ordered by last use.
- Header back affordances in logging list/detail screens use expanded touch targets for more reliable tap behavior.

## Current gaps / next improvements
- Meal templates are not persisted as a dedicated first-class entity.
