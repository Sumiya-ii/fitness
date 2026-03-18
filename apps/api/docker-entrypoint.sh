#!/bin/sh
set -e

echo "Running database migrations..."
npm run db:migrate:deploy --workspace=apps/api

echo "Starting API..."
exec node apps/api/dist/main.js
