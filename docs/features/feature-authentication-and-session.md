# Authentication & Session

Last updated: 2026-03-06

## Scope
- Firebase token based authentication for API access.
- First-login user bootstrap.

## User flow
1. User signs in from mobile with Firebase credentials.
2. Mobile sends Firebase ID token as `Authorization: Bearer <token>`.
3. API guard verifies token and resolves current user.
4. If user does not exist, API auto-creates `User`, `Profile`, and free `Subscription`.

## API surface
- Auth is guard-driven; no dedicated auth controller endpoints.
- Protected endpoints use `@CurrentUser()`.
- Public endpoints use `@Public()` when needed.

## Data model
- `User` (`firebaseUid`, `email`, `phone`)
- `Profile` (auto-created defaults: `locale=mn`, `unitSystem=metric`)
- `Subscription` (auto-created defaults: `tier=free`, `status=active`)

## Current logic/rules
- Identity key is `firebaseUid`.
- Existing users are loaded; no duplicate creation path.
- New users are provisioned with profile + free entitlement.

## Current gaps / next improvements
- No dedicated server-side login telemetry for success/failure rates.
