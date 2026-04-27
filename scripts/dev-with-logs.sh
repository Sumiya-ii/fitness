#!/usr/bin/env bash
# Starts Expo (mobile), API, and Worker in parallel with all output teed to /tmp/coach-*.log
# so Claude can read logs while you test the app on a physical device.
#
# Usage:  ./scripts/dev-with-logs.sh
# Stop:   Ctrl-C (kills all three)
#
# Logs:
#   /tmp/coach-mobile.log   — Expo / Metro / JS console
#   /tmp/coach-api.log      — NestJS API
#   /tmp/coach-worker.log   — BullMQ worker

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MOBILE_LOG=/tmp/coach-mobile.log
API_LOG=/tmp/coach-api.log
WORKER_LOG=/tmp/coach-worker.log

# Truncate previous logs so each session starts clean
: > "$MOBILE_LOG"
: > "$API_LOG"
: > "$WORKER_LOG"

echo "Logs:"
echo "  mobile -> $MOBILE_LOG"
echo "  api    -> $API_LOG"
echo "  worker -> $WORKER_LOG"
echo ""

pids=()

cleanup() {
  echo ""
  echo "Stopping..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# API
( cd "$ROOT" && npm run start:dev --workspace=apps/api ) > "$API_LOG" 2>&1 &
pids+=($!)
echo "[api]    pid $!"

# Worker
( cd "$ROOT" && npm run start:dev --workspace=apps/worker ) > "$WORKER_LOG" 2>&1 &
pids+=($!)
echo "[worker] pid $!"

# Mobile (Expo) — tunnel mode so physical device works off any network
( cd "$ROOT/apps/mobile" && npx expo start --tunnel ) > "$MOBILE_LOG" 2>&1 &
pids+=($!)
echo "[mobile] pid $!"

echo ""
echo "All three running. Tail any log with:"
echo "  tail -f $MOBILE_LOG"
echo ""
echo "Press Ctrl-C to stop everything."

wait
