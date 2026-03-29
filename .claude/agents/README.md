# Coach — Custom Subagents

Specialized AI agents with deep domain knowledge of the Coach codebase. Each agent has restricted tools, focused prompts, and persistent memory.

---

## Quick Reference

| Agent | Expertise | Model | Tools | Memory |
|-------|-----------|-------|-------|--------|
| `api-expert` | NestJS backend (controllers, services, DTOs, modules) | Sonnet | Full | Yes |
| `mobile-expert` | React Native (screens, stores, hooks, navigation) | Sonnet | Full | Yes |
| `database-expert` | Prisma schema, PostgreSQL, query optimization | Sonnet | Full | Yes |
| `ai-pipeline` | Vision AI, STT, coaching LLM, prompt engineering | **Opus** | Full | Yes |
| `worker-expert` | BullMQ processors, async jobs, notifications | Sonnet | Full | Yes |
| `debugger` | Sentry errors, Railway logs, production debugging | Sonnet | Full | Yes |
| `test-expert` | Jest tests, mocking, coverage | Sonnet | Full | Yes |
| `reviewer` | Code review, security audit, architecture analysis | Sonnet | **Read-only** | No |

---

## How to Use

### Method 1: Natural Language (Recommended)
Just describe what you need and mention the domain:

```
"Use the api-expert to add a supplements endpoint"
"Have the debugger investigate the PrismaClientKnownRequestError in Sentry"
"Ask the reviewer to check my last commit"
"Use the ai-pipeline agent to improve the Mongolian food recognition prompt"
```

### Method 2: @-mention (Explicit)
Directly invoke a specific agent:

```
@api-expert add CRUD endpoints for exercise logs
@mobile-expert create a new SupplementTracker screen
@database-expert add a Supplement model with proper indexes
@debugger why is NODE-1 happening in Sentry?
@test-expert write tests for the supplements service
@reviewer review the last 3 commits
@worker-expert add a new queue processor for supplement reminders
@ai-pipeline improve the STT prompt for Mongolian food names
```

### Method 3: Chaining Agents
Build a full feature by chaining specialists:

```
1. @database-expert "Add a Supplement model"
2. @api-expert "Scaffold the supplements API resource"
3. @test-expert "Write comprehensive tests for the supplements service"
4. @mobile-expert "Create the SupplementTracker screen"
5. @reviewer "Review everything we just built"
```

---

## When to Use Which Agent

### Building a new feature end-to-end
1. `database-expert` → design the data model
2. `api-expert` → build the API endpoints
3. `test-expert` → write tests
4. `mobile-expert` → build the UI
5. `reviewer` → quality check

### Debugging a production issue
1. `debugger` → investigate Sentry error and Railway logs
2. Relevant expert → fix the identified issue
3. `test-expert` → add regression test
4. `reviewer` → verify the fix

### Working on AI features
- `ai-pipeline` → prompt engineering, vision AI, STT, coaching (uses Opus for deeper reasoning)

### Background job work
- `worker-expert` → new processors, job scheduling, notification delivery

### Code review / security audit
- `reviewer` → read-only analysis, won't modify any files

---

## Agent Memory

Agents with `memory: project` learn across sessions. Their memory is stored in `.claude/agent-memory/<agent-name>/`. Over time, they build up knowledge about:

- Code patterns and conventions specific to their domain
- Past debugging discoveries and root causes
- Architecture decisions and trade-offs
- Common gotchas and edge cases

This means the more you use an agent, the better it gets at its job.

---

## Design Decisions

**Why Opus for ai-pipeline?**
AI prompt engineering and vision pipeline debugging require deeper reasoning. The cost is justified for this high-complexity, high-impact domain.

**Why read-only for reviewer?**
Code reviews should analyze without modifying. The reviewer can't accidentally introduce bugs.

**Why project memory?**
Agents learn project-specific patterns that are more valuable than generic knowledge. Memory persists across conversations.

**Why Sonnet for most agents?**
Best balance of capability and speed. Sonnet handles 90% of tasks well. Opus reserved for the most complex domain (AI/ML pipelines).
