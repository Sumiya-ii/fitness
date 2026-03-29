---
description: Add or modify a Prisma model, regenerate the client, push schema, and scaffold the API layer
argument-hint: <model-name> [field:type field:type ...]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Evolve the Database Schema

Add/modify model: **$ARGUMENTS**

## Current Schema

!`grep -n "^model " apps/api/prisma/schema.prisma`

## Current Env

!`echo "DATABASE_URL is ${DATABASE_URL:+set}${DATABASE_URL:-NOT SET}"`

## Instructions

1. Read the full Prisma schema to understand existing models and relations:
   `apps/api/prisma/schema.prisma`
2. Add or modify the model following existing conventions:
   - Use `@id @default(cuid())` for primary keys
   - Add `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
   - Add proper relations with `@relation` and cascade deletes where user-owned
   - Add indexes on frequently queried fields (`@@index([userId, createdAt])`)
3. Run `npm run db:generate --workspace=apps/api` to regenerate the Prisma client
4. Run `npm run db:push --workspace=apps/api` to push schema (if DATABASE_URL is set)
5. Verify with `npm run typecheck --workspace=apps/api`
6. Commit the schema change separately from any API scaffolding
7. Ask if I should also scaffold the API resource with `/scaffold-api`
