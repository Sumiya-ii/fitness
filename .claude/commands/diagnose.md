---
description: Pull production errors from Sentry and Railway logs, analyze patterns, and suggest or apply fixes
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Diagnose Production Issues

## Step 1: Pull Sentry Issues

Fetch unresolved errors from both projects:

```bash
# API/Worker errors (node project)
curl -s -H 'Authorization: Bearer ${SENTRY_AUTH_TOKEN}' \
  'https://sentry.io/api/0/projects/nexus-kairos/node/issues/?query=is:unresolved&limit=10'

# Mobile errors (react-native project)
curl -s -H 'Authorization: Bearer ${SENTRY_AUTH_TOKEN}' \
  'https://sentry.io/api/0/projects/nexus-kairos/react-native/issues/?query=is:unresolved&limit=10'
```

For each issue, get the full stack trace:
```bash
curl -s -H 'Authorization: Bearer ${SENTRY_AUTH_TOKEN}' \
  'https://sentry.io/api/0/issues/{ISSUE_ID}/events/latest/'
```

## Step 2: Pull Railway Logs

```bash
railway logs --lines 200 -s coach-api 2>/dev/null
railway logs --lines 200 -s coach-worker 2>/dev/null
```

## Step 3: Analyze

For each error found:
1. Identify the source file and line from the stack trace
2. Read the relevant code
3. Determine root cause (code bug vs external factor vs data issue)
4. Categorize: critical (crash/data loss), high (feature broken), medium (degraded), low (cosmetic)

## Step 4: Report

Present a summary table:
| # | Source | Error | Severity | Root Cause | Fix? |
Then ask which issues to fix, or fix all code bugs automatically.
