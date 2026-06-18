#!/usr/bin/env bash
# Stop UWE home-host processes without killing unrelated Node apps.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/uwe-host-lib.sh"

cd "$UWE_HOME"
uwe_host_load_env 2>/dev/null || true
STUDIO_PORT="${STUDIO_PORT:-3000}"
PORTAL_PORT="${PORTAL_PORT:-3001}"

stopped=0

if uwe_host_systemd_active; then
  if [[ "${EUID:-$(id -u)}" -eq 0 ]] || command -v sudo >/dev/null 2>&1; then
    uwe_host_info "Stoppe systemd-Dienst $SYSTEMD_UNIT …"
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
      systemctl stop "$SYSTEMD_UNIT"
    else
      sudo systemctl stop "$SYSTEMD_UNIT"
    fi
    stopped=1
  else
    uwe_host_warn "systemd-Dienst $SYSTEMD_UNIT läuft — stoppen mit: sudo systemctl stop $SYSTEMD_UNIT"
  fi
fi

if uwe_host_is_running || [[ -f "$UWE_HOST_SUPERVISOR_PID_FILE" ]]; then
  uwe_host_stop_manual_processes
  uwe_host_stop_uwe_processes_by_cmdline
  stopped=1
fi

sleep 1

if uwe_host_port_listening "$STUDIO_PORT" || uwe_host_port_listening "$PORTAL_PORT"; then
  uwe_host_warn "Port ${STUDIO_PORT} oder ${PORTAL_PORT} ist noch belegt."
  echo "Manuell prüfen: ss -ltnp | grep -E ':${STUDIO_PORT}|:${PORTAL_PORT}'" >&2
  exit 1
fi

if [[ "$stopped" -eq 1 ]]; then
  uwe_host_info "UWE gestoppt."
else
  uwe_host_info "UWE war nicht aktiv."
fi
