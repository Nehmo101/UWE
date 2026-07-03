#!/usr/bin/env bash
# Shared constants and helpers for UWE Linux host setup.
# shellcheck shell=bash
# shellcheck disable=SC2034  # constants are consumed by scripts that source this file

_uwe_host_common_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=uwe-host-constants.sh
source "$_uwe_host_common_dir/uwe-host-constants.sh"

readonly SERVICE_USER="uwe"
readonly SERVICE_GROUP="uwe"
readonly UWE_ENV_DIR="$UWE_DEFAULT_ENV_DIR"
readonly UWE_ENV_FILE="$UWE_DEFAULT_ENV_FILE"
readonly UWE_DATA_DIR="$UWE_DEFAULT_DATA_DIR"
readonly UWE_LOG_DIR="$UWE_DEFAULT_LOG_DIR"
readonly UWE_BACKUP_DIR="$UWE_DEFAULT_BACKUP_DIR"
readonly UWE_DIAG_DIR="$UWE_DEFAULT_LOG_DIR/diagnostics"
readonly DEFAULT_UWE_HOME="/opt/uwe"
readonly STUDIO_PORT="$UWE_DEFAULT_STUDIO_PORT"
readonly PORTAL_PORT="$UWE_DEFAULT_PORTAL_PORT"
readonly SYSTEMD_UNIT="$UWE_DEFAULT_SYSTEMD_UNIT"
readonly LEGACY_SYSTEMD_UNIT="$UWE_DEFAULT_LEGACY_SYSTEMD_UNIT"
readonly DATABASE_WORKSPACE_FILTER="@uwe/database"
readonly NODE_MAJOR="22"
readonly DEFAULT_PNPM_VERSION="10.12.1"
readonly SYSTEMD_PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Set by main script after detect_uwe_home.
UWE_HOME="${UWE_HOME:-}"
MODE="${MODE:-default}"
PREFLIGHT_ONLY="${PREFLIGHT_ONLY:-0}"

log() {
  echo "==> $*"
}

warn() {
  echo "[WARN] $*" >&2
}

ok() {
  echo "[OK] $*"
}

fix() {
  echo "[FIX] $*"
}

fail() {
  echo "[FAIL] $*" >&2
}

die() {
  fail "$*"
  exit 1
}

usage() {
  local script_name="${1:-setup-uwe-host.sh}"
  cat <<EOF
UWE Linux Production Host Setup

Usage: sudo bash $script_name [MODE]

Modes (mutually exclusive):
  (default)           Safe, idempotent update/repair — no data or secrets deleted
  --quick             Fast update after git pull (stop service, migrate, build, restart)
  --repair            Thorough dependency repair, cache cleanup, systemd rewrite
  --fresh             Destructive full reset — requires typing DELETE-UWE to confirm
  --wipe-and-reinstall  Alias for --fresh
  --healthcheck       Read-only status checks (no changes)
  -h, --help          Show this help

Official production paths:
  Repository:  /opt/uwe
  Environment: /etc/uwe/uwe.env
  Data:        /var/lib/uwe
  Logs:        /var/log/uwe
  Backups:     /var/backups/uwe
  Service:     uwe.service

After git pull:
  cd /opt/uwe && git pull && sudo bash ./deploy/scripts/setup-uwe-host.sh --quick
EOF
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Dieses Script muss als root ausgeführt werden: sudo bash deploy/scripts/setup-uwe-host.sh"
  fi
}

detect_uwe_home() {
  local script_dir="$1"

  if [[ -n "${UWE_HOME:-}" && -f "${UWE_HOME}/package.json" ]]; then
    printf '%s\n' "$UWE_HOME"
    return 0
  fi

  local candidate
  candidate="$(cd "$script_dir/../.." && pwd)"
  if [[ -f "$candidate/package.json" ]]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  if [[ -f "$DEFAULT_UWE_HOME/package.json" ]]; then
    printf '%s\n' "$DEFAULT_UWE_HOME"
    return 0
  fi

  die "UWE-Repository nicht gefunden. Erwartet unter $DEFAULT_UWE_HOME oder neben deploy/scripts/."
}

export_system_path() {
  export PATH="$SYSTEMD_PATH:${PATH:-}"
}

require_command() {
  local cmd="$1"
  local hint="${2:-}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    if [[ -n "$hint" ]]; then
      die "$cmd nicht gefunden. $hint"
    fi
    die "$cmd nicht gefunden."
  fi
}

get_required_pnpm_version() {
  local version=""
  if [[ -f "$UWE_HOME/package.json" ]]; then
    version="$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"pnpm@\([^"]*\)".*/\1/p' "$UWE_HOME/package.json" | head -n 1 || true)"
  fi

  if [[ -z "$version" ]]; then
    version="$DEFAULT_PNPM_VERSION"
  fi

  printf '%s\n' "$version"
}

remove_path_if_present() {
  local target="$1"
  if [[ -e "$target" || -L "$target" ]]; then
    rm -rf "$target"
  fi
}

node_version_ok() {
  local node_bin="$1"
  local major=""

  if [[ -z "$node_bin" || ! -x "$node_bin" ]]; then
    return 1
  fi

  major="$("$node_bin" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
  [[ "$major" == "$NODE_MAJOR" ]]
}

find_node_binary() {
  export_system_path
  command -v node 2>/dev/null || true
}

resolve_node_binary() {
  local node_bin="${NODE_BIN:-}"

  export_system_path

  if [[ -n "$node_bin" && -x "$node_bin" ]]; then
    printf '%s\n' "$node_bin"
    return 0
  fi

  node_bin="$(command -v node 2>/dev/null || true)"
  if [[ -n "$node_bin" && -x "$node_bin" ]]; then
    printf '%s\n' "$node_bin"
    return 0
  fi

  if [[ -x "/usr/bin/node" ]]; then
    printf '%s\n' "/usr/bin/node"
    return 0
  fi

  return 1
}

apply_systemd_path() {
  export PATH="$SYSTEMD_PATH"
}

source_uwe_env_file() {
  local env_file="${1:-$UWE_ENV_FILE}"

  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  local readonly_env_keys=(
    SERVICE_USER
    SERVICE_GROUP
    UWE_ENV_DIR
    UWE_ENV_FILE
    UWE_DATA_DIR
    UWE_LOG_DIR
    UWE_BACKUP_DIR
    UWE_DIAG_DIR
    DEFAULT_UWE_HOME
    STUDIO_PORT
    PORTAL_PORT
    SYSTEMD_UNIT
    LEGACY_SYSTEMD_UNIT
    DATABASE_WORKSPACE_FILTER
    NODE_MAJOR
    DEFAULT_PNPM_VERSION
    SYSTEMD_PATH
  )
  local readonly_env_pattern
  readonly_env_pattern="$(IFS='|'; printf '%s' "${readonly_env_keys[*]}")"

  set -a
  # shellcheck disable=SC1090
  source <(grep -Ev "^[[:space:]]*(export[[:space:]]+)?(${readonly_env_pattern})[[:space:]]*=" "$env_file")
  set +a

  # uwe.env must not override the systemd PATH (e.g. nvm/home paths break the service user).
  apply_systemd_path
}

run_as_uwe_systemd_env() {
  local cmd="$1"
  sudo -u "$SERVICE_USER" env \
    PATH="$SYSTEMD_PATH" \
    HOME="$UWE_HOME" \
    UWE_HOME="$UWE_HOME" \
    UWE_ENV="$UWE_ENV_FILE" \
    bash -c "
      set -euo pipefail
      cd '$UWE_HOME'
      if [[ -f '$UWE_ENV_FILE' ]]; then
        set -a
        # shellcheck disable=SC1090
        source '$UWE_ENV_FILE'
        set +a
      fi
      export PATH='$SYSTEMD_PATH'
      $cmd
    "
}

find_pnpm_binary() {
  export_system_path
  command -v pnpm 2>/dev/null || true
}

get_lan_ip() {
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
  printf '%s\n' "$ip"
}

http_status_code() {
  local url="$1"
  curl -sS --max-time 8 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "000"
}

http_reachable() {
  local url="$1"
  local code
  code="$(http_status_code "$url")"
  [[ "$code" =~ ^[23] ]]
}

service_active() {
  systemctl is-active --quiet "$SYSTEMD_UNIT" 2>/dev/null
}

listening_on_all_interfaces() {
  local port="$1"
  ss -tulpn 2>/dev/null | grep -E ":${port}\b" | grep -qE '0\.0\.0\.0|\*'
}

run_as_uwe() {
  local cmd="$1"
  sudo -u "$SERVICE_USER" env \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PATH="$SYSTEMD_PATH" \
    HOME="$UWE_HOME" \
    UWE_HOME="$UWE_HOME" \
    UWE_ENV="$UWE_ENV_FILE" \
    bash -c "
      set -euo pipefail
      cd '$UWE_HOME'
      if [[ -f '$UWE_ENV_FILE' ]]; then
        set -a
        # shellcheck disable=SC1090
        source '$UWE_ENV_FILE'
        set +a
      fi
      export PATH='$SYSTEMD_PATH'
      export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
      $cmd
    "
}

stop_uwe_service_for_maintenance() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 0
  fi

  if systemctl is-active --quiet "$SYSTEMD_UNIT" 2>/dev/null; then
    log "Stoppe $SYSTEMD_UNIT (Wartung — UWE kurz nicht erreichbar) …"
    systemctl stop "$SYSTEMD_UNIT"
    ok "$SYSTEMD_UNIT gestoppt."
    return 0
  fi

  ok "$SYSTEMD_UNIT läuft nicht — kein Stop nötig."
}
