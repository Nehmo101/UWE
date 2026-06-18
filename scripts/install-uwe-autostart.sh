#!/usr/bin/env bash
# Install systemd autostart for UWE home host (system service).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/uwe-host-lib.sh"

START_NOW=1
for arg in "$@"; do
  case "$arg" in
    --no-start) START_NOW=0 ;;
    --help|-h)
      echo "Verwendung: $0 [--no-start]"
      echo "  --no-start  Service nur aktivieren, nicht sofort starten"
      exit 0
      ;;
    *)
      uwe_host_error "Unbekanntes Argument: $arg"
      exit 1
      ;;
  esac
done

if ! command -v systemctl >/dev/null 2>&1; then
  uwe_host_error "systemctl nicht gefunden — ist dies ein Linux-System mit systemd?"
  exit 1
fi

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  if ! command -v sudo >/dev/null 2>&1; then
    uwe_host_error "Root-Rechte erforderlich. Bitte ausführen: sudo $0"
    exit 1
  fi
  exec sudo -E "$0" "$@"
fi

UWE_USER="${UWE_USER:-${SUDO_USER:-$(logname 2>/dev/null || id -un)}}"
UWE_GROUP="${UWE_GROUP:-$(id -gn "$UWE_USER" 2>/dev/null || echo "$UWE_USER")}"
SERVICE_TEMPLATE="$UWE_HOME/deploy/linux/uwe-host.service"
SERVICE_DEST="/etc/systemd/system/uwe-host.service"

if [[ ! -f "$SERVICE_TEMPLATE" ]]; then
  uwe_host_error "Service-Vorlage fehlt: $SERVICE_TEMPLATE"
  exit 1
fi

chmod +x "$UWE_HOME/scripts/uwe-host-run.sh" \
  "$UWE_HOME/scripts/uwe-host-start.sh" \
  "$UWE_HOME/scripts/uwe-host-stop.sh" \
  "$UWE_HOME/scripts/uwe-host-status.sh" \
  "$UWE_HOME/scripts/install-uwe-autostart.sh" \
  "$UWE_HOME/scripts/uninstall-uwe-autostart.sh"

uwe_host_info "Einmalige Vorbereitung (Abhängigkeiten, DB, Build) …"
sudo -u "$UWE_USER" env UWE_HOME="$UWE_HOME" bash -c "
  set -euo pipefail
  source '$UWE_HOME/scripts/uwe-host-lib.sh'
  uwe_host_check_prerequisites
  uwe_host_check_env_file
  uwe_host_install_dependencies
  uwe_host_run_database_steps
  uwe_host_ensure_build
"

sed \
  -e "s|@UWE_HOME@|$UWE_HOME|g" \
  -e "s|@UWE_USER@|$UWE_USER|g" \
  -e "s|@UWE_GROUP@|$UWE_GROUP|g" \
  "$SERVICE_TEMPLATE" >"$SERVICE_DEST"

systemctl daemon-reload
systemctl enable uwe-host.service

if [[ "$START_NOW" -eq 1 ]]; then
  systemctl restart uwe-host.service
fi

echo ""
uwe_host_info "Autostart installiert."
echo ""
echo "Wichtige Befehle:"
echo "  sudo systemctl status uwe-host"
echo "  sudo journalctl -u uwe-host -f"
echo "  sudo systemctl restart uwe-host"
echo "  sudo systemctl stop uwe-host"
echo ""
echo "Status ohne sudo: pnpm host:status"
echo "Deinstallieren:    pnpm host:uninstall-autostart"
