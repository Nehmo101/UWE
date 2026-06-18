#!/usr/bin/env bash
# Show UWE home-host status, ports, LAN URLs, and recent logs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/uwe-host-lib.sh"

cd "$UWE_HOME"
uwe_host_load_env 2>/dev/null || true
STUDIO_PORT="${STUDIO_PORT:-3000}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
LAN_IP="$(uwe_host_get_lan_ip)"

echo "=== UWE Host-Status ==="
echo "Projekt:     $UWE_HOME"
echo "LAN-IP:      $LAN_IP"
echo "Studio-Port: $STUDIO_PORT"
echo "Portal-Port: $PORTAL_PORT"
echo ""

running=0
if uwe_host_systemd_active; then
  echo "systemd:     aktiv ($SYSTEMD_UNIT)"
  running=1
else
  echo "systemd:     inaktiv"
fi

supervisor_pid=""
studio_pid=""
portal_pid=""

if supervisor_pid="$(uwe_host_read_pid "$UWE_HOST_SUPERVISOR_PID_FILE" 2>/dev/null)"; then
  echo "Supervisor:  läuft (PID $supervisor_pid)"
  running=1
else
  echo "Supervisor:  gestoppt"
fi

if studio_pid="$(uwe_host_read_pid "$UWE_HOST_STUDIO_PID_FILE" 2>/dev/null)"; then
  echo "Studio:      läuft (PID $studio_pid)"
  running=1
else
  echo "Studio:      gestoppt"
fi

if portal_pid="$(uwe_host_read_pid "$UWE_HOST_PORTAL_PID_FILE" 2>/dev/null)"; then
  echo "Portal:      läuft (PID $portal_pid)"
  running=1
else
  echo "Portal:      gestoppt"
fi

echo ""
echo "Ports:"
if uwe_host_port_listening "$STUDIO_PORT"; then
  echo "  :$STUDIO_PORT  LISTEN"
  running=1
else
  echo "  :$STUDIO_PORT  frei"
fi
if uwe_host_port_listening "$PORTAL_PORT"; then
  echo "  :$PORTAL_PORT  LISTEN"
  running=1
else
  echo "  :$PORTAL_PORT  frei"
fi

echo ""
echo "Erreichbarkeit:"
if uwe_host_http_ok "http://127.0.0.1:${STUDIO_PORT}/api/health"; then
  echo "  Studio health:  OK"
else
  echo "  Studio health:  nicht erreichbar"
fi
if uwe_host_http_ok "http://127.0.0.1:${PORTAL_PORT}/api/health"; then
  echo "  Portal health:  OK"
else
  echo "  Portal health:  nicht erreichbar"
fi

echo ""
echo "URLs (dieser Laptop):"
echo "  Studio:  http://localhost:${STUDIO_PORT}"
echo "  Portal:  http://localhost:${PORTAL_PORT}"
echo ""
echo "URLs (Handy / anderer PC im Heimnetz):"
echo "  Studio:  http://${LAN_IP}:${STUDIO_PORT}"
echo "  Portal:  http://${LAN_IP}:${PORTAL_PORT}"
echo ""
echo "IP finden: hostname -I   oder: ip -4 addr show"

if [[ -f "$UWE_HOST_LOG_FILE" ]]; then
  echo ""
  echo "Letzte Logzeilen ($UWE_HOST_LOG_FILE):"
  tail -n 15 "$UWE_HOST_LOG_FILE" 2>/dev/null || true
fi

if [[ "$running" -eq 0 ]]; then
  echo ""
  echo "UWE läuft nicht. Starten mit: pnpm host:start"
  exit 1
fi
