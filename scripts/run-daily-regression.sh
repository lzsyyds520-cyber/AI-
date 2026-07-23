#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
RUN_DIR="$ROOT_DIR/artifacts/daily/$STAMP"

mkdir -p "$RUN_DIR"

{
  echo "PredX Pro daily regression"
  echo "started_at=$(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "base_url=${BASE_URL:-https://predx.pro}"
  echo "command=npm run test:daily"
} > "$RUN_DIR/meta.txt"

cd "$ROOT_DIR"
npm run test:daily | tee "$RUN_DIR/run.log"

if [ -d "$ROOT_DIR/playwright-report" ]; then
  cp -R "$ROOT_DIR/playwright-report" "$RUN_DIR/playwright-report"
fi

echo "Daily regression artifacts saved to: $RUN_DIR"
