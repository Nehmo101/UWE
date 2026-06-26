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

BACKUP_DIR="${UWE_BACKUP_DIR:-./data/backups}"
SCHEDULE_FILE="${BACKUP_DIR}/schedule.json"

# Read schedule config if it exists
if [[ -f "$SCHEDULE_FILE" ]]; then
  ENABLED=$(grep -o '"enabled"[[:space:]]*:[[:space:]]*[a-z]*' "$SCHEDULE_FILE" | grep -o '[a-z]*$' || echo "true")
  if [[ "$ENABLED" == "false" ]]; then
    logger -t "$LOG_TAG" "automatic backup disabled by schedule config — skipping"
    exit 0
  fi

  FREQ=$(grep -o '"frequency"[[:space:]]*:[[:space:]]*"[^"]*"' "$SCHEDULE_FILE" | grep -o '"[^"]*"$' | tr -d '"' || echo "daily")
  if [[ "$FREQ" == "weekly" || "$FREQ" == "monthly" ]]; then
    LAST_BACKUP=$(ls -t "${BACKUP_DIR}"/uwe-backup-*.zip 2>/dev/null | head -1 || true)
    if [[ -n "$LAST_BACKUP" ]]; then
      LAST_EPOCH=$(stat -c %Y "$LAST_BACKUP" 2>/dev/null || echo "0")
      NOW_EPOCH=$(date +%s)
      DIFF_DAYS=$(( (NOW_EPOCH - LAST_EPOCH) / 86400 ))
      THRESHOLD=7
      [[ "$FREQ" == "monthly" ]] && THRESHOLD=30
      if (( DIFF_DAYS < THRESHOLD )); then
        logger -t "$LOG_TAG" "${FREQ} backup: last backup was ${DIFF_DAYS}d ago (threshold ${THRESHOLD}d) — skipping"
        exit 0
      fi
    fi
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  logger -t "$LOG_TAG" "pnpm not found — backup skipped"
  exit 1
fi

if pnpm backup:create; then
  logger -t "$LOG_TAG" "backup created in ${BACKUP_DIR}"
else
  logger -t "$LOG_TAG" "backup failed"
  exit 1
fi
