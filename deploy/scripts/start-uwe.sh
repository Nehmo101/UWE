#!/usr/bin/env bash
# Starts UWE Studio and Portal after build. Used by systemd (see deploy/systemd/).
set -Eeuo pipefail

UWE_HOME="${UWE_HOME:-/opt/uwe}"
UWE_ENV="${UWE_ENV:-/etc/uwe/uwe.env}"

# systemd does not load login shells — use a stable PATH before any command lookup.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

if [[ -f "$UWE_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$UWE_ENV"
  set +a
fi

UWE_HOME="${UWE_HOME:-/opt/uwe}"
STUDIO_PORT="${STUDIO_PORT:-${PORT:-3000}}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
HOST_BIND="${HOST:-${HOSTNAME:-0.0.0.0}}"
STUDIO_DIR="$UWE_HOME/apps/studio/.next/standalone"
PORTAL_DIR="$UWE_HOME/apps/portal/.next/standalone"
STUDIO_SERVER="$STUDIO_DIR/apps/studio/server.js"
PORTAL_SERVER="$PORTAL_DIR/apps/portal/server.js"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js not found in systemd PATH. Run setup-uwe-host.sh --repair." >&2
  exit 127
fi

PNPM_BIN="$(command -v pnpm || true)"
if [[ -z "$PNPM_BIN" ]]; then
  echo "pnpm not found in systemd PATH. Run setup-uwe-host.sh --repair." >&2
  exit 127
fi

echo "UWE start: UWE_HOME=$UWE_HOME"
echo "UWE start: node=$("$NODE_BIN" --version) path=$NODE_BIN"
echo "UWE start: pnpm=$("$PNPM_BIN" --version) path=$PNPM_BIN"
echo "UWE start: studio standalone=$STUDIO_DIR port=$STUDIO_PORT"
echo "UWE start: portal standalone=$PORTAL_DIR port=$PORTAL_PORT"
echo "UWE start: bind=$HOST_BIND"

if [[ ! -f "$STUDIO_SERVER" ]]; then
  echo "UWE standalone build missing — run: pnpm build (from $UWE_HOME)" >&2
  exit 1
fi

if [[ ! -f "$PORTAL_SERVER" ]]; then
  echo "Portal standalone build missing — run: pnpm build (from $UWE_HOME)" >&2
  exit 1
fi

STUDIO_PID=""
PORTAL_PID=""

cleanup() {
  local pid
  for pid in "$STUDIO_PID" "$PORTAL_PID"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

(
  cd "$STUDIO_DIR"
  export PORT="$STUDIO_PORT"
  export HOSTNAME="$HOST_BIND"
  exec "$NODE_BIN" apps/studio/server.js
) &
STUDIO_PID=$!

(
  cd "$PORTAL_DIR"
  export PORT="$PORTAL_PORT"
  export HOSTNAME="$HOST_BIND"
  exec "$NODE_BIN" apps/portal/server.js
) &
PORTAL_PID=$!

wait -n "$STUDIO_PID" "$PORTAL_PID"
exit 1
