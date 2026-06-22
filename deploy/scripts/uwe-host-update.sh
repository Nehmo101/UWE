#!/usr/bin/env bash
# Privileged UWE host update — git pull + setup-uwe-host.sh --quick only.
# Invoked by systemd uwe-host-update.service (root). Not for direct Studio use.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# shellcheck source=lib/uwe-host-common.sh
source "$LIB_DIR/uwe-host-common.sh"

LOCK_FILE="${UWE_DATA_DIR}/host-update.lock"
LOG_FILE="${UWE_LOG_DIR}/host-update.log"
STATE_FILE="${UWE_DATA_DIR}/host-update-state.json"
REQUEST_FILE="${UWE_DATA_DIR}/host-update-request.json"
UPDATE_UNIT="uwe-host-update.service"

log_line() {
  local msg="$1"
  printf '[%s] %s\n' "$(date -Iseconds)" "$msg" | tee -a "$LOG_FILE"
}

write_state() {
  local patch="$1"
  node -e "
    const fs = require('node:fs');
    const target = process.env.STATE_FILE;
    const patch = JSON.parse(process.env.PATCH);
    let current = {};
    try { current = JSON.parse(fs.readFileSync(target, 'utf8')); } catch {}
    fs.writeFileSync(target, JSON.stringify({ ...current, ...patch }, null, 2) + '\n', { mode: 0o640 });
  " STATE_FILE="$STATE_FILE" PATCH="$patch"
}

load_request_into_state() {
  if [[ ! -f "$REQUEST_FILE" ]]; then
    die "Keine Update-Anfrage gefunden ($REQUEST_FILE)."
  fi

  node -e "
    const fs = require('node:fs');
    const requestPath = process.env.REQUEST_FILE;
    const statePath = process.env.STATE_FILE;
    const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
    const maxAgeMs = 10 * 60 * 1000;
    const requestedAt = Date.parse(request.requestedAt || '');
    if (!request.jobId || Number.isNaN(requestedAt) || Date.now() - requestedAt > maxAgeMs) {
      console.error('Update-Anfrage abgelaufen oder ungültig.');
      process.exit(1);
    }
    let state = {};
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch {}
    const next = {
      ...state,
      jobId: request.jobId,
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      startedByUserId: request.actorUserId ?? null,
      exitCode: null,
      error: null,
      commitBefore: request.commitBefore ?? null,
      commitAfter: null,
    };
    fs.writeFileSync(statePath, JSON.stringify(next, null, 2) + '\n', { mode: 0o640 });
    fs.unlinkSync(requestPath);
  " REQUEST_FILE="$REQUEST_FILE" STATE_FILE="$STATE_FILE"
}

ensure_host_update_enabled() {
  source_uwe_env_file "$UWE_ENV_FILE"
  if [[ "${UWE_HOST_UPDATE_ENABLED:-false}" != "true" ]]; then
    die "Host-Update ist deaktiviert (UWE_HOST_UPDATE_ENABLED!=true in $UWE_ENV_FILE)."
  fi
}

main() {
  require_root
  UWE_HOME="$(detect_uwe_home "$SCRIPT_DIR")"
  export UWE_HOME

  install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$UWE_DATA_DIR"
  install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$UWE_LOG_DIR"
  touch "$LOG_FILE"
  chown "$SERVICE_USER:$SERVICE_GROUP" "$LOG_FILE"
  chmod 640 "$LOG_FILE"

  ensure_host_update_enabled

  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    die "Host-Update läuft bereits (Lock: $LOCK_FILE)."
  fi

  load_request_into_state

  local commit_before commit_after exit_code=0
  commit_before="$(git -C "$UWE_HOME" rev-parse HEAD 2>/dev/null || echo "unknown")"
  write_state "$(node -e "console.log(JSON.stringify({ commitBefore: process.argv[1] }))" "$commit_before")"

  local job_id
  job_id="$(node -e "try{console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).jobId||'')}catch{}" "$STATE_FILE")"
  log_line "Host-Update gestartet (Job ${job_id:-unbekannt}, unit ${UPDATE_UNIT})."
  log_line "Repository: $UWE_HOME"

  set +e
  {
    log_line "git pull …"
    git -C "$UWE_HOME" pull --ff-only 2>&1 | tee -a "$LOG_FILE"
    pull_code="${PIPESTATUS[0]}"
    if [[ "$pull_code" -ne 0 ]]; then
      exit "$pull_code"
    fi

    log_line "setup-uwe-host.sh --quick …"
    bash "$UWE_HOME/deploy/scripts/setup-uwe-host.sh" --quick 2>&1 | tee -a "$LOG_FILE"
    exit "${PIPESTATUS[0]}"
  }
  exit_code=$?
  set -e

  commit_after="$(git -C "$UWE_HOME" rev-parse HEAD 2>/dev/null || echo "unknown")"

  if [[ "$exit_code" -eq 0 ]]; then
    log_line "Host-Update erfolgreich abgeschlossen."
    write_state "$(node -e "console.log(JSON.stringify({
      status: 'succeeded',
      finishedAt: new Date().toISOString(),
      exitCode: 0,
      commitAfter: process.argv[1],
      error: null,
    }))" "$commit_after")"
    chown "$SERVICE_USER:$SERVICE_GROUP" "$STATE_FILE" 2>/dev/null || true
    exit 0
  fi

  log_line "Host-Update fehlgeschlagen (Exit $exit_code)."
  write_state "$(node -e "console.log(JSON.stringify({
    status: 'failed',
    finishedAt: new Date().toISOString(),
    exitCode: Number(process.argv[1]),
    commitAfter: process.argv[2],
    error: 'Host-Update-Script beendet mit Exit-Code ' + process.argv[1],
  }))" "$exit_code" "$commit_after")"
  chown "$SERVICE_USER:$SERVICE_GROUP" "$STATE_FILE" 2>/dev/null || true
  exit "$exit_code"
}

main "$@"
