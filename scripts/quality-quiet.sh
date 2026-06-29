#!/usr/bin/env bash
# Agent-friendly quality gate: full log to temp file; on failure print tail only.
set -o pipefail

LOG="$(mktemp -t uwe-quality.XXXXXX.log)"
trap 'rm -f "$LOG"' EXIT

echo "Running pnpm quality (full log: $LOG) ..."

if pnpm quality >"$LOG" 2>&1; then
  echo "pnpm quality: PASS"
  exit 0
fi

echo "pnpm quality: FAIL"
echo "--- last 60 lines ---"
tail -n 60 "$LOG"
echo "--- full log: $LOG ---"
exit 1
