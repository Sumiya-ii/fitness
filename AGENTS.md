# AGENTS.md

This file defines **repo-specific rules** for coding agents (Codex/Claude/etc.).
Follow these instructions over generic defaults.

## Non-negotiables
- When you finish implementing a request, commit and push to the main branch **only if there are no other uncommitted changes** in the working tree.
- Update `todo-chunks.md` to track progress: **tick completed items** from the to-do list as you finish them.
- Never print, log, paste, or commit secrets (API keys, tokens, credentials, private URLs, `.env` contents).
- Follow best practices. If you ask for something that is **not** best practice, warn you with **❗❗❗** and explain why.
- Before any push, run quality checks (`lint`, `typecheck`, `test`) using repo scripts. If any check fails, fix the issue, rerun checks, and repeat until all checks pass; only then commit/push.

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

## Dev Server Restart Policy (Mobile)

- If a change requires restarting Expo/Metro (for example Babel config, Metro config, NativeWind config, env/config loading, native modules), **always restart it automatically** so the user can test immediately.
- If a change is JS/TS-only and supports Fast Refresh, **do not restart**; explicitly tell the user: `No restart needed (JS-only change).`
- If there is a port conflict, resolve it automatically (reuse or switch port) and report the active port.
- Default Expo connection mode is **Tunnel** for all interactive testing sessions. Start with `--tunnel` unless explicitly requested otherwise.

## Feature Documentation Sync (Required)

- Treat `docs/features/` as a **living source of truth** for implemented feature behavior.
- Any task that changes feature logic, API behavior, data modeling, validation, or UX flow **must** update the corresponding `docs/features/feature-*.md` file in the same task.
- Update docs by **replacing/editing existing content** to reflect the current state. Do **not** append changelogs, timelines, or historical notes.
- If a new feature is introduced, create a new `docs/features/feature-*.md` file and update `docs/features/README.md` feature index and count.
- If scope shifts between features, update all impacted feature docs so PM/dev docs stay consistent with code.
- A task is not complete until code and matching feature docs are aligned.

## Output requirements

When finishing a task, report:

- **Summary**
- **Files changed**
- **Commands run** (or why you could not run them)
- **Follow-ups / risks**
