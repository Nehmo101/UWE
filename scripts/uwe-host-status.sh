#!/usr/bin/env bash
# Show UWE production host status via systemd and optional healthcheck.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/uwe-host-lib.sh"

RUN_HEALTHCHECK=0
for arg in "$@"; do
  case "$arg" in
    --healthcheck) RUN_HEALTHCHECK=1 ;;
    --help|-h)
      echo "Verwendung: $0 [--healthcheck]"
      echo "  --healthcheck  Zusätzlich deploy/scripts/setup-uwe-host.sh --healthcheck ausführen"
      exit 0
      ;;
    *)
      uwe_host_error "Unbekanntes Argument: $arg"
      exit 1
      ;;
  esac
done

cd "$UWE_HOME"
uwe_host_load_env 2>/dev/null || true
STUDIO_PORT="${STUDIO_PORT:-${UWE_DEFAULT_STUDIO_PORT}}"
PORTAL_PORT="${PORTAL_PORT:-${UWE_DEFAULT_PORTAL_PORT}}"
LAN_IP="$(uwe_host_get_lan_ip)"

echo "=== UWE Production Host Status ==="
echo "Projekt:     $UWE_HOME"
echo "Env-Datei:   $UWE_ENV_FILE"
echo "Daten:       $UWE_DATA_DIR"
echo "Service:     $SYSTEMD_UNIT"
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

if command -v systemctl >/dev/null 2>&1; then
  echo ""
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    systemctl status "$SYSTEMD_UNIT" --no-pager 2>/dev/null || true
  elif command -v sudo >/dev/null 2>&1; then
    sudo systemctl status "$SYSTEMD_UNIT" --no-pager 2>/dev/null || true
  fi
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
echo "URLs (lokal):"
echo "  Studio:  http://127.0.0.1:${STUDIO_PORT}/"
echo "  Setup:   http://127.0.0.1:${STUDIO_PORT}/setup"
echo "  Portal:  http://127.0.0.1:${PORTAL_PORT}/"
echo ""
echo "URLs (LAN):"
echo "  Studio:  http://${LAN_IP}:${STUDIO_PORT}/"
echo "  Setup:   http://${LAN_IP}:${STUDIO_PORT}/setup"
echo "  Portal:  http://${LAN_IP}:${PORTAL_PORT}/"

if [[ "$RUN_HEALTHCHECK" -eq 1 && -f "$SETUP_SCRIPT" ]]; then
  echo ""
  uwe_host_info "Erweiterter Healthcheck …"
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    bash "$SETUP_SCRIPT" --healthcheck
  elif command -v sudo >/dev/null 2>&1; then
    sudo bash "$SETUP_SCRIPT" --healthcheck
  else
    uwe_host_warn "Root-Rechte für --healthcheck erforderlich: sudo bash $SETUP_SCRIPT --healthcheck"
  fi
fi

if [[ "$running" -eq 0 ]]; then
  echo ""
  echo "UWE läuft nicht. Starten mit:"
  echo "  sudo systemctl start $SYSTEMD_UNIT"
  echo "  oder: pnpm host:start"
  echo "Erstinstallation: sudo bash $SETUP_SCRIPT"
  exit 1
fi
