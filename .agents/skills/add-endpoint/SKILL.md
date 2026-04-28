---
name: add-endpoint
description: Scaffold a new NestJS REST endpoint with controller, service, Zod schema, and tests. Use when user asks to add or create a new API endpoint or resource.
disable-model-invocation: true
---

Scaffold a new NestJS REST endpoint: $ARGUMENTS

## Project Conventions

- **Zod for all validation** — no class-validator, no ValidationPipe. Use `schema.safeParse(body)` in controllers
- **Controllers are thin** — validate input, delegate to service, return `{ data }`
- **All business logic in services** — computations, DB queries, side effects
- **`@CurrentUser()` for auth context** — never read `req.user` directly
- **All responses** use `{ data: T }` envelope
- **File naming**: kebab-case (e.g., `meal-logs.service.ts`)
- **PrismaService** for all database access, queries scoped to `user.id`
- Routes protected by default (global `AuthGuard`)

## Reference

- Existing endpoints: `apps/api/src/` (auth, meals, etc.)
- API patterns in AGENTS.md: Controller/Service/DTO/Module pattern
- Shared schemas: `packages/shared/`

## Steps

1. Read 1-2 existing modules in `apps/api/src/` to match exact patterns (imports, decorators, error handling)
2. Create the following files using kebab-case naming:

   **`apps/api/src/<resource>/<resource>.module.ts`**
   - NestJS `@Module` with controllers and providers

   **`apps/api/src/<resource>/<resource>.controller.ts`**
   - Zod `safeParse` validation (throw `BadRequestException(parsed.error.issues)` on failure)
   - `@CurrentUser()` decorator for auth context
   - `{ data: T }` response envelope
   - Thin: validate, delegate, return

   **`apps/api/src/<resource>/<resource>.service.ts`**
   - `@Injectable()` with `PrismaService` injection
   - All queries scoped to `userId`
   - Prisma Decimal fields converted with `Number()`
   - Dates returned as ISO strings

   **`apps/api/src/<resource>/schemas/<resource>.schema.ts`**
   - Zod schemas for create/update DTOs
   - Exported types via `z.infer`

   **`apps/api/src/<resource>/<resource>.spec.ts`**
   - Mock `PrismaService` as plain object of `jest.Mock`
   - Test categories: happy path, validation errors, auth, edge cases

3. Register the new module in `apps/api/src/app.module.ts`
4. Run `npm run typecheck --workspace=apps/api` to verify no type errors
5. Run `npm run test --workspace=apps/api` to verify tests pass
6. Report what was created and where it was registered
