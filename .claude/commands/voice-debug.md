---
description: Debug the voice logging / STT pipeline end-to-end (mobile recording, API upload, worker transcription, nutrition parsing)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Debug Voice/STT Pipeline

## Pipeline Components

### Mobile — Voice Recording & Upload
!`head -100 apps/mobile/src/screens/logging/VoiceLogScreen.tsx`

### API — Voice Controller (upload + draft polling)
!`cat apps/api/src/voice/voice.controller.ts`

### API — Voice Service
!`cat apps/api/src/voice/voice.service.ts`

### Worker — STT Processor
!`cat apps/worker/src/processors/stt.processor.ts`

### Shared — STT Prompt
!`grep -A 30 "STT_NUTRITION_SYSTEM_PROMPT" packages/shared/src/prompts.ts`

## Recent Voice-Related Sentry Issues

```bash
curl -s -H 'Authorization: Bearer ${SENTRY_AUTH_TOKEN}' \
  'https://sentry.io/api/0/projects/nexus-kairos/node/issues/?query=is:unresolved+stt+OR+voice+OR+whisper&limit=10'
```

## Recent Voice-Related Commits

!`git log --oneline -20 | grep -iE "voice|stt|whisper|transcri" || echo "No recent voice commits"`

## Instructions

Analyze the full pipeline for:
1. **Audio recording** — correct format, encoding, sample rate
2. **Upload** — proper multipart handling, size limits, MIME validation
3. **S3 storage** — key format, permissions, cleanup
4. **Whisper transcription** — language parameter, model, error handling for nonsense output
5. **Nutrition parsing** — prompt effectiveness, JSON schema validation, Mongolian food recognition
6. **Draft polling** — race conditions, timeout handling, error states
7. **Error propagation** — does the mobile app properly handle each failure mode?

Fix any issues found and verify with typecheck + tests.
