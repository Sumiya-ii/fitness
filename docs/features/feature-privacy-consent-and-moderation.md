# Privacy, Consent & Moderation

Last updated: 2026-03-06

## Scope
- Consent capture.
- Privacy export/deletion request intake.
- Admin moderation queue approval/rejection and audit logging.

## User flow
1. User submits consent or privacy requests from app.
2. Backend stores auditable request records.
3. Admin reviews moderation queue and approves/rejects submissions.

## API surface
- `POST /privacy/consent`
- `POST /privacy/export`
- `POST /privacy/delete-account`
- `GET /privacy/requests`
- `GET /admin/moderation`
- `POST /admin/moderation/:id/approve`
- `POST /admin/moderation/:id/reject`

## Data model
- `Consent`
- `PrivacyRequest`
- `ModerationQueue`
- `AuditLog`

## Current logic/rules
- Privacy requests are tracked with status lifecycle fields.
- Admin actions write audit records with actor and entity metadata.
- Admin routes are protected with `AdminGuard` allowlist behavior.

## Current gaps / next improvements
- Export/deletion background processors are not yet fully implemented end-to-end.
