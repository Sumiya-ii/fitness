# AGENTS.md

This file defines **repo-specific rules** for coding agents (Codex/Claude/etc.).
Follow these instructions over generic defaults.

## Non-negotiables

- Update `todo-chunks.md` to track progress: **tick completed items** from the to-do list as you finish them.
- Never print, log, paste, or commit secrets (API keys, tokens, credentials, private URLs, `.env` contents).
- Follow best practices. If you ask for something that is **not** best practice, warn you with **❗❗❗** and explain why.

## Prime directive

- Make the **smallest correct change** that solves the request.
- Match existing patterns, architecture, and naming.
- If repo context is missing (env, secrets, unclear intent), **ask before guessing**.

## How to work in this repo

1. Locate the relevant entrypoint(s) (UI screen, API route, worker, job, library).
2. If the task is non-trivial, propose a short plan (2–6 bullets).
3. Implement with minimal diff.
4. Run the fastest applicable checks (see below).

## Discover-first (avoid command thrash)

- Determine the package manager from lockfiles:
  - `pnpm-lock.yaml` → `pnpm`
  - `yarn.lock` → `yarn`
  - `package-lock.json` → `npm`
- Prefer repo scripts over guessing:
  - Node: read `package.json` scripts (root + workspace packages)
  - Monorepo: check `turbo` / `nx` / `pnpm-workspace.yaml` / yarn workspaces

## Guardrails (ask before doing)

Ask before:

- Adding/upgrading **production** dependencies
- Changes to auth / payments / permissions
- DB schema changes or migrations
- Infra/deploy changes (CI, cloud bindings, secrets)

## Output requirements

When finishing a task, report:

- **Summary**
- **Files changed**
- **Commands run** (or why you could not run them)
- **Follow-ups / risks**
