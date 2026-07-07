#!/usr/bin/env bash
# CD deployment trigger — called via SSH from GitHub Actions after CI passes on main.
# Writes a host-update-request.json and calls uwe-host-update-trigger.sh via sudo.
# The uwe service user must have the NOPASSWD sudoers entry from deploy/sudoers/uwe-host-update.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# shellcheck source=lib/uwe-host-common.sh
source "$LIB_DIR/uwe-host-common.sh"

REQUEST_FILE="${UWE_DATA_DIR}/host-update-request.json"

main() {
  UWE_HOME="$(detect_uwe_home "$SCRIPT_DIR")"
  export UWE_HOME

  local commit_before
  commit_before="$(git -C "$UWE_HOME" rev-parse HEAD 2>/dev/null || echo "unknown")"

  node -e "
    const fs = require('node:fs');
    const crypto = require('node:crypto');
    const req = {
      jobId: 'cd-' + crypto.randomBytes(8).toString('hex'),
      requestedAt: new Date().toISOString(),
      actorUserId: null,
      commitBefore: process.argv[1],
    };
    fs.writeFileSync(process.argv[2], JSON.stringify(req, null, 2) + '\n', { mode: 0o640 });
    console.log('[CD] Update-Anfrage erstellt:', req.jobId);
  " "$commit_before" "$REQUEST_FILE"

  log "Starte Host-Update …"
  # Run the trigger unprivileged; it escalates only `systemctl start uwe-host-update.service`
  # via the scoped sudoers rule. Do NOT `sudo` the script itself (privilege-escalation risk).
  "$SCRIPT_DIR/uwe-host-update-trigger.sh"
}

main "$@"
