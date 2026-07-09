#!/usr/bin/env bash
# Restarts uwe.service after validating UWE_HOST_RESTART_ENABLED.
# Invoked unprivileged from Studio; escalates only `systemctl restart uwe.service`
# via deploy/sudoers/uwe-host-restart.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/uwe-host-common.sh
source "$SCRIPT_DIR/lib/uwe-host-common.sh"

SERVICE_UNIT="${UWE_SERVICE_UNIT:-uwe.service}"

die() {
  echo "uwe-host-restart: $*" >&2
  exit 1
}

ok() {
  echo "uwe-host-restart: $*"
}

if [[ "${UWE_HOST_RESTART_ENABLED:-}" != "true" ]]; then
  die "UWE_HOST_RESTART_ENABLED ist nicht true."
fi

if ! command -v systemctl >/dev/null 2>&1; then
  die "systemctl nicht verfügbar — Neustart nur auf Linux-Production-Hosts."
fi

if ! systemctl list-unit-files "$SERVICE_UNIT" >/dev/null 2>&1; then
  die "Unit $SERVICE_UNIT nicht gefunden."
fi

sudo systemctl restart "$SERVICE_UNIT"
ok "Neustart ausgelöst für $SERVICE_UNIT"
