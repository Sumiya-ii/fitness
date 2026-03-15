# Authentication & Session

Last updated: 2026-03-15

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
- Auth stack uses native-stack transitions (`fade_from_bottom`) with full-screen swipe gestures enabled.
- Sign-in and sign-up screens are keyboard-safe: form content is wrapped in `KeyboardAvoidingView` + scroll container to keep inputs and CTA reachable when the keyboard is open.
- Core auth copy (headings, field labels, helper lines, account-switch prompts) is localized through i18n keys.

## Current gaps / next improvements
- No dedicated server-side login telemetry for success/failure rates.
