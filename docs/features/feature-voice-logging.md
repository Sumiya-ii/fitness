# Voice Logging (AI Draft)

Last updated: 2026-03-06

## Scope
- Voice upload and async draft transcription flow.

## User flow
1. User records audio in mobile and uploads file.
2. API enqueues STT job and returns `draftId`.
3. Mobile polls draft status and displays transcription.
4. User confirms/edits before final meal save.

## API surface
- `POST /voice/upload`
- `GET /voice/drafts/:id`

## Data model
- Queue jobs in `STT_PROCESSING`
- Optional AI trace in `AiParseResult` ecosystem

## Current logic/rules
- Draft access is user-scoped (job ownership checked).
- Draft state mirrors queue state (`waiting|active|completed|failed`).
- No auto-save into `MealLog` from transcription alone.

## Current gaps / next improvements
- Formal draft-to-confirmed endpoint contract can be expanded for richer edits.
