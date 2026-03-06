# Photo Logging (AI Draft)

Last updated: 2026-03-06

## Scope
- Photo upload and async AI parse draft with macro estimate.

## User flow
1. User uploads meal photo.
2. API enqueues photo parse job and returns `draftId`.
3. Mobile polls draft for parsed items and nutrition totals.
4. User confirms before save.

## API surface
- `POST /photos/upload`
- `GET /photos/drafts/:id`

## Data model
- Queue jobs in `PHOTO_PARSING`
- `AiParseResult` schema supports confidence/model metadata tracking

## Current logic/rules
- Photo reference key is generated per user upload.
- Draft data is user-scoped and not auto-committed to meal logs.

## Current gaps / next improvements
- Persistent media storage abstraction should be finalized end-to-end.
