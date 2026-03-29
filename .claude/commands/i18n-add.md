---
description: Add new translation keys to both English and Mongolian locale files simultaneously
argument-hint: <dotted.key.path> <english text> [mongolian text]
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Add Translation Keys

Add: **$ARGUMENTS**

## Current Locale Files

### English:
!`cat apps/mobile/src/i18n/en.ts`

### Mongolian:
!`cat apps/mobile/src/i18n/mn.ts`

### i18n setup:
!`cat apps/mobile/src/i18n/index.ts`

## Instructions

1. Parse the arguments: `<dotted.key.path>` `<english text>` `[mongolian text]`
2. Add the key to both `en.ts` and `mn.ts` at the correct nested location
3. If Mongolian text is not provided, add a TODO comment: `// TODO: translate`
4. Verify the key follows existing naming conventions (camelCase segments, dot-separated)
5. Check no duplicate keys exist
6. Run `npm run typecheck --workspace=apps/mobile` to verify
