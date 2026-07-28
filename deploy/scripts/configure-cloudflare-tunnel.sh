#!/usr/bin/env bash
# Richtet den empfohlenen UWE-Split-Hostname-Ingress im Cloudflare Tunnel ein —
# inklusive der DNS-Einträge, die jeder Hostname braucht.
#
# Die Hostnamen kommen aus der Host-Konfiguration (/etc/uwe/uwe.env), nicht aus
# einer Beispieldomain: PUBLIC_BASE_URL nennt den Apex, NEXT_PUBLIC_*_URL die
# einzelnen Apps. Fehlt eine App-URL, gilt die dokumentierte Konvention
# `<app>.<apex>` (deploy/cloudflare/config.yml.example).
#
# Requires CLOUDFLARE_API_TOKEN mit: Account → Cloudflare Tunnel → Edit
#                                    Zone → DNS → Edit
#
# Usage:
#   CLOUDFLARE_API_TOKEN=... bash deploy/scripts/configure-cloudflare-tunnel.sh
#   CLOUDFLARE_API_TOKEN=... bash deploy/scripts/configure-cloudflare-tunnel.sh --dry-run
#
# Optional overrides:
#   CLOUDFLARE_ACCOUNT_ID  (default: decoded from running cloudflared token or uwe.env)
#   CLOUDFLARE_TUNNEL_ID   (default: decoded from running cloudflared token or uwe.env)
#   CLOUDFLARE_ZONE_ID     (default: über die Cloudflare-API zum Apex ermittelt)
#   BRAIN_PUBLIC_TUNNEL=1  (Brain ist owner-only — nur mit diesem Opt-in im Tunnel)
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
CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"

# ── Hostnamen aus der Host-Konfiguration ───────────────────────────────────

# Hostname aus einer URL: Schema, Pfad, Port und Benutzerteil fallen weg.
url_host() {
  printf '%s' "${1:-}" | sed -E 's#^[a-z]+://##; s#/.*$##; s#^[^@]*@##; s#:[0-9]+$##' | tr '[:upper:]' '[:lower:]'
}

# Nur echte öffentliche Hostnamen taugen als Tunnel-Ingress.
is_public_host() {
  local host="${1:-}"
  [[ -n "$host" && "$host" == *.* && "$host" != "localhost" && ! "$host" =~ ^127\. && "$host" != "::1" ]]
}

APEX_HOST="$(url_host "${PUBLIC_BASE_URL:-${PUBLIC_APP_URL:-}}")"
STUDIO_HOST="$(url_host "${NEXT_PUBLIC_STUDIO_URL:-}")"
PORTAL_HOST="$(url_host "${NEXT_PUBLIC_PORTAL_URL:-}")"
FAMILY_HOST="$(url_host "${NEXT_PUBLIC_FAMILY_URL:-}")"
BRAIN_HOST="$(url_host "${NEXT_PUBLIC_BRAIN_URL:-}")"

# Ohne Apex lässt sich nichts ableiten — dann muss die Konfiguration her.
if ! is_public_host "$APEX_HOST"; then
  # Der Apex steckt sonst noch in einer App-URL: studio.example.org → example.org
  for candidate in "$STUDIO_HOST" "$PORTAL_HOST"; do
    if is_public_host "$candidate"; then
      APEX_HOST="${candidate#*.}"
      break
    fi
  done
fi

if ! is_public_host "$APEX_HOST"; then
  echo "[FAIL] Öffentliche Domain nicht ermittelbar." >&2
  echo "Setze PUBLIC_BASE_URL (z. B. https://uwe.example) in /etc/uwe/uwe.env." >&2
  exit 1
fi

is_public_host "$STUDIO_HOST" || STUDIO_HOST="studio.${APEX_HOST}"
is_public_host "$PORTAL_HOST" || PORTAL_HOST="portal.${APEX_HOST}"
# Family folgt derselben Konvention wie der Link-Resolver in @uwe/auth
# (resolveFamilyPublicBaseUrl) — sonst zeigten die Family-Links ins Leere.
is_public_host "$FAMILY_HOST" || FAMILY_HOST="family.${APEX_HOST}"

STUDIO_PORT="${STUDIO_PORT:-3000}"
PORTAL_PORT="${PORTAL_PORT:-3001}"
FAMILY_PORT="${FAMILY_PORT:-3004}"
BRAIN_PORT="${BRAIN_PORT:-3002}"
LANDING_PORT="${LANDING_PORT:-3103}"

# Brain ist owner-only und bleibt ohne ausdrückliches Opt-in aus dem Tunnel
# (ADR 004/007) — dieselbe Regel prüft check-cloudflare-tunnel.sh.
BRAIN_IN_TUNNEL=false
case "${BRAIN_PUBLIC_TUNNEL:-}" in
  1 | true | TRUE | yes | on)
    if is_public_host "$BRAIN_HOST"; then
      BRAIN_IN_TUNNEL=true
    else
      BRAIN_HOST="brain.${APEX_HOST}"
      BRAIN_IN_TUNNEL=true
    fi
    ;;
esac

# ── Zugangsdaten ───────────────────────────────────────────────────────────

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

# ── Ingress ────────────────────────────────────────────────────────────────

# Reihenfolge zählt: die App-Hostnamen zuerst, dann die Alt-Pfade auf dem Apex,
# dann der Apex selbst (Startseite) und zuletzt der 404-Fallback.
build_ingress_json() {
  python3 - "$@" <<'PY'
import json, sys

studio_host, portal_host, family_host, apex_host = sys.argv[1:5]
studio_port, portal_port, family_port, landing_port = sys.argv[5:9]
brain_host, brain_port, brain_enabled = sys.argv[9:12]

ingress = [
    {"hostname": studio_host, "service": f"http://127.0.0.1:{studio_port}"},
    {"hostname": portal_host, "service": f"http://127.0.0.1:{portal_port}"},
    {"hostname": family_host, "service": f"http://127.0.0.1:{family_port}"},
]
if brain_enabled == "true":
    ingress.append({"hostname": brain_host, "service": f"http://127.0.0.1:{brain_port}"})
ingress += [
    {"hostname": apex_host, "path": "/studio", "service": f"http://127.0.0.1:{studio_port}"},
    {"hostname": apex_host, "path": "/portal", "service": f"http://127.0.0.1:{portal_port}"},
    {"hostname": apex_host, "service": f"http://127.0.0.1:{landing_port}"},
    {"service": "http_status:404"},
]
print(json.dumps({"config": {"ingress": ingress}}))
PY
}

CONFIG_JSON="$(build_ingress_json \
  "$STUDIO_HOST" "$PORTAL_HOST" "$FAMILY_HOST" "$APEX_HOST" \
  "$STUDIO_PORT" "$PORTAL_PORT" "$FAMILY_PORT" "$LANDING_PORT" \
  "$BRAIN_HOST" "$BRAIN_PORT" "$BRAIN_IN_TUNNEL")"

# Jeder geroutete Hostname braucht auch einen DNS-Eintrag auf den Tunnel.
DNS_HOSTS=("$STUDIO_HOST" "$PORTAL_HOST" "$FAMILY_HOST" "$APEX_HOST")
if [[ "$BRAIN_IN_TUNNEL" == true ]]; then
  DNS_HOSTS+=("$BRAIN_HOST")
fi

echo "Account:  $CLOUDFLARE_ACCOUNT_ID"
echo "Tunnel:   $CLOUDFLARE_TUNNEL_ID"
echo "Ingress:  $STUDIO_HOST → :$STUDIO_PORT"
echo "          $PORTAL_HOST → :$PORTAL_PORT"
echo "          $FAMILY_HOST → :$FAMILY_PORT"
if [[ "$BRAIN_IN_TUNNEL" == true ]]; then
  echo "          $BRAIN_HOST → :$BRAIN_PORT (Opt-in BRAIN_PUBLIC_TUNNEL)"
else
  echo "          (Brain bleibt lokal — Opt-in BRAIN_PUBLIC_TUNNEL=1 fehlt)"
fi
echo "          $APEX_HOST (/studio, /portal, default → Landing :$LANDING_PORT)"

if [[ "$DRY_RUN" == true ]]; then
  echo "$CONFIG_JSON" | python3 -m json.tool
  echo "[DRY-RUN] DNS-Einträge: ${DNS_HOSTS[*]} → ${CLOUDFLARE_TUNNEL_ID}.cfargotunnel.com"
  echo "[DRY-RUN] Keine API-Aufrufe."
  exit 0
fi

cf_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "https://api.cloudflare.com/client/v4${path}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$body"
  else
    curl -sS -X "$method" "https://api.cloudflare.com/client/v4${path}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
  fi
}

# Liest ein Feld aus einer Cloudflare-Antwort; Exit 1, wenn success=false.
cf_field() {
  python3 - "$1" "$2" <<'PY'
import json, sys
try:
    payload = json.loads(sys.argv[1])
except json.JSONDecodeError:
    print("Antwort war kein JSON", file=sys.stderr)
    sys.exit(1)
if not payload.get("success"):
    print(json.dumps(payload.get("errors", payload), indent=2), file=sys.stderr)
    sys.exit(1)
result = payload.get("result")
expr = sys.argv[2]
if expr == "":
    sys.exit(0)
if expr == "version":
    print((result or {}).get("version", ""))
elif expr == "first-id":
    print(result[0]["id"] if result else "")
elif expr == "first-content":
    print(result[0].get("content", "") if result else "")
PY
}

response="$(cf_api PUT "/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${CLOUDFLARE_TUNNEL_ID}/configurations" "$CONFIG_JSON")"
if ! version="$(cf_field "$response" version)"; then
  echo "[FAIL] Cloudflare API — Tunnel-Konfiguration nicht übernommen." >&2
  exit 1
fi
echo "[OK] Tunnel-Konfiguration aktualisiert (Version ${version})"

# ── DNS ────────────────────────────────────────────────────────────────────

if [[ -z "$CLOUDFLARE_ZONE_ID" ]]; then
  zone_response="$(cf_api GET "/zones?name=${APEX_HOST}")"
  # Kein harter Abbruch: der Ingress steht bereits, und die DNS-Einträge können
  # aus einer früheren Einrichtung stammen. Fehlt das Zone-Recht, sagen wir das
  # und laufen bis zu den Probes weiter — die zeigen, ob es trotzdem passt.
  CLOUDFLARE_ZONE_ID="$(cf_field "$zone_response" first-id || true)"
fi

if [[ -z "$CLOUDFLARE_ZONE_ID" ]]; then
  echo "[WARN] Zone zu ${APEX_HOST} nicht lesbar — DNS-Einträge bitte im Dashboard prüfen" >&2
  echo "       (Token-Recht: Zone → DNS → Edit)." >&2
else
  TUNNEL_TARGET="${CLOUDFLARE_TUNNEL_ID}.cfargotunnel.com"
  for host in "${DNS_HOSTS[@]}"; do
    record_response="$(cf_api GET "/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=${host}")"
    record_id="$(cf_field "$record_response" first-id || true)"
    record_content="$(cf_field "$record_response" first-content || true)"
    record_body="$(python3 - "$host" "$TUNNEL_TARGET" <<'PY'
import json, sys
print(json.dumps({
    "type": "CNAME",
    "name": sys.argv[1],
    "content": sys.argv[2],
    "proxied": True,
}))
PY
)"
    if [[ -n "$record_id" && "$record_content" == "$TUNNEL_TARGET" ]]; then
      echo "  DNS $host → $TUNNEL_TARGET (unverändert)"
    elif [[ -n "$record_id" ]]; then
      if cf_field "$(cf_api PUT "/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${record_id}" "$record_body")" "" ; then
        echo "  DNS $host → $TUNNEL_TARGET (aktualisiert)"
      else
        echo "[WARN] DNS-Eintrag $host konnte nicht aktualisiert werden." >&2
      fi
    else
      if cf_field "$(cf_api POST "/zones/${CLOUDFLARE_ZONE_ID}/dns_records" "$record_body")" "" ; then
        echo "  DNS $host → $TUNNEL_TARGET (angelegt)"
      else
        echo "[WARN] DNS-Eintrag $host konnte nicht angelegt werden." >&2
      fi
    fi
  done
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
# Family antwortet ohne Sitzung mit einer Weiterleitung auf /login — jede
# Antwort außer 000 belegt, dass Tunnel und DNS stehen.
probe "https://${FAMILY_HOST}/api/health"
probe "https://${APEX_HOST}/api/health"

echo "[OK] Fertig. Prüfe danach: bash $UWE_HOME/deploy/scripts/check-cloudflare-tunnel.sh"
