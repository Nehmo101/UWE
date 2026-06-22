#!/usr/bin/env bash
# Starts uwe-host-update.service after validating UWE_HOST_UPDATE_ENABLED and request file.
# Invoked by the uwe service user via passwordless sudo (see deploy/sudoers/uwe-host-update).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# shellcheck source=lib/uwe-host-common.sh
source "$LIB_DIR/uwe-host-common.sh"

REQUEST_FILE="${UWE_DATA_DIR}/host-update-request.json"
STATE_FILE="${UWE_DATA_DIR}/host-update-state.json"
LOCK_FILE="${UWE_DATA_DIR}/host-update.lock"
UPDATE_UNIT="uwe-host-update.service"

ensure_host_update_enabled() {
  source_uwe_env_file "$UWE_ENV_FILE"
  if [[ "${UWE_HOST_UPDATE_ENABLED:-false}" != "true" ]]; then
    die "Host-Update ist deaktiviert (UWE_HOST_UPDATE_ENABLED!=true)."
  fi
}

assert_not_running() {
  if [[ ! -f "$STATE_FILE" ]]; then
    return 0
  fi

  local status
  status="$(node -e "
    try {
      const s = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
      console.log(s.status || '');
    } catch { console.log(''); }
  " "$STATE_FILE")"

  if [[ "$status" == "running" || "$status" == "pending" ]]; then
    die "Host-Update läuft bereits (Status: $status)."
  fi

  if [[ -f "$LOCK_FILE" ]]; then
    if ! flock -n 9 9<"$LOCK_FILE"; then
      die "Host-Update-Lock aktiv — ein anderer Lauf ist möglicherweise aktiv."
    fi
  fi
}

main() {
  require_root
  UWE_HOME="$(detect_uwe_home "$SCRIPT_DIR")"
  export UWE_HOME

  ensure_host_update_enabled

  if [[ ! -f "$REQUEST_FILE" ]]; then
    die "Keine gültige Update-Anfrage ($REQUEST_FILE fehlt)."
  fi

  assert_not_running

  if ! command -v systemctl >/dev/null 2>&1; then
    die "systemctl nicht verfügbar — Host-Update nur auf Linux-Production-Hosts."
  fi

  log "Starte $UPDATE_UNIT …"
  systemctl start "$UPDATE_UNIT"
  ok "Host-Update gestartet — Fortschritt: ${UWE_LOG_DIR}/host-update.log"
}

main "$@"
