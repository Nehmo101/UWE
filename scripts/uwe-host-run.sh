#!/usr/bin/env bash
# Foreground runner for UWE Studio + Portal (systemd ExecStart or manual supervisor).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/uwe-host-lib.sh"

uwe_host_ensure_state_dirs
uwe_host_load_env || true
STUDIO_PORT="${STUDIO_PORT:-3000}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
HOST_BIND="${HOST_BIND:-0.0.0.0}"

if [[ ! -f "$STUDIO_SERVER_JS" || ! -f "$PORTAL_SERVER_JS" ]]; then
  uwe_host_error "Standalone-Build fehlt. Bitte zuerst ausführen: pnpm host:start"
  exit 1
fi

STUDIO_PID=""
PORTAL_PID=""

cleanup() {
  local sig="${1:-EXIT}"
  if [[ -n "$STUDIO_PID" ]]; then
    kill "$STUDIO_PID" 2>/dev/null || true
  fi
  if [[ -n "$PORTAL_PID" ]]; then
    kill "$PORTAL_PID" 2>/dev/null || true
  fi
  wait "$STUDIO_PID" "$PORTAL_PID" 2>/dev/null || true
  uwe_host_clear_pid_file "$UWE_HOST_STUDIO_PID_FILE"
  uwe_host_clear_pid_file "$UWE_HOST_PORTAL_PID_FILE"
  uwe_host_clear_pid_file "$UWE_HOST_SUPERVISOR_PID_FILE"
  if [[ "$sig" != "EXIT" ]]; then
  uwe_host_info "UWE beendet ($sig)."
  fi
}

trap 'cleanup INT' INT
trap 'cleanup TERM' TERM
trap 'cleanup EXIT' EXIT

echo $$ >"$UWE_HOST_SUPERVISOR_PID_FILE"

(
  cd "$STUDIO_STANDALONE_DIR"
  export PORT="$STUDIO_PORT"
  export HOSTNAME="$HOST_BIND"
  export NODE_ENV="${NODE_ENV:-production}"
  exec node apps/studio/server.js
) &
STUDIO_PID=$!
echo "$STUDIO_PID" >"$UWE_HOST_STUDIO_PID_FILE"

(
  cd "$PORTAL_STANDALONE_DIR"
  export PORT="$PORTAL_PORT"
  export HOSTNAME="$HOST_BIND"
  export NODE_ENV="${NODE_ENV:-production}"
  exec node apps/portal/server.js
) &
PORTAL_PID=$!
echo "$PORTAL_PID" >"$UWE_HOST_PORTAL_PID_FILE"

uwe_host_info "UWE läuft (Studio PID $STUDIO_PID, Portal PID $PORTAL_PID, Bind $HOST_BIND)."

wait -n "$STUDIO_PID" "$PORTAL_PID"
exit 1
