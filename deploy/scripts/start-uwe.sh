#!/usr/bin/env bash
# Starts UWE Studio and Portal after build. Used by systemd (see deploy/systemd/).
set -euo pipefail

UWE_HOME="${UWE_HOME:-/opt/uwe}"
UWE_ENV="${UWE_ENV:-/etc/uwe/uwe.env}"

if [[ -f "$UWE_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$UWE_ENV"
  set +a
fi

STUDIO_PORT="${STUDIO_PORT:-${PORT:-3000}}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
HOST_BIND="${HOST:-${HOSTNAME:-0.0.0.0}}"
STUDIO_DIR="$UWE_HOME/apps/studio/.next/standalone"
PORTAL_DIR="$UWE_HOME/apps/portal/.next/standalone"

if [[ ! -f "$STUDIO_DIR/apps/studio/server.js" ]]; then
  echo "UWE standalone build missing — run: pnpm build:release" >&2
  exit 1
fi

(
  cd "$STUDIO_DIR"
  export PORT="$STUDIO_PORT"
  export HOSTNAME="$HOST_BIND"
  exec node apps/studio/server.js
) &
STUDIO_PID=$!

(
  cd "$PORTAL_DIR"
  export PORT="$PORTAL_PORT"
  export HOSTNAME="$HOST_BIND"
  exec node apps/portal/server.js
) &
PORTAL_PID=$!

cleanup() {
  kill "$STUDIO_PID" "$PORTAL_PID" 2>/dev/null || true
  wait "$STUDIO_PID" "$PORTAL_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

wait -n "$STUDIO_PID" "$PORTAL_PID"
exit 1
