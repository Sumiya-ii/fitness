---
description: Pre-commit quality gate — runs lint, typecheck, tests, and format check across all workspaces
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# Preflight Check

Run all CI checks locally before pushing. Fix any issues found automatically.

## Current Changes
!`git status --short`

## Run Checks

Execute these in order, fixing issues as they arise:

1. **Format check** — `npm run format:check` — if failing, run `npm run format`
2. **Lint** — `npm run lint --workspaces` — auto-fix with `npx eslint --fix` where possible
3. **Typecheck** — `npm run typecheck --workspaces` — fix type errors in source code
4. **Tests** — `npm run test --workspaces` — fix failing tests (fix the code, NOT the test expectations)

## Rules
- Fix issues automatically without asking
- If a test fails, understand WHY and fix the underlying code
- After all fixes, re-run the full suite to confirm everything passes
- Report final status: PASS (safe to push) or FAIL (with remaining issues)
