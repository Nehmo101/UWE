#!/usr/bin/env bash
# Liveness check for UWE Studio/Portal/Startseite — restarts uwe.service if an
# origin stops responding while its process is still alive (e.g. an event-loop
# deadlock). Installed via deploy/systemd/uwe-healthcheck.service + .timer.
set -euo pipefail

UWE_ENV="${UWE_ENV:-/etc/uwe/uwe.env}"
if [[ -f "$UWE_ENV" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$UWE_ENV"
  set +a
fi

STUDIO_PORT="${STUDIO_PORT:-${PORT:-3000}}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
LANDING_PORT="${LANDING_PORT:-3103}"
TIMEOUT="${UWE_HEALTHCHECK_TIMEOUT:-5}"
FAIL_THRESHOLD="${UWE_HEALTHCHECK_FAIL_THRESHOLD:-2}"
STATE_FILE="/run/uwe-healthcheck.fails"

check() {
  local port="$1"
  curl -fsS -o /dev/null --max-time "$TIMEOUT" "http://127.0.0.1:${port}/"
}

# Die Apex-Startseite wird bewusst milder behandelt: lauscht dort niemand
# (curl-Exit 7), läuft der Host noch ohne Landing-Build — ein Neustart würde das
# nicht heilen, sondern nur Studio und Portal mitreißen. Ein offener, aber
# stummer Port zählt dagegen wie Studio/Portal als unresponsive.
check_landing() {
  local code=0
  curl -fsS -o /dev/null --max-time "$TIMEOUT" "http://127.0.0.1:${LANDING_PORT}/api/health" || code=$?
  if [[ "$code" -eq 0 ]]; then
    return 0
  fi
  if [[ "$code" -eq 7 ]]; then
    echo "UWE healthcheck: Startseite (:$LANDING_PORT) lauscht nicht — Landing-Build fehlt (setup-uwe-host.sh --repair)" >&2
    return 0
  fi
  return 1
}

if check "$STUDIO_PORT" && check "$PORTAL_PORT" && check_landing; then
  rm -f "$STATE_FILE"
  echo "UWE healthcheck: Studio (:$STUDIO_PORT), Portal (:$PORTAL_PORT) and Startseite (:$LANDING_PORT) OK"
  exit 0
fi

fails=0
[[ -f "$STATE_FILE" ]] && fails="$(<"$STATE_FILE")"
fails=$((fails + 1))

if (( fails < FAIL_THRESHOLD )); then
  echo "$fails" > "$STATE_FILE"
  echo "UWE healthcheck: unresponsive ($fails/$FAIL_THRESHOLD) — waiting for next run" >&2
  exit 0
fi

rm -f "$STATE_FILE"
echo "UWE healthcheck: unresponsive $fails times in a row — restarting uwe.service" >&2
systemctl restart uwe.service
