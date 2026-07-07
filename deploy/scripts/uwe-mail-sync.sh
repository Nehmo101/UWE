#!/usr/bin/env bash
# Triggers automatic IMAP sync for all configured mail accounts via internal HTTP endpoint.
# Invoked by uwe-mail-sync.timer; enabled/interval come from UWE settings → schedule.json.
set -euo pipefail

UWE_HOME="${UWE_HOME:-/opt/uwe}"
UWE_ENV="${UWE_ENV:-/etc/uwe/uwe.env}"
LOG_TAG="uwe-mail-sync"

if [[ -f "$UWE_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$UWE_ENV"
  set +a
fi

# Must match the writer (packages/mail/src/schedule.ts):
# UWE_MAIL_DIR if set, else ${UWE_DATA_DIR}/mail (resolveDataDir), else repo-local.
MAIL_DIR="${UWE_MAIL_DIR:-${UWE_DATA_DIR:-${UWE_HOME}/data}/mail}"
SCHEDULE_FILE="${MAIL_DIR}/schedule.json"
MARKER_FILE="${MAIL_DIR}/last-run"

if [[ ! -f "$SCHEDULE_FILE" ]]; then
  exit 0
fi

ENABLED=$(grep -o '"enabled"[[:space:]]*:[[:space:]]*[a-z]*' "$SCHEDULE_FILE" | grep -o '[a-z]*$' || echo "false")
if [[ "$ENABLED" != "true" ]]; then
  exit 0
fi

INTERVAL=$(grep -o '"intervalMinutes"[[:space:]]*:[[:space:]]*[0-9]*' "$SCHEDULE_FILE" | grep -o '[0-9]*$' || echo "15")
[[ "$INTERVAL" =~ ^[0-9]+$ ]] || INTERVAL=15

NOW_EPOCH=$(date +%s)
LAST_EPOCH=0
if [[ -f "$MARKER_FILE" ]]; then
  LAST_EPOCH=$(cat "$MARKER_FILE" 2>/dev/null || echo 0)
fi

ELAPSED=$(( NOW_EPOCH - LAST_EPOCH ))
THRESHOLD=$(( INTERVAL * 60 ))

if (( ELAPSED < THRESHOLD )); then
  exit 0
fi

BASE_URL="${UWE_INTERNAL_BASE_URL:-http://127.0.0.1:3000}"
TOKEN="${STUDIO_API_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  logger -t "$LOG_TAG" "STUDIO_API_TOKEN not set — mail sync trigger skipped"
  exit 1
fi

if curl -fsS -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --max-time 30 \
  "${BASE_URL%/}/api/internal/mail-sync" >/dev/null; then
  mkdir -p "$MAIL_DIR"
  echo "$NOW_EPOCH" > "$MARKER_FILE"
  logger -t "$LOG_TAG" "mail sync enqueued (interval ${INTERVAL} min)"
else
  logger -t "$LOG_TAG" "mail sync trigger failed"
  exit 1
fi
