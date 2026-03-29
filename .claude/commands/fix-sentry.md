---
description: Fix a specific Sentry issue by ID — fetches the error details, finds the code, and applies a fix
argument-hint: <ISSUE_ID or SHORT_ID>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Fix Sentry Issue: $ARGUMENTS

## Fetch Issue Details

```bash
# Try as issue ID first, then as short ID
ISSUE="$ARGUMENTS"

# Get issue details
curl -s -H 'Authorization: Bearer ${SENTRY_AUTH_TOKEN}' \
  "https://sentry.io/api/0/issues/${ISSUE}/" | jq '{title, metadata, count, firstSeen, lastSeen, level, status}'

# Get latest event with full stack trace
curl -s -H 'Authorization: Bearer ${SENTRY_AUTH_TOKEN}' \
  "https://sentry.io/api/0/issues/${ISSUE}/events/latest/" | jq '.entries[] | select(.type=="exception")'

# Get event tags for context
curl -s -H 'Authorization: Bearer ${SENTRY_AUTH_TOKEN}' \
  "https://sentry.io/api/0/issues/${ISSUE}/events/latest/" | jq '.tags'
```

## Fix Workflow

1. Parse the stack trace to identify the exact file and line
2. Read the source file and understand the context
3. Determine root cause — is this a code bug we can fix?
4. If yes: implement the fix, keeping it minimal and focused
5. Run `npm run typecheck --workspaces` and `npm run test --workspaces`
6. Commit with: `fix(<scope>): <description> [resolves SENTRY-<ID>]`

## Skip if:
- Error is caused by invalid user input (add validation instead)
- Error is a transient network issue
- Error is from a third-party service being down
- Fix would require schema/data migration (flag it instead)
