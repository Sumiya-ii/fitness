---
description: Full deployment workflow — preflight checks, push to main, verify Railway deployment
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# Deploy to Production

## Pre-deploy Status
!`git status --short`
!`git log --oneline -5`

## Step 1: Preflight Checks

Run the full CI suite locally:
```bash
npm run format:check
npm run lint --workspaces
npm run typecheck --workspaces
npm run test --workspaces
```

If ANY check fails, fix the issue before proceeding. Do NOT skip checks.

## Step 2: Push to Main

```bash
git push origin main
```

## Step 3: Verify Deployment

```bash
# Check Railway deployment status
railway status 2>/dev/null

# Wait and check health endpoint
sleep 30
curl -s https://coach-api.up.railway.app/api/v1/health | jq .
```

## Step 4: Post-deploy Verification

```bash
# Check for new Sentry errors in the last 5 minutes
curl -s -H 'Authorization: Bearer ${SENTRY_AUTH_TOKEN}' \
  'https://sentry.io/api/0/projects/nexus-kairos/node/issues/?query=is:unresolved+firstSeen:-5m&limit=5' | jq '.[].title'
```

Report: deploy success/failure, health check result, any new errors.
