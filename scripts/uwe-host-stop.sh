#!/usr/bin/env bash
# Stop UWE via the official production systemd service (uwe.service).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/uwe-host-lib.sh"

cd "$UWE_HOME"
uwe_host_load_env 2>/dev/null || true
STUDIO_PORT="${STUDIO_PORT:-${UWE_DEFAULT_STUDIO_PORT}}"
PORTAL_PORT="${PORTAL_PORT:-${UWE_DEFAULT_PORTAL_PORT}}"

stopped=0

# Stop legacy service if still running (prevent parallel services)
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet "$LEGACY_SYSTEMD_UNIT" 2>/dev/null; then
    uwe_host_warn "Veralteter Dienst $LEGACY_SYSTEMD_UNIT läuft noch — stoppe …"
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
      systemctl stop "$LEGACY_SYSTEMD_UNIT" || true
    else
      sudo systemctl stop "$LEGACY_SYSTEMD_UNIT" || true
    fi
    stopped=1
  fi
fi

if uwe_host_systemd_active; then
  uwe_host_info "Stoppe $SYSTEMD_UNIT …"
  uwe_host_run_systemctl stop
  stopped=1
elif uwe_host_systemd_exists; then
  uwe_host_info "$SYSTEMD_UNIT ist bereits gestoppt."
else
  uwe_host_warn "Service $SYSTEMD_UNIT nicht gefunden."
fi

sleep 1

if uwe_host_port_listening "$STUDIO_PORT" || uwe_host_port_listening "$PORTAL_PORT"; then
  uwe_host_warn "Port ${STUDIO_PORT} oder ${PORTAL_PORT} ist noch belegt."
  echo "Prüfen: ss -ltnp | grep -E ':${STUDIO_PORT}|:${PORTAL_PORT}'" >&2
  exit 1
fi

if [[ "$stopped" -eq 1 ]]; then
  uwe_host_info "UWE gestoppt."
else
  uwe_host_info "UWE war nicht aktiv."
fi
