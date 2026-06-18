#!/usr/bin/env bash
# Shared helpers for UWE Linux home-network host scripts.
# Source this file — do not execute directly.
set -euo pipefail

_uwe_host_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UWE_HOME="${UWE_HOME:-$(cd "$_uwe_host_lib_dir/.." && pwd)}"

UWE_HOST_STATE_DIR="${UWE_HOST_STATE_DIR:-$UWE_HOME/.uwe-host}"
UWE_HOST_PID_DIR="${UWE_HOST_PID_DIR:-$UWE_HOST_STATE_DIR/pids}"
UWE_HOST_LOG_DIR="${UWE_HOST_LOG_DIR:-$UWE_HOST_STATE_DIR/logs}"
UWE_HOST_SUPERVISOR_PID_FILE="${UWE_HOST_SUPERVISOR_PID_FILE:-$UWE_HOST_PID_DIR/supervisor.pid}"
UWE_HOST_STUDIO_PID_FILE="${UWE_HOST_STUDIO_PID_FILE:-$UWE_HOST_PID_DIR/studio.pid}"
UWE_HOST_PORTAL_PID_FILE="${UWE_HOST_PORTAL_PID_FILE:-$UWE_HOST_PID_DIR/portal.pid}"
UWE_HOST_LOG_FILE="${UWE_HOST_LOG_FILE:-$UWE_HOST_LOG_DIR/host.log}"

STUDIO_PORT="${STUDIO_PORT:-3000}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
HOST_BIND="${HOST_BIND:-0.0.0.0}"
SYSTEMD_UNIT="${SYSTEMD_UNIT:-uwe-host.service}"

STUDIO_STANDALONE_DIR="$UWE_HOME/apps/studio/.next/standalone"
PORTAL_STANDALONE_DIR="$UWE_HOME/apps/portal/.next/standalone"
STUDIO_SERVER_JS="$STUDIO_STANDALONE_DIR/apps/studio/server.js"
PORTAL_SERVER_JS="$PORTAL_STANDALONE_DIR/apps/portal/server.js"

uwe_host_info() {
  echo "==> $*"
}

uwe_host_warn() {
  echo "WARN: $*" >&2
}

uwe_host_error() {
  echo "FEHLER: $*" >&2
}

uwe_host_ensure_state_dirs() {
  mkdir -p "$UWE_HOST_PID_DIR" "$UWE_HOST_LOG_DIR"
}

uwe_host_load_env() {
  local env_file
  for env_file in "$UWE_HOME/.env" "$UWE_HOME/.env.local"; do
    if [[ -f "$env_file" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$env_file"
      set +a
      export UWE_HOME
      STUDIO_PORT="${STUDIO_PORT:-3000}"
      PORTAL_PORT="${PORTAL_PORT:-3001}"
      return 0
    fi
  done
  return 1
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

uwe_host_check_prerequisites() {
  uwe_host_require_command node \
    "Node.js 20+ installieren: https://nodejs.org/ oder z. B. sudo apt install nodejs"
  uwe_host_require_command pnpm \
    "pnpm installieren: corepack enable && corepack prepare pnpm@10.12.1 --activate"
  uwe_host_require_command ss \
    "Paket iproute2 installieren (enthält ss): sudo apt install iproute2"
}

uwe_host_check_env_file() {
  if [[ -f "$UWE_HOME/.env" || -f "$UWE_HOME/.env.local" ]]; then
    return 0
  fi
  uwe_host_error "Keine .env oder .env.local im UWE-Ordner gefunden ($UWE_HOME)."
  echo "Kopieren Sie die Vorlage: cp .env.example .env" >&2
  echo "Passen Sie danach mindestens SESSION_SECRET an (siehe docs/secrets.md)." >&2
  exit 1
}

uwe_host_install_dependencies() {
  if [[ ! -d "$UWE_HOME/node_modules" ]]; then
    uwe_host_info "node_modules fehlt — installiere Abhängigkeiten …"
    (cd "$UWE_HOME" && pnpm install --frozen-lockfile)
  fi
}

uwe_host_run_database_steps() {
  uwe_host_info "Prisma Client generieren …"
  (cd "$UWE_HOME" && pnpm --filter @uwe/database db:generate)
  uwe_host_info "Datenbank-Migrationen anwenden …"
  (cd "$UWE_HOME" && pnpm --filter @uwe/database db:deploy)
}

uwe_host_ensure_build() {
  if [[ -f "$STUDIO_SERVER_JS" && -f "$PORTAL_SERVER_JS" ]]; then
    return 0
  fi
  uwe_host_info "Production-Build fehlt — baue UWE (kann einige Minuten dauern) …"
  (cd "$UWE_HOME" && pnpm build:release)
  if [[ ! -f "$STUDIO_SERVER_JS" || ! -f "$PORTAL_SERVER_JS" ]]; then
    uwe_host_error "Build fehlgeschlagen — standalone server.js nicht gefunden."
    exit 1
  fi
}

uwe_host_read_pid() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi
  local pid
  pid="$(tr -d '[:space:]' <"$pid_file")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    echo "$pid"
    return 0
  fi
  return 1
}

uwe_host_clear_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    rm -f "$pid_file"
  fi
}

uwe_host_port_listening() {
  local port="$1"
  ss -ltn "sport = :$port" 2>/dev/null | grep -q LISTEN
}

uwe_host_systemd_active() {
  command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$SYSTEMD_UNIT" 2>/dev/null
}

uwe_host_is_running() {
  if uwe_host_systemd_active; then
    return 0
  fi
  if uwe_host_read_pid "$UWE_HOST_SUPERVISOR_PID_FILE" >/dev/null; then
    return 0
  fi
  if uwe_host_read_pid "$UWE_HOST_STUDIO_PID_FILE" >/dev/null && uwe_host_read_pid "$UWE_HOST_PORTAL_PID_FILE" >/dev/null; then
    return 0
  fi
  if uwe_host_port_listening "$STUDIO_PORT" && uwe_host_port_listening "$PORTAL_PORT"; then
    return 0
  fi
  return 1
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

uwe_host_print_urls() {
  local lan_ip
  lan_ip="$(uwe_host_get_lan_ip)"
  echo ""
  echo "UWE ist erreichbar unter:"
  echo "  Studio (DM):  http://localhost:${STUDIO_PORT}"
  echo "  Portal:       http://localhost:${PORTAL_PORT}"
  echo "  Studio (LAN): http://${lan_ip}:${STUDIO_PORT}"
  echo "  Portal (LAN): http://${lan_ip}:${PORTAL_PORT}"
  echo ""
  echo "IP des Host-Laptops anzeigen: hostname -I"
  echo "Status prüfen: pnpm host:status"
}

uwe_host_http_ok() {
  local url="$1"
  command -v curl >/dev/null 2>&1 && curl -fsS --max-time 3 "$url" >/dev/null 2>&1
}

uwe_host_stop_manual_processes() {
  local pid stopped=0

  if pid="$(uwe_host_read_pid "$UWE_HOST_SUPERVISOR_PID_FILE" 2>/dev/null)"; then
    uwe_host_info "Stoppe UWE-Supervisor (PID $pid) …"
    kill -TERM "$pid" 2>/dev/null || true
    stopped=1
  fi

  for pid_file in "$UWE_HOST_STUDIO_PID_FILE" "$UWE_HOST_PORTAL_PID_FILE"; do
    if pid="$(uwe_host_read_pid "$pid_file" 2>/dev/null)"; then
      uwe_host_info "Stoppe Prozess (PID $pid) …"
      kill -TERM "$pid" 2>/dev/null || true
      stopped=1
    fi
    uwe_host_clear_pid_file "$pid_file"
  done

  uwe_host_clear_pid_file "$UWE_HOST_SUPERVISOR_PID_FILE"

  if [[ "$stopped" -eq 1 ]]; then
    sleep 2
    for pid_file in "$UWE_HOST_SUPERVISOR_PID_FILE" "$UWE_HOST_STUDIO_PID_FILE" "$UWE_HOST_PORTAL_PID_FILE"; do
      if pid="$(uwe_host_read_pid "$pid_file" 2>/dev/null)"; then
        kill -KILL "$pid" 2>/dev/null || true
        uwe_host_clear_pid_file "$pid_file"
      fi
    done
  fi
}

uwe_host_stop_uwe_processes_by_cmdline() {
  local pattern
  local -a patterns=(
    "$STUDIO_STANDALONE_DIR/apps/studio/server.js"
    "$PORTAL_STANDALONE_DIR/apps/portal/server.js"
  )
  if ! command -v pgrep >/dev/null 2>&1; then
    return 0
  fi
  for pattern in "${patterns[@]}"; do
    local pids
    pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      uwe_host_info "Stoppe UWE-Prozess: $pattern"
      # shellcheck disable=SC2086
      kill -TERM $pids 2>/dev/null || true
    fi
  done
}
