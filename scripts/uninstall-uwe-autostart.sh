#!/usr/bin/env bash
# Remove systemd autostart for UWE home host.
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

SERVICE_DEST="/etc/systemd/system/uwe-host.service"

if systemctl is-active --quiet uwe-host.service 2>/dev/null; then
  uwe_host_info "Stoppe uwe-host.service …"
  systemctl stop uwe-host.service
fi

if systemctl is-enabled --quiet uwe-host.service 2>/dev/null; then
  systemctl disable uwe-host.service
fi

if [[ -f "$SERVICE_DEST" ]]; then
  rm -f "$SERVICE_DEST"
fi

systemctl daemon-reload

uwe_host_info "Autostart deinstalliert."
echo "Manuell starten: pnpm host:start"
