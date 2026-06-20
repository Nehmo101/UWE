#!/usr/bin/env bash
# Enable UWE production autostart via uwe.service (official production flow).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/uwe-host-lib.sh"

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      cat <<EOF
Verwendung: $0

Aktiviert den offiziellen Production-Dienst uwe.service über setup-uwe-host.sh.
Erstellt KEINEN veralteten uwe-host.service mehr.

Manuell:
  sudo bash $SETUP_SCRIPT
EOF
      exit 0
      ;;
    *)
      uwe_host_error "Unbekanntes Argument: $arg"
      exit 1
      ;;
  esac
done

if [[ ! -f "$SETUP_SCRIPT" ]]; then
  uwe_host_error "Setup-Script fehlt: $SETUP_SCRIPT"
  exit 1
fi

uwe_host_info "Installiere Production-Autostart über $SETUP_SCRIPT …"
echo ""
echo "Hinweis: Verwendet uwe.service + /etc/uwe/uwe.env (kein uwe-host.service)."
echo ""

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  bash "$SETUP_SCRIPT"
else
  if ! command -v sudo >/dev/null 2>&1; then
    uwe_host_error "Root-Rechte erforderlich: sudo bash $SETUP_SCRIPT"
    exit 1
  fi
  exec sudo bash "$SETUP_SCRIPT"
fi
