#!/usr/bin/env bash
# Starts uwe-host-update.service after validating UWE_HOST_UPDATE_ENABLED and request file.
# Runs as the unprivileged uwe service user; it escalates ONLY the final
# `systemctl start uwe-host-update.service` via passwordless sudo (see
# deploy/sudoers/uwe-host-update). The script itself is NOT run via sudo anymore —
# a sudo grant on this uwe-writable file would be a root privilege-escalation hole.
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
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$UPDATE_UNIT"; then
      die "Host-Update läuft bereits (Status: $status)."
    fi

    warn "Host-Update-State war '$status', aber $UPDATE_UNIT ist nicht aktiv — markiere als stale."
    STATE_FILE="$STATE_FILE" node -e "
      const fs = require('node:fs');
      const target = process.env.STATE_FILE;
      let state = {};
      try { state = JSON.parse(fs.readFileSync(target, 'utf8')); } catch {}
      fs.writeFileSync(target, JSON.stringify({
        ...state,
        status: 'failed',
        finishedAt: new Date().toISOString(),
        exitCode: state.exitCode ?? 1,
        error: 'Stale host update state cleared before starting a new update.',
      }, null, 2) + '\n', { mode: 0o640 });
    "
  fi

  if [[ -f "$LOCK_FILE" ]]; then
    if ! flock -n 9 9<"$LOCK_FILE"; then
      die "Host-Update-Lock aktiv — ein anderer Lauf ist möglicherweise aktiv."
    fi
  fi
}

main() {
  # Intentionally NOT require_root: this wrapper runs as the uwe service user and
  # escalates only the single systemctl unit start below via the scoped sudoers rule.
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
  # Only this one command is escalated (NOPASSWD sudoers entry). systemctl and the
  # unit file are root-owned, so uwe cannot alter what actually runs as root here.
  sudo systemctl start "$UPDATE_UNIT"
  ok "Host-Update gestartet — Fortschritt: ${UWE_LOG_DIR}/host-update.log"
}

main "$@"
