#!/usr/bin/env bash
# Start UWE via the official production systemd service (uwe.service).
# Does NOT start a parallel legacy host flow.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/uwe-host-lib.sh"

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      cat <<EOF
Verwendung: $0

Startet UWE über den offiziellen Production-Dienst uwe.service.

Für Erstinstallation oder Update nach git pull:
  sudo bash $SETUP_SCRIPT
  sudo bash $SETUP_SCRIPT --quick

Alternativ direkt:
  sudo systemctl start uwe.service
EOF
      exit 0
      ;;
    --restart)
      uwe_host_run_systemctl restart
      uwe_host_info "UWE neu gestartet ($SYSTEMD_UNIT)."
      exit 0
      ;;
    *)
      uwe_host_error "Unbekanntes Argument: $arg (siehe --help)"
      exit 1
      ;;
  esac
done

cd "$UWE_HOME"
uwe_host_load_env 2>/dev/null || true

if uwe_host_systemd_active; then
  uwe_host_info "UWE läuft bereits ($SYSTEMD_UNIT)."
  uwe_host_print_production_hint
  exit 0
fi

if ! uwe_host_systemd_exists; then
  uwe_host_warn "Service $SYSTEMD_UNIT ist nicht installiert."
  echo ""
  echo "Erstinstallation ausführen:"
  echo "  sudo bash $SETUP_SCRIPT"
  uwe_host_print_production_hint
  exit 1
fi

uwe_host_info "Starte $SYSTEMD_UNIT …"
uwe_host_run_systemctl start
uwe_host_info "UWE gestartet."

LAN_IP="$(uwe_host_get_lan_ip)"
STUDIO_PORT="${STUDIO_PORT:-3000}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
echo ""
echo "Studio:  http://127.0.0.1:${STUDIO_PORT}/"
echo "Portal:  http://127.0.0.1:${PORTAL_PORT}/"
echo "LAN:     http://${LAN_IP}:${STUDIO_PORT}/"
echo ""
echo "Status:  pnpm host:status"
echo "Update:  sudo bash $SETUP_SCRIPT --quick"
