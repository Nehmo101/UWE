#!/usr/bin/env bash
# Starts UWE Studio, Portal, the Apex-Startseite and — wenn gebaut — Family.
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
LANDING_PORT="${LANDING_PORT:-3103}"
HOST_BIND="${HOST:-${HOSTNAME:-0.0.0.0}}"
STUDIO_DIR="$UWE_HOME/apps/studio/.next/standalone"
PORTAL_DIR="$UWE_HOME/apps/portal/.next/standalone"
FAMILY_DIR="$UWE_HOME/apps/family/.next/standalone"
LANDING_DIR="$UWE_HOME/apps/landing/.next/standalone"
STUDIO_SERVER="$STUDIO_DIR/apps/studio/server.js"
PORTAL_SERVER="$PORTAL_DIR/apps/portal/server.js"
FAMILY_SERVER="$FAMILY_DIR/apps/family/server.js"
LANDING_SERVER="$LANDING_DIR/apps/landing/server.js"
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
echo "UWE start: landing standalone=$LANDING_DIR port=$LANDING_PORT"
echo "UWE start: bind=$HOST_BIND"

if [[ ! -f "$STUDIO_SERVER" ]]; then
  echo "UWE standalone build missing — run: ${REPAIR_CMD}" >&2
  exit 1
fi

if [[ ! -f "$PORTAL_SERVER" ]]; then
  echo "Portal standalone build missing — run: ${REPAIR_CMD}" >&2
  exit 1
fi

# Die Startseite ist der Apex-Origin (apps/landing). Fehlt ihr Build, läuft der
# Dienst bewusst trotzdem weiter: ohne sie ist nur die Hauptdomain kaputt, ein
# harter Abbruch nähme zusätzlich Studio und Portal mit. Der fehlende Build wird
# hier und in setup-uwe-host.sh (--healthcheck) laut gemeldet.
LANDING_AVAILABLE=1
if [[ ! -f "$LANDING_SERVER" ]]; then
  LANDING_AVAILABLE=0
  echo "Landing standalone build missing ($LANDING_SERVER) — Apex-Startseite bleibt aus. Run: ${REPAIR_CMD}" >&2
fi

STUDIO_PID=""
PORTAL_PID=""
FAMILY_PID=""
LANDING_PID=""

cleanup() {
  local pid
  for pid in "$STUDIO_PID" "$PORTAL_PID" "$FAMILY_PID" "$LANDING_PID"; do
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
#
# Vor dem Next-Server sitzt der DAV-Methoden-Proxy: Next kennt kein
# PROPFIND/REPORT, der iOS-CalDAV-Account braucht beides. Der Proxy hält
# $FAMILY_PORT, der Next-Server läuft intern auf $FAMILY_PORT+10 (Loopback).
# Fehlt das Proxy-Skript (ältere Checkouts), startet Family wie bisher direkt —
# dann funktioniert nur der CalDAV-Teil nicht.
FAMILY_DAV_PROXY="$UWE_HOME/deploy/scripts/uwe-dav-proxy.mjs"
if [[ -f "$FAMILY_SERVER" ]]; then
  if [[ -f "$FAMILY_DAV_PROXY" ]]; then
    echo "Starting Family on PORT=$FAMILY_PORT (bind=127.0.0.1, DAV-Proxy, intern $((FAMILY_PORT + 10)))"
    (
      exec "$NODE_BIN" "$FAMILY_DAV_PROXY" \
        --listen "$FAMILY_PORT" --upstream "$((FAMILY_PORT + 10))" --host 127.0.0.1 \
        --child-cwd "$FAMILY_DIR" -- "$NODE_BIN" apps/family/server.js
    ) &
    FAMILY_PID=$!
  else
    echo "Starting Family on PORT=$FAMILY_PORT (bind=127.0.0.1, ohne DAV-Proxy)"
    (
      cd "$FAMILY_DIR"
      export PORT="$FAMILY_PORT"
      export HOSTNAME="127.0.0.1"
      exec "$NODE_BIN" apps/family/server.js
    ) &
    FAMILY_PID=$!
  fi
else
  echo "Family standalone build fehlt — Family wird nicht gestartet (baut mit: pnpm build)."
fi

if [[ "$LANDING_AVAILABLE" -eq 1 ]]; then
  echo "Starting Landing on PORT=$LANDING_PORT"
  (
    cd "$LANDING_DIR"
    export PORT="$LANDING_PORT"
    export HOSTNAME="$HOST_BIND"
    exec "$NODE_BIN" apps/landing/server.js
  ) &
  LANDING_PID=$!
fi

# Nur gestartete Dienste beobachten: `wait -n` mit einer leeren PID bräche ab.
WAIT_PIDS=("$STUDIO_PID" "$PORTAL_PID")
if [[ -n "$FAMILY_PID" ]]; then
  WAIT_PIDS+=("$FAMILY_PID")
fi
if [[ -n "$LANDING_PID" ]]; then
  WAIT_PIDS+=("$LANDING_PID")
fi

wait -n "${WAIT_PIDS[@]}"
echo "UWE process exited — stopping remaining services." >&2
exit 1
