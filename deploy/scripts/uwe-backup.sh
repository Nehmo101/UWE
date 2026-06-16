#!/usr/bin/env bash
# Creates a timestamped UWE backup via the CLI. Invoked by uwe-backup.timer.
set -euo pipefail

UWE_HOME="${UWE_HOME:-/opt/uwe}"
UWE_ENV="${UWE_ENV:-/etc/uwe/uwe.env}"
LOG_TAG="uwe-backup"

if [[ -f "$UWE_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$UWE_ENV"
  set +a
fi

export PATH="/usr/local/bin:/usr/bin:/bin:${PNPM_HOME:-/usr/local/share/pnpm}:$PATH"

cd "$UWE_HOME"

if ! command -v pnpm >/dev/null 2>&1; then
  logger -t "$LOG_TAG" "pnpm not found — backup skipped"
  exit 1
fi

if pnpm backup:create; then
  logger -t "$LOG_TAG" "backup created in ${UWE_BACKUP_DIR:-./data/backups}"
else
  logger -t "$LOG_TAG" "backup failed"
  exit 1
fi
