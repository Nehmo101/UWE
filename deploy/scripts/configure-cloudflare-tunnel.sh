#!/usr/bin/env bash
# Apply recommended UWE split-hostname Cloudflare Tunnel ingress via Cloudflare API.
# Requires CLOUDFLARE_API_TOKEN with Cloudflare Tunnel Edit + DNS Edit on the UWE zone.
#
# Die Hostnamen kommen aus der Host-Konfiguration (PUBLIC_BASE_URL,
# NEXT_PUBLIC_STUDIO_URL, NEXT_PUBLIC_PORTAL_URL in /etc/uwe/uwe.env), nicht aus
# einem fest verdrahteten Beispiel-Namen — sonst schreibt der Aufruf eine
# Konfiguration für eine fremde Domain und der echte Apex bleibt auf seinem
# alten Ingress (typischerweise Studio) stehen.
#
# Usage:
#   CLOUDFLARE_API_TOKEN=... bash deploy/scripts/configure-cloudflare-tunnel.sh
#   CLOUDFLARE_API_TOKEN=... bash deploy/scripts/configure-cloudflare-tunnel.sh --dry-run
#   bash deploy/scripts/configure-cloudflare-tunnel.sh --apex-domain meine-domain.tld --dry-run
#
# Optional overrides:
#   CLOUDFLARE_ACCOUNT_ID  (default: decoded from running cloudflared token or uwe.env)
#   CLOUDFLARE_TUNNEL_ID   (default: decoded from running cloudflared token or uwe.env)
#   UWE_APEX_DOMAIN        (default: host part of PUBLIC_BASE_URL / PUBLIC_APP_URL)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UWE_HOME="${UWE_HOME:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
DRY_RUN=false
APEX_DOMAIN_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --apex-domain) APEX_DOMAIN_ARG="${2:-}"; shift 2 ;;
    -h | --help)
      echo "Usage: CLOUDFLARE_API_TOKEN=... $0 [--apex-domain meine-domain.tld] [--dry-run]"
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

STUDIO_PORT="${STUDIO_PORT:-3000}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
LANDING_PORT="${LANDING_PORT:-3103}"

# Hostname aus einer konfigurierten URL ziehen (Schema, Pfad und Port entfernen).
# Erst kleinschreiben, dann zerlegen — sonst überlebt ein „HTTPS://" das Schema-Muster.
url_host() {
  printf '%s' "${1:-}" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's#^[[:space:]]+##; s#[[:space:]]+$##; s#^[a-z]+://##; s#/.*$##; s#:[0-9]+$##'
}

APEX_DOMAIN="${APEX_DOMAIN_ARG:-${UWE_APEX_DOMAIN:-}}"
if [[ -z "$APEX_DOMAIN" ]]; then
  APEX_DOMAIN="${PUBLIC_BASE_URL:-${PUBLIC_APP_URL:-}}"
fi
# Immer normalisieren (auch beim --apex-domain-Argument): Cloudflare-Ingress
# vergleicht Hostnamen kleingeschrieben, und eine übergebene URL soll ebenso
# funktionieren wie ein reiner Hostname. Ein studio./portal./brain.-Präfix
# gehört zur Subdomain, nicht zum Apex.
APEX_DOMAIN="$(url_host "$APEX_DOMAIN" | sed -E 's#^(studio|portal|brain|family)\.##')"

STUDIO_HOST="$(url_host "${NEXT_PUBLIC_STUDIO_URL:-}")"
PORTAL_HOST="$(url_host "${NEXT_PUBLIC_PORTAL_URL:-}")"
if [[ -n "$APEX_DOMAIN" && -z "$STUDIO_HOST" ]]; then
  STUDIO_HOST="studio.${APEX_DOMAIN}"
fi
if [[ -n "$APEX_DOMAIN" && -z "$PORTAL_HOST" ]]; then
  PORTAL_HOST="portal.${APEX_DOMAIN}"
fi

if [[ -z "$APEX_DOMAIN" ]]; then
  echo "[FAIL] Apex-Domain nicht ermittelbar." >&2
  echo "Setze PUBLIC_BASE_URL in /etc/uwe/uwe.env oder übergib --apex-domain <domain>." >&2
  exit 1
fi

case "$APEX_DOMAIN" in
  localhost | 127.0.0.1 | *.local | uwe.example | *.uwe.example)
    echo "[FAIL] Apex-Domain '$APEX_DOMAIN' ist ein Platzhalter oder lokal — das wäre keine öffentliche Route." >&2
    echo "Setze PUBLIC_BASE_URL auf die echte Domain (z. B. https://uwe.example → deine Domain)." >&2
    exit 1
    ;;
esac

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

# Reihenfolge zählt: Die Pfad-Regeln des Apex (/studio, /portal) müssen vor dem
# Apex-Catch-all stehen, sonst fängt die Startseite sie ab. Der Apex selbst zeigt
# zuletzt auf die Landing-App — nicht auf Studio.
CONFIG_JSON="$(
  STUDIO_HOST="$STUDIO_HOST" \
  PORTAL_HOST="$PORTAL_HOST" \
  APEX_DOMAIN="$APEX_DOMAIN" \
  STUDIO_PORT="$STUDIO_PORT" \
  PORTAL_PORT="$PORTAL_PORT" \
  LANDING_PORT="$LANDING_PORT" \
  python3 - <<'PY'
import json, os

studio = f"http://127.0.0.1:{os.environ['STUDIO_PORT']}"
portal = f"http://127.0.0.1:{os.environ['PORTAL_PORT']}"
landing = f"http://127.0.0.1:{os.environ['LANDING_PORT']}"
apex = os.environ["APEX_DOMAIN"]

ingress = [
    {"hostname": os.environ["STUDIO_HOST"], "service": studio},
    {"hostname": os.environ["PORTAL_HOST"], "service": portal},
    {"hostname": apex, "path": "/studio", "service": studio},
    {"hostname": apex, "path": "/portal", "service": portal},
    {"hostname": apex, "service": landing},
    {"service": "http_status:404"},
]
print(json.dumps({"config": {"ingress": ingress}}, indent=2))
PY
)"

echo "Account:  $CLOUDFLARE_ACCOUNT_ID"
echo "Tunnel:   $CLOUDFLARE_TUNNEL_ID"
echo "Ingress:  ${STUDIO_HOST} → :${STUDIO_PORT}"
echo "          ${PORTAL_HOST} → :${PORTAL_PORT}"
echo "          ${APEX_DOMAIN} (/studio, /portal, default → Startseite :${LANDING_PORT})"

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
probe "https://${STUDIO_HOST}/api/health/public"
probe "https://${PORTAL_HOST}/api/health/public"
# Die Apex-Health kommt aus der Landing-App: sie meldet "app":"UWE Landing".
# Steht dort "UWE Studio", zeigt der Apex-Ingress noch auf Studio.
probe "https://${APEX_DOMAIN}/api/health"

echo "[OK] Fertig. Prüfe danach: bash $UWE_HOME/deploy/scripts/check-cloudflare-tunnel.sh"
