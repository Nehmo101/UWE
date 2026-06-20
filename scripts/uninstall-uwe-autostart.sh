#!/usr/bin/env bash
# Disable UWE production autostart (uwe.service). Does NOT delete data.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/uwe-host-lib.sh"

if ! command -v systemctl >/dev/null 2>&1; then
  uwe_host_error "systemctl nicht gefunden."
  exit 1
fi

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  if ! command -v sudo >/dev/null 2>&1; then
    uwe_host_error "Root-Rechte erforderlich. Bitte ausführen: sudo $0"
    exit 1
  fi
  exec sudo -E "$0" "$@"
fi

for unit in "$SYSTEMD_UNIT" "$LEGACY_SYSTEMD_UNIT"; do
  if systemctl is-active --quiet "$unit" 2>/dev/null; then
    uwe_host_info "Stoppe $unit …"
    systemctl stop "$unit"
  fi

  if systemctl is-enabled --quiet "$unit" 2>/dev/null; then
    uwe_host_info "Deaktiviere Autostart für $unit …"
    systemctl disable "$unit"
  fi

  if [[ -f "/etc/systemd/system/$unit" && "$unit" == "$LEGACY_SYSTEMD_UNIT" ]]; then
    uwe_host_info "Entferne veraltete Unit-Datei $unit …"
    rm -f "/etc/systemd/system/$unit"
  fi
done

systemctl daemon-reload

uwe_host_info "Autostart deinstalliert."
echo ""
echo "Daten bleiben erhalten unter:"
echo "  $UWE_DATA_DIR"
echo "  $UWE_ENV_FILE"
echo ""
echo "Manuell starten:  sudo systemctl start $SYSTEMD_UNIT"
echo "Erneut aktivieren: sudo bash $SETUP_SCRIPT"
