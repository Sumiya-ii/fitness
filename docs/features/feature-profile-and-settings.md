# Profile & Settings

Last updated: 2026-03-06

## Scope
- Profile view/edit.
- Language, units, reminders, telegram status, subscription status, privacy actions in mobile settings.

## User flow
1. Settings screen loads profile, notification prefs, telegram status, subscription status.
2. User edits profile name, locale, unit system.
3. User toggles morning/evening reminders.
4. User can trigger export/deletion requests.

## API surface
- `GET /profile`
- `PUT /profile`
- `GET /notifications/preferences`
- `PUT /notifications/preferences`

## Data model
- `Profile`
- `NotificationPreference`

## Current logic/rules
- Notification preferences are auto-created on first read.
- `PUT /profile` supports partial updates.
- Locale and unit changes are persisted and reflected in UI.
- `GET /profile` and `PUT /profile` include derived `bmi` (kg/m², rounded to 1 decimal).
- BMI uses the latest available user weight from `WeightLog` when present; otherwise it falls back to `Profile.weightKg`.

## Current gaps / next improvements
- Quiet hours and multi-channel notification controls are modeled but not fully exposed in mobile UI.
