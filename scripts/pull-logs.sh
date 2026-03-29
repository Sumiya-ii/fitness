#!/bin/bash
# Pull production logs from Railway for both API and Worker services.
# Usage: ./scripts/pull-logs.sh [lines] [output_dir]
#   lines      — number of log lines to fetch per service (default: 500)
#   output_dir — directory to write logs to (default: ./logs)

set -euo pipefail

LINES="${1:-500}"
OUTPUT_DIR="${2:-./logs}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$OUTPUT_DIR"

echo "Pulling last $LINES lines from Railway..."

# Pull API logs
echo "  → coach-api..."
railway logs --lines "$LINES" -s coach-api 2>/dev/null > "$OUTPUT_DIR/api_${TIMESTAMP}.log" || {
  echo "  ⚠ Failed to pull API logs (is Railway CLI linked?)"
}

# Pull Worker logs
echo "  → coach-worker..."
railway logs --lines "$LINES" -s coach-worker 2>/dev/null > "$OUTPUT_DIR/worker_${TIMESTAMP}.log" || {
  echo "  ⚠ Failed to pull Worker logs (is Railway CLI linked?)"
}

echo ""
echo "Logs saved to $OUTPUT_DIR/"
ls -lh "$OUTPUT_DIR"/*_${TIMESTAMP}.log 2>/dev/null

# Quick error summary
echo ""
echo "=== Error Summary ==="
for f in "$OUTPUT_DIR"/*_${TIMESTAMP}.log; do
  service=$(basename "$f" | sed 's/_[0-9].*//');
  error_count=$(grep -ciE '"level":\s*[56]0|error|ERR|WARN|failed|exception|crash|fatal|unhandled' "$f" 2>/dev/null || echo "0")
  echo "  $service: $error_count potential error lines"
done
