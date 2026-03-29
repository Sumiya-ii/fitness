---
description: Get caught up on what happened since your last session — recent commits, Sentry errors, deploy status, and open work
allowed-tools: Bash, Read, Glob, Grep
---

# Session Catchup

## Recent Commits (last 48 hours)
!`git log --oneline --since="48 hours ago" --no-merges`

## Current Branch & Status
!`git branch --show-current && echo "---" && git status --short`

## Uncommitted Changes
!`git diff --stat`

## Sentry Issues (API/Worker)
```bash
curl -s -H 'Authorization: Bearer ${SENTRY_AUTH_TOKEN}' \
  'https://sentry.io/api/0/projects/nexus-kairos/node/issues/?query=is:unresolved&limit=5' | jq '[.[] | {title: .title, count: .count, lastSeen: .lastSeen, level: .level}]'
```

## Sentry Issues (Mobile)
```bash
curl -s -H 'Authorization: Bearer ${SENTRY_AUTH_TOKEN}' \
  'https://sentry.io/api/0/projects/nexus-kairos/react-native/issues/?query=is:unresolved&limit=5' | jq '[.[] | {title: .title, count: .count, lastSeen: .lastSeen, level: .level}]'
```

## Railway Deploy Status
```bash
railway status 2>/dev/null || echo "Railway CLI not linked"
```

## Summary

Synthesize everything into a brief status report:
- What changed recently
- Any production errors that need attention
- Current state of uncommitted work
- Recommended next actions
