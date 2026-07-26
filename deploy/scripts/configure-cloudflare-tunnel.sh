#!/usr/bin/env bash
# Apply recommended UWE split-hostname Cloudflare Tunnel ingress via Cloudflare API.
# Requires CLOUDFLARE_API_TOKEN with Cloudflare Tunnel Edit + DNS Edit (zone uweanddragons.org).
#
# Usage:
#   CLOUDFLARE_API_TOKEN=... bash deploy/scripts/configure-cloudflare-tunnel.sh
#   CLOUDFLARE_API_TOKEN=... bash deploy/scripts/configure-cloudflare-tunnel.sh --dry-run
#
# Optional overrides:
#   CLOUDFLARE_ACCOUNT_ID  (default: decoded from running cloudflared token or uwe.env)
#   CLOUDFLARE_TUNNEL_ID   (default: decoded from running cloudflared token or uwe.env)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UWE_HOME="${UWE_HOME:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    -h | --help)
      echo "Usage: CLOUDFLARE_API_TOKEN=... $0 [--dry-run]"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -f /etc/uwe/uwe.env ]]; then
  # shellcheck disable=SC1091
  set -a && source /etc/uwe/uwe.env && set +a
fi

if [[ -f /etc/uwe/cloudflare.env ]]; then
  # shellcheck disable=SC1091
  set -a && source /etc/uwe/cloudflare.env && set +a
fi

CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}"
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
CLOUDFLARE_TUNNEL_ID="${CLOUDFLARE_TUNNEL_ID:-}"

decode_tunnel_token() {
  local token="$1"
  python3 - <<'PY' "$token"
import base64, json, sys
token = sys.argv[1]
padding = "=" * (-len(token) % 4)
data = json.loads(base64.b64decode(token + padding))
print(data.get("a", ""))
print(data.get("t", ""))
PY
}

read_token_from_systemd() {
  local line token
  line="$(systemctl show cloudflared.service -p ExecStart --value 2>/dev/null || true)"
  token="$(sed -n 's/.*--token \([^ ]*\).*/\1/p' <<<"$line")"
  if [[ -n "$token" ]]; then
    decode_tunnel_token "$token"
  fi
}

if [[ -z "$CLOUDFLARE_ACCOUNT_ID" || -z "$CLOUDFLARE_TUNNEL_ID" ]]; then
  mapfile -t decoded < <(read_token_from_systemd || true)
  CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${decoded[0]:-}}"
  CLOUDFLARE_TUNNEL_ID="${CLOUDFLARE_TUNNEL_ID:-${decoded[1]:-}}"
fi

if [[ -z "$CLOUDFLARE_API_TOKEN" && "$DRY_RUN" != true ]]; then
  echo "[FAIL] CLOUDFLARE_API_TOKEN fehlt." >&2
  echo "Erstelle /etc/uwe/cloudflare.env (mode 600) mit:" >&2
  echo "  CLOUDFLARE_API_TOKEN=<dein-token>" >&2
  echo "Token-Rechte: Account → Cloudflare Tunnel → Edit, Zone → DNS → Edit" >&2
  exit 1
fi

if [[ -z "$CLOUDFLARE_ACCOUNT_ID" || -z "$CLOUDFLARE_TUNNEL_ID" ]]; then
  echo "[FAIL] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_TUNNEL_ID nicht ermittelbar." >&2
  exit 1
fi

read -r -d '' CONFIG_JSON <<'EOF' || true
{
  "config": {
    "ingress": [
      {
        "hostname": "studio.uweanddragons.org",
        "service": "http://127.0.0.1:3000"
      },
      {
        "hostname": "portal.uweanddragons.org",
        "service": "http://127.0.0.1:3001"
      },
      {
        "hostname": "uweanddragons.org",
        "path": "/studio",
        "service": "http://127.0.0.1:3000"
      },
      {
        "hostname": "uweanddragons.org",
        "path": "/portal",
        "service": "http://127.0.0.1:3001"
      },
      {
        "hostname": "uweanddragons.org",
        "service": "http://127.0.0.1:3103"
      },
      {
        "service": "http_status:404"
      }
    ]
  }
}
EOF

echo "Account:  $CLOUDFLARE_ACCOUNT_ID"
echo "Tunnel:   $CLOUDFLARE_TUNNEL_ID"
echo "Ingress:  studio.uweanddragons.org → :3000"
echo "          portal.uweanddragons.org → :3001"
echo "          uweanddragons.org (/studio, /portal, default → Landing :3103)"

if [[ "$DRY_RUN" == true ]]; then
  echo "$CONFIG_JSON" | python3 -m json.tool
  echo "[DRY-RUN] Keine API-Aufrufe."
  exit 0
fi

response="$(curl -sS \
  -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${CLOUDFLARE_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$CONFIG_JSON")"

if ! python3 - <<'PY' "$response"
import json, sys
payload = json.loads(sys.argv[1])
if not payload.get("success"):
    print(json.dumps(payload, indent=2))
    sys.exit(1)
print("Tunnel-Konfiguration aktualisiert (Version", payload.get("result", {}).get("version"), ")")
PY
then
  echo "[FAIL] Cloudflare API — Tunnel-Konfiguration nicht übernommen." >&2
  exit 1
fi

echo "[OK] Warte auf cloudflared-Konfigurations-Push …"
sleep 5

probe() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url" 2>/dev/null || echo 000)"
  echo "  $url → HTTP $code"
}

echo "[OK] Probes:"
probe "https://studio.uweanddragons.org/api/health/public"
probe "https://portal.uweanddragons.org/api/health/public"
probe "https://uweanddragons.org/api/health"

echo "[OK] Fertig. Prüfe danach: bash $UWE_HOME/deploy/scripts/check-cloudflare-tunnel.sh"
