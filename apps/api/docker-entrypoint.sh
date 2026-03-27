#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma db push --schema=apps/api/prisma/schema.prisma

echo "Starting API..."
exec node apps/api/dist/main.js
