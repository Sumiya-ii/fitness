---
description: Sync the development environment — install deps, generate Prisma client, verify all workspaces build
allowed-tools: Bash, Read, Glob
---

# Sync Development Environment

## Current State
!`node --version && npm --version`
!`git branch --show-current`

## Step 1: Install Dependencies
```bash
npm ci
```

## Step 2: Generate Prisma Client
```bash
npm run db:generate --workspace=apps/api
```

## Step 3: Verify All Workspaces Build
```bash
npm run typecheck --workspace=packages/shared
npm run typecheck --workspace=apps/api
npm run typecheck --workspace=apps/worker
npm run typecheck --workspace=apps/mobile
```

## Step 4: Run Tests
```bash
npm run test --workspaces 2>&1
```

## Report
- Dependencies: installed / outdated / issues
- Prisma: client generated / schema errors
- Typecheck: pass/fail per workspace
- Tests: pass/fail per workspace
- Ready to develop: YES / NO (with blockers)
