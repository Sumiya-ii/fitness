# Daily Dashboard

Last updated: 2026-03-06

## Scope
- Daily consumed/remaining calories and macros.
- Per-meal grouped breakdown for home screen.
- Weekly 7-day calendar strip (Sun-Sat) with swipeable week pagination and day selection.

## User flow
1. Home screen loads the selected day dashboard and profile name.
2. Calendar prefetches 7 daily dashboard summaries for the visible week.
3. User can swipe horizontally to previous/next weeks (paginated).
4. User can tap a day to make it active; dashboard cards and meals update for that date.
5. Each day cell shows a circular calorie progress state (dashed empty / partial / full).

## API surface
- `GET /dashboard?date=YYYY-MM-DD` (optional date)

## Data model
- Reads from `MealLog`, `MealLogItem`, `Target`

## Current logic/rules
- Date window is day-start to day-end.
- Macro totals are summed from denormalized meal log totals.
- Remaining/progress are computed only when active target exists.
- Calendar uses 7 consecutive days per page and preserves weekday selection while swiping weeks.
- Weekly day indicators use consumed/target calories from daily dashboard responses.
- Pull-to-refresh reloads profile, selected date dashboard, and visible week indicator data.

## Current gaps / next improvements
- No explicit caching layer for heavy-user scale yet.
- Weekly indicator prefetch currently fans out to daily endpoint calls (no dedicated weekly dashboard summary endpoint for Home).
