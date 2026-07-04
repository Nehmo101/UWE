#!/usr/bin/env bash
# Triggers the UWE Morning Briefing via the internal HTTP endpoint so the job
# dispatches inside the running Next server. Invoked by uwe-briefing.timer.
set -euo pipefail

UWE_HOME="${UWE_HOME:-/opt/uwe}"
UWE_ENV="${UWE_ENV:-/etc/uwe/uwe.env}"
LOG_TAG="uwe-briefing"

if [[ -f "$UWE_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$UWE_ENV"
  set +a
fi

# Aus UWE steuerbar: der Toggle in den Studio-Settings wird zu dieser host-lesbaren
# JSON gesynct (siehe docs/engineering/self-service-config.md). "enabled": false → skip.
BRIEFING_DIR="${UWE_BRIEFING_DIR:-${UWE_HOME}/data/briefings}"
SCHEDULE_FILE="${BRIEFING_DIR}/schedule.json"
if [[ -f "$SCHEDULE_FILE" ]]; then
  ENABLED=$(grep -o '"enabled"[[:space:]]*:[[:space:]]*[a-z]*' "$SCHEDULE_FILE" | grep -o '[a-z]*$' || echo "true")
  if [[ "$ENABLED" == "false" ]]; then
    logger -t "$LOG_TAG" "automatic briefing disabled by schedule config — skipping"
    exit 0
  fi
fi

BASE_URL="${UWE_INTERNAL_BASE_URL:-http://127.0.0.1:3000}"
TOKEN="${STUDIO_API_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  logger -t "$LOG_TAG" "STUDIO_API_TOKEN not set — briefing trigger skipped"
  exit 1
fi

if curl -fsS -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --max-time 30 \
  "${BASE_URL%/}/api/internal/briefing" >/dev/null; then
  logger -t "$LOG_TAG" "morning briefing enqueued"
else
  logger -t "$LOG_TAG" "morning briefing trigger failed"
  exit 1
fi
