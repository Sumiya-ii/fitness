# Barcode Logging & Submission

Last updated: 2026-03-15

## Scope
- Known barcode lookup.
- Unknown barcode submission to moderation queue.

## User flow
1. Mobile scans barcode and requests `GET /barcodes/:code`.
2. If found, user logs meal from returned food details.
3. If unknown, user submits nutrition payload via `POST /barcodes/submit`.
4. Backend creates pending food + moderation queue item.

## API surface
- `GET /barcodes/:code`
- `POST /barcodes/submit`

## Data model
- `Barcode`
- `Food` (pending user submission)
- `ModerationQueue` (`entityType=barcode_submission`)

## Current logic/rules
- Duplicate barcode submission returns `already_exists`.
- Unknown submissions are stored as pending records for review.
- Scan frame sizing is viewport-responsive, and key icon-only actions (back/increment/decrement) include explicit accessibility labels/roles.

## Current gaps / next improvements
- Submission flow does not yet include full label-image storage pipeline.
