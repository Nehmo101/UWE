#!/usr/bin/env bash
# Applies the UWE Managed Challenge (full-page "Verify you are human" at the edge)
# to the Cloudflare zone.
#
# The desired state is NOT configured here — it is edited in UWE under
# System → Cloudflare and mirrored to data/cloudflare/managed-challenge.json.
# This script only (re-)applies that file, for bootstrap, recovery, or hosts
# where the Cloudflare API token lives in /etc/uwe/cloudflare.env instead of the
# UWE database. Studio applies the same rule itself on every save.
#
# Usage:
#   bash deploy/scripts/configure-cloudflare-managed-challenge.sh
#   bash deploy/scripts/configure-cloudflare-managed-challenge.sh --status
#   bash deploy/scripts/configure-cloudflare-managed-challenge.sh --dry-run
#
# Required (only for a real apply):
#   CLOUDFLARE_API_TOKEN  — Zone → Zone WAF → Edit on the UWE zone
#   CLOUDFLARE_ZONE_ID    — Zone ID of the UWE domain
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UWE_HOME="${UWE_HOME:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

for env_file in /etc/uwe/uwe.env /etc/uwe/cloudflare.env; do
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
done

# The tunnel script uses the CF_* spelling — accept both.
export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}"
export CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-${CF_ZONE_ID:-}}"

export PATH="/usr/local/bin:/usr/bin:/bin:${PNPM_HOME:-/usr/local/share/pnpm}:$PATH"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[FAIL] pnpm nicht gefunden — Managed Challenge nicht angewendet." >&2
  exit 1
fi

cd "$UWE_HOME"

CONFIG_FILE="${UWE_DATA_DIR:-$UWE_HOME/data}/cloudflare/managed-challenge.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[INFO] $CONFIG_FILE fehlt — Managed Challenge wurde in UWE noch nie gespeichert."
  echo "       System → Cloudflare öffnen, Einstellung speichern, dann erneut ausführen."
fi

exec pnpm cloudflare:challenge "$@"
