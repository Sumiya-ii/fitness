---
description: Scaffold a new NestJS API resource (controller, service, DTO, module, spec) following existing patterns
argument-hint: <resource-name> [fields...]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Scaffold a New API Resource

Create a complete NestJS API resource for: **$ARGUMENTS**

## Reference Patterns

Use these existing files as the canonical pattern to follow:

### Controller pattern:
!`head -60 apps/api/src/foods/foods.controller.ts`

### Service pattern:
!`head -60 apps/api/src/foods/foods.service.ts`

### DTO pattern:
!`cat apps/api/src/foods/foods.dto.ts`

### Module pattern:
!`cat apps/api/src/foods/foods.module.ts`

### Test pattern:
!`head -80 apps/api/src/foods/foods.service.spec.ts`

## Instructions

1. Create a new directory at `apps/api/src/<resource>/`
2. Generate these files following the patterns above EXACTLY:
   - `<resource>.controller.ts` — REST endpoints with Zod validation, `@UseGuards(FirebaseAuthGuard)`, responses wrapped in `{ data: ... }`
   - `<resource>.service.ts` — Prisma queries, NotFoundException on missing records
   - `<resource>.dto.ts` — Zod schemas (create, update, query) with `z.infer` types
   - `<resource>.module.ts` — NestJS module importing PrismaModule
   - `<resource>.service.spec.ts` — Jest tests with inline PrismaService mocks
3. Register the module in `apps/api/src/app.module.ts`
4. Run `npm run typecheck --workspace=apps/api` to verify
5. Run `npm run test --workspace=apps/api` to verify tests pass
6. Commit the new resource
