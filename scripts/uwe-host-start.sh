#!/usr/bin/env bash
# Start UWE on a Linux home-network host (Studio + Portal, LAN-reachable).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/uwe-host-lib.sh"

RESTART=0
FOREGROUND=0

for arg in "$@"; do
  case "$arg" in
    --restart) RESTART=1 ;;
    --foreground|-f) FOREGROUND=1 ;;
    --help|-h)
      echo "Verwendung: $0 [--restart] [--foreground]"
      echo "  --restart     Laufende Instanz stoppen und neu starten"
      echo "  --foreground  Im Vordergrund starten (für Tests)"
      exit 0
      ;;
    *)
      uwe_host_error "Unbekanntes Argument: $arg"
      exit 1
      ;;
  esac
done

cd "$UWE_HOME"
uwe_host_ensure_state_dirs

uwe_host_info "UWE Host-Start — Projekt: $UWE_HOME"
uwe_host_check_prerequisites
uwe_host_check_env_file
uwe_host_load_env
STUDIO_PORT="${STUDIO_PORT:-3000}"
PORTAL_PORT="${PORTAL_PORT:-3001}"

if uwe_host_is_running; then
  if [[ "$RESTART" -eq 1 ]]; then
    uwe_host_info "UWE läuft bereits — Neustart …"
    "$SCRIPT_DIR/uwe-host-stop.sh" || true
    sleep 2
  else
    uwe_host_info "UWE läuft bereits."
    uwe_host_print_urls
    echo "Neustart erzwingen: pnpm host:start -- --restart"
    exit 0
  fi
fi

uwe_host_install_dependencies
uwe_host_run_database_steps
uwe_host_ensure_build

if uwe_host_port_listening "$STUDIO_PORT" || uwe_host_port_listening "$PORTAL_PORT"; then
  uwe_host_error "Port ${STUDIO_PORT} oder ${PORTAL_PORT} ist bereits belegt (fremder Prozess?)."
  echo "Prüfen: ss -ltnp | grep -E ':${STUDIO_PORT}|:${PORTAL_PORT}'" >&2
  echo "Stoppen: pnpm host:stop" >&2
  exit 1
fi

if [[ "$FOREGROUND" -eq 1 ]]; then
  uwe_host_info "Starte UWE im Vordergrund (Strg+C zum Beenden) …"
  exec "$SCRIPT_DIR/uwe-host-run.sh"
fi

uwe_host_info "Starte UWE im Hintergrund …"
nohup "$SCRIPT_DIR/uwe-host-run.sh" >>"$UWE_HOST_LOG_FILE" 2>&1 &
echo $! >"$UWE_HOST_SUPERVISOR_PID_FILE"

deadline=$((SECONDS + 120))
studio_ok=0
portal_ok=0
while (( SECONDS < deadline )); do
  if uwe_host_http_ok "http://127.0.0.1:${STUDIO_PORT}/api/health"; then
    studio_ok=1
  fi
  if uwe_host_http_ok "http://127.0.0.1:${PORTAL_PORT}/api/health"; then
    portal_ok=1
  fi
  if [[ "$studio_ok" -eq 1 && "$portal_ok" -eq 1 ]]; then
    break
  fi
  if ! uwe_host_read_pid "$UWE_HOST_SUPERVISOR_PID_FILE" >/dev/null 2>&1; then
    uwe_host_error "UWE-Prozess ist sofort beendet — letzte Logzeilen:"
    tail -n 30 "$UWE_HOST_LOG_FILE" 2>/dev/null || true
    exit 1
  fi
  sleep 2
done

if [[ "$studio_ok" -eq 0 || "$portal_ok" -eq 0 ]]; then
  uwe_host_warn "Health-Check noch nicht grün (Studio=$studio_ok, Portal=$portal_ok)."
  uwe_host_warn "Logs: tail -f $UWE_HOST_LOG_FILE"
else
  uwe_host_info "Health-Check OK."
fi

uwe_host_print_urls
echo "Logs: tail -f $UWE_HOST_LOG_FILE"
