#!/usr/bin/env bash
# Shared helpers for UWE Linux production host convenience scripts.
# Production flow: systemd uwe.service + /etc/uwe/uwe.env (see deploy/scripts/setup-uwe-host.sh).
# Source this file — do not execute directly.
set -euo pipefail

_uwe_host_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UWE_HOME="${UWE_HOME:-$(cd "$_uwe_host_lib_dir/.." && pwd)}"

# Official production paths
UWE_ENV_FILE="${UWE_ENV_FILE:-/etc/uwe/uwe.env}"
UWE_DATA_DIR="${UWE_DATA_DIR:-/var/lib/uwe}"
UWE_LOG_DIR="${UWE_LOG_DIR:-/var/log/uwe}"
UWE_BACKUP_DIR="${UWE_BACKUP_DIR:-/var/backups/uwe}"
SETUP_SCRIPT="${SETUP_SCRIPT:-$UWE_HOME/deploy/scripts/setup-uwe-host.sh}"

STUDIO_PORT="${STUDIO_PORT:-3000}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
SYSTEMD_UNIT="${SYSTEMD_UNIT:-uwe.service}"
LEGACY_SYSTEMD_UNIT="${LEGACY_SYSTEMD_UNIT:-uwe-host.service}"

uwe_host_info() {
  echo "==> $*"
}

uwe_host_warn() {
  echo "WARN: $*" >&2
}

uwe_host_error() {
  echo "FEHLER: $*" >&2
}

uwe_host_require_command() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    uwe_host_error "$cmd nicht gefunden."
    echo "$hint" >&2
    exit 1
  fi
}

uwe_host_load_env() {
  if [[ -f "$UWE_ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$UWE_ENV_FILE"
    set +a
    export UWE_HOME
    STUDIO_PORT="${STUDIO_PORT:-3000}"
    PORTAL_PORT="${PORTAL_PORT:-3001}"
    return 0
  fi
  return 1
}

uwe_host_is_production_layout() {
  [[ -f "$UWE_ENV_FILE" ]] && [[ -f "/etc/systemd/system/$SYSTEMD_UNIT" || -f "$SETUP_SCRIPT" ]]
}

uwe_host_run_systemctl() {
  local action="$1"
  uwe_host_require_command systemctl "systemd wird für den Production-Flow benötigt."
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    systemctl "$action" "$SYSTEMD_UNIT"
  elif command -v sudo >/dev/null 2>&1; then
    sudo systemctl "$action" "$SYSTEMD_UNIT"
  else
    uwe_host_error "Root-Rechte erforderlich: sudo systemctl $action $SYSTEMD_UNIT"
    exit 1
  fi
}

uwe_host_systemd_active() {
  command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$SYSTEMD_UNIT" 2>/dev/null
}

uwe_host_systemd_exists() {
  command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "$SYSTEMD_UNIT" >/dev/null 2>&1
}

uwe_host_port_listening() {
  local port="$1"
  ss -ltn "sport = :$port" 2>/dev/null | grep -q LISTEN
}

uwe_host_get_lan_ip() {
  local ip=""
  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [[ -z "$ip" ]] && command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") print $(i+1); exit}')"
  fi
  if [[ -z "$ip" ]]; then
    ip="<LAN-IP>"
  fi
  echo "$ip"
}

uwe_host_print_production_hint() {
  echo ""
  echo "Offizieller Linux-Production-Flow:"
  echo "  sudo bash $SETUP_SCRIPT          # Update/Repair"
  echo "  sudo bash $SETUP_SCRIPT --quick  # Schnelles Update nach git pull"
  echo "  sudo bash $SETUP_SCRIPT --healthcheck"
  echo ""
  echo "Dokumentation: docs/UWE_HOST_LINUX_STARTUP.md"
}

uwe_host_http_ok() {
  local url="$1"
  command -v curl >/dev/null 2>&1 && curl -fsS --max-time 3 "$url" >/dev/null 2>&1
}
