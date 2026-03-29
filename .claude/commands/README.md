# Coach — Custom Claude Commands

Quick reference for all available slash commands. Type `/command-name` in Claude Code to run.

---

## Scaffolding Commands

### `/scaffold-api <resource-name> [fields...]`
Generates a complete NestJS API resource: controller, service, DTO (Zod), module, and test spec. Registers it in app.module.ts and verifies with typecheck + tests.

```
/scaffold-api exercise-logs
/scaffold-api supplements name:string dosage:number frequency:string
```

### `/scaffold-screen <ScreenName> [stack-name]`
Creates a new React Native screen with NativeWind styling, navigation types, loading/error/empty states, and optional Zustand store.

```
/scaffold-screen ExerciseHistory
/scaffold-screen SupplementTracker LogStack
```

### `/db-evolve <model-name> [field:type ...]`
Adds or modifies a Prisma model, regenerates the client, and pushes the schema. Optionally chains into `/scaffold-api`.

```
/db-evolve Supplement name:String dosage:Float unit:String
/db-evolve add userId index to WeightLog
```

### `/i18n-add <dotted.key> <english> [mongolian]`
Adds translation keys to both en.ts and mn.ts at the correct nested path.

```
/i18n-add supplements.title "Supplements" "Нэмэлт тэжээл"
/i18n-add exercise.calories "Calories burned"
```

---

## Diagnostics Commands

### `/diagnose`
Pulls all unresolved Sentry issues (API + mobile) and recent Railway logs, analyzes error patterns, and presents a severity-ranked summary. Offers to fix code bugs automatically.

```
/diagnose
```

### `/fix-sentry <ISSUE_ID>`
Fixes a specific Sentry issue. Fetches the full stack trace, finds the source code, implements a minimal fix, and verifies with tests.

```
/fix-sentry 7369611835
/fix-sentry NODE-1
```

### `/voice-debug`
End-to-end analysis of the voice/STT pipeline: mobile recording, API upload, S3 storage, Whisper transcription, nutrition parsing, and draft polling. Checks for recent voice-related Sentry errors.

```
/voice-debug
```

### `/catchup`
Start-of-session briefing. Shows: recent commits (48h), uncommitted changes, unresolved Sentry errors, Railway status, and recommended next actions.

```
/catchup
```

---

## Quality & Deployment Commands

### `/preflight`
Pre-commit quality gate. Runs format, lint, typecheck, and tests across all workspaces. Auto-fixes issues and reports final PASS/FAIL status.

```
/preflight
```

### `/deploy`
Full deployment workflow: runs all CI checks locally, pushes to main, monitors Railway deployment, verifies health endpoint, and checks for new Sentry errors post-deploy.

```
/deploy
```

### `/sync`
Syncs the development environment: `npm ci`, Prisma client generation, typecheck all workspaces, run all tests. Reports readiness status.

```
/sync
```

---

## Tips

- **Arguments**: everything after the command name is passed as `$ARGUMENTS`
- **Dynamic context**: commands inject live data (git status, Sentry issues) when invoked
- **Chaining**: after `/db-evolve`, use `/scaffold-api` to generate the full API layer
- **Start of day**: run `/catchup` to see what happened overnight (including scheduled monitor fixes)
- **Before pushing**: run `/preflight` to catch issues before CI
- **New feature flow**: `/db-evolve` -> `/scaffold-api` -> `/scaffold-screen` -> `/preflight` -> `/deploy`
