#!/usr/bin/env bash
# Starts UWE Studio, Portal and — wenn gebaut — Family after build.
# Used by systemd (see deploy/systemd/).
set -Eeuo pipefail

UWE_HOME="${UWE_HOME:-/opt/uwe}"
UWE_ENV="${UWE_ENV:-/etc/uwe/uwe.env}"
SYSTEMD_PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# systemd does not load login shells — use a stable PATH before any command lookup.
apply_systemd_path() {
  export PATH="$SYSTEMD_PATH"
}

resolve_node_binary() {
  local node_bin="${NODE_BIN:-}"

  apply_systemd_path

  if [[ -n "$node_bin" && -x "$node_bin" ]]; then
    printf '%s\n' "$node_bin"
    return 0
  fi

  node_bin="$(command -v node 2>/dev/null || true)"
  if [[ -n "$node_bin" && -x "$node_bin" ]]; then
    printf '%s\n' "$node_bin"
    return 0
  fi

  if [[ -x "/usr/bin/node" ]]; then
    printf '%s\n' "/usr/bin/node"
    return 0
  fi

  return 1
}

apply_systemd_path

if [[ -f "$UWE_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$UWE_ENV"
  set +a
  # uwe.env must not override the systemd PATH (e.g. nvm/home paths break the service user).
  apply_systemd_path
fi

UWE_HOME="${UWE_HOME:-/opt/uwe}"
STUDIO_PORT="${STUDIO_PORT:-${PORT:-3000}}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
FAMILY_PORT="${FAMILY_PORT:-3004}"
HOST_BIND="${HOST:-${HOSTNAME:-0.0.0.0}}"
STUDIO_DIR="$UWE_HOME/apps/studio/.next/standalone"
PORTAL_DIR="$UWE_HOME/apps/portal/.next/standalone"
FAMILY_DIR="$UWE_HOME/apps/family/.next/standalone"
STUDIO_SERVER="$STUDIO_DIR/apps/studio/server.js"
PORTAL_SERVER="$PORTAL_DIR/apps/portal/server.js"
FAMILY_SERVER="$FAMILY_DIR/apps/family/server.js"
REPAIR_CMD="sudo bash ${UWE_HOME}/deploy/scripts/setup-uwe-host.sh --repair"

NODE_BIN="$(resolve_node_binary || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js not found in systemd PATH. Run: ${REPAIR_CMD}" >&2
  exit 127
fi

echo "UWE start: UWE_HOME=$UWE_HOME"
echo "UWE start: UWE_ENV=$UWE_ENV"
echo "UWE start: node=$("$NODE_BIN" --version) path=$NODE_BIN"
echo "UWE start: studio standalone=$STUDIO_DIR port=$STUDIO_PORT"
echo "UWE start: portal standalone=$PORTAL_DIR port=$PORTAL_PORT"
echo "UWE start: family standalone=$FAMILY_DIR port=$FAMILY_PORT"
echo "UWE start: bind=$HOST_BIND"

if [[ ! -f "$STUDIO_SERVER" ]]; then
  echo "UWE standalone build missing — run: ${REPAIR_CMD}" >&2
  exit 1
fi

if [[ ! -f "$PORTAL_SERVER" ]]; then
  echo "Portal standalone build missing — run: ${REPAIR_CMD}" >&2
  exit 1
fi

STUDIO_PID=""
PORTAL_PID=""
FAMILY_PID=""

cleanup() {
  local pid
  for pid in "$STUDIO_PID" "$PORTAL_PID" "$FAMILY_PID"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

on_signal() {
  cleanup
  exit 0
}

trap cleanup EXIT
trap on_signal INT TERM

echo "Starting Studio on PORT=$STUDIO_PORT"
(
  cd "$STUDIO_DIR"
  export PORT="$STUDIO_PORT"
  export HOSTNAME="$HOST_BIND"
  exec "$NODE_BIN" apps/studio/server.js
) &
STUDIO_PID=$!

echo "Starting Portal on PORT=$PORTAL_PORT"
(
  cd "$PORTAL_DIR"
  export PORT="$PORTAL_PORT"
  export HOSTNAME="$HOST_BIND"
  exec "$NODE_BIN" apps/portal/server.js
) &
PORTAL_PID=$!

# Family ist optional: die App ist häkchen-gegated (`Family`) und nicht jede
# Installation baut sie. Liegt ein Standalone-Build vor, läuft sie mit — sonst
# zeigt jeder Family-Link ins Leere. Anders als Studio/Portal bindet sie auf
# Loopback: erreichbar über den Tunnel/Reverse-Proxy, nicht direkt im LAN.
if [[ -f "$FAMILY_SERVER" ]]; then
  echo "Starting Family on PORT=$FAMILY_PORT (bind=127.0.0.1)"
  (
    cd "$FAMILY_DIR"
    export PORT="$FAMILY_PORT"
    export HOSTNAME="127.0.0.1"
    exec "$NODE_BIN" apps/family/server.js
  ) &
  FAMILY_PID=$!
else
  echo "Family standalone build fehlt — Family wird nicht gestartet (baut mit: pnpm build)."
fi

WAIT_PIDS=("$STUDIO_PID" "$PORTAL_PID")
if [[ -n "$FAMILY_PID" ]]; then
  WAIT_PIDS+=("$FAMILY_PID")
fi

wait -n "${WAIT_PIDS[@]}"
echo "UWE process exited — stopping remaining services." >&2
exit 1
