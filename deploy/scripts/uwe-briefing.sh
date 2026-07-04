#!/usr/bin/env bash
# Triggers the UWE Morning Briefing via the internal HTTP endpoint so the job
# dispatches inside the running Next server. Invoked by uwe-briefing.timer.
#
# Der Timer tickt häufig (alle 15 min); OB und WANN das Briefing läuft, kommt aus
# UWE: Toggle + Uhrzeit werden zur host-lesbaren schedule.json gesynct
# (docs/engineering/self-service-config.md). Läuft max. einmal pro Tag zur Zielzeit.
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

BRIEFING_DIR="${UWE_BRIEFING_DIR:-${UWE_HOME}/data/briefings}"
SCHEDULE_FILE="${BRIEFING_DIR}/schedule.json"
MARKER_FILE="${BRIEFING_DIR}/last-run"

# Ohne schedule.json ist das Auto-Briefing in UWE noch nicht aktiviert → nichts tun.
if [[ ! -f "$SCHEDULE_FILE" ]]; then
  exit 0
fi

ENABLED=$(grep -o '"enabled"[[:space:]]*:[[:space:]]*[a-z]*' "$SCHEDULE_FILE" | grep -o '[a-z]*$' || echo "false")
if [[ "$ENABLED" != "true" ]]; then
  exit 0
fi

SCHED_TIME=$(grep -o '"time"[[:space:]]*:[[:space:]]*"[^"]*"' "$SCHEDULE_FILE" | grep -o '"[^"]*"$' | tr -d '"' || echo "07:00")
[[ "$SCHED_TIME" =~ ^[0-2][0-9]:[0-5][0-9]$ ]] || SCHED_TIME="07:00"

TARGET_MINUTES=$((10#${SCHED_TIME%%:*} * 60 + 10#${SCHED_TIME##*:}))
NOW_MINUTES=$((10#$(date +%H) * 60 + 10#$(date +%M)))
TODAY=$(date +%F)

# Schon heute gelaufen? → fertig.
if [[ -f "$MARKER_FILE" && "$(cat "$MARKER_FILE" 2>/dev/null)" == "$TODAY" ]]; then
  exit 0
fi

# Noch vor der Zielzeit? → später erneut (Timer tickt weiter).
if (( NOW_MINUTES < TARGET_MINUTES )); then
  exit 0
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
  mkdir -p "$BRIEFING_DIR"
  echo "$TODAY" > "$MARKER_FILE"
  logger -t "$LOG_TAG" "morning briefing enqueued (scheduled ${SCHED_TIME})"
else
  logger -t "$LOG_TAG" "morning briefing trigger failed"
  exit 1
fi
