#!/usr/bin/env bash
# Read-only Cloudflare Tunnel checks for UWE production hosts.
# Usage: bash deploy/scripts/check-cloudflare-tunnel.sh [--public-url URL]
set -euo pipefail

PUBLIC_URL="${PUBLIC_APP_URL:-${PUBLIC_BASE_URL:-}}"
STUDIO_URL="${NEXT_PUBLIC_STUDIO_URL:-}"
PORTAL_URL="${NEXT_PUBLIC_PORTAL_URL:-}"
FAMILY_URL="${NEXT_PUBLIC_FAMILY_URL:-}"
TUNNEL_CONFIG="${CLOUDFLARED_CONFIG:-/etc/cloudflared/config.yml}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public-url)
      PUBLIC_URL="$2"
      shift 2
      ;;
    -h | --help)
      echo "Usage: $0 [--public-url https://uwe.example]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -f /etc/uwe/uwe.env ]]; then
  # shellcheck disable=SC1091
  set -a && source /etc/uwe/uwe.env && set +a
  PUBLIC_URL="${PUBLIC_URL:-${PUBLIC_APP_URL:-${PUBLIC_BASE_URL:-}}}"
  STUDIO_URL="${STUDIO_URL:-${NEXT_PUBLIC_STUDIO_URL:-}}"
  PORTAL_URL="${PORTAL_URL:-${NEXT_PUBLIC_PORTAL_URL:-}}"
  FAMILY_URL="${FAMILY_URL:-${NEXT_PUBLIC_FAMILY_URL:-}}"
fi

PORTAL_URL="${PORTAL_URL:-$PUBLIC_URL}"

# Apex-Domain aus der konfigurierten öffentlichen URL ableiten, damit die
# Ingress-Checks unten ohne fest verdrahteten Hostnamen auskommen. Ohne
# PUBLIC_APP_URL greifen nur die generischen Hostname-Prüfungen.
APEX_DOMAIN="$(printf '%s' "$PUBLIC_URL" | sed -E 's#^[a-z]+://##; s#/.*$##; s#:[0-9]+$##; s#^(studio|portal|brain|family)\.##')"
apex_re() { printf '%s' "$1" | sed 's/\./\\./g'; }

status_ok=0
status_warn=0
status_fail=0

report() {
  local level="$1"
  local message="$2"
  case "$level" in
    ok) echo "[OK] $message" ;;
    warn) echo "[WARN] $message" >&2; status_warn=$((status_warn + 1)) ;;
    fail) echo "[FAIL] $message" >&2; status_fail=$((status_fail + 1)) ;;
  esac
}

if command -v cloudflared >/dev/null 2>&1; then
  report ok "cloudflared installed ($(cloudflared --version 2>/dev/null | head -1))"
else
  report warn "cloudflared nicht installiert — Tunnel-Checks übersprungen"
fi

if systemctl is-active --quiet cloudflared 2>/dev/null; then
  report ok "cloudflared systemd service aktiv"
elif pgrep -x cloudflared >/dev/null 2>&1; then
  report ok "cloudflared Prozess läuft (ohne systemd)"
else
  report warn "cloudflared läuft nicht — öffentlicher Zugriff über Tunnel nicht verfügbar"
fi

if [[ -f "$TUNNEL_CONFIG" ]]; then
  report ok "Tunnel-Konfiguration gefunden: $TUNNEL_CONFIG"
  if grep -Eq '127\.0\.0\.1:(11434|8787|8080|3000|3001)' "$TUNNEL_CONFIG"; then
    if grep -Eq '127\.0\.0\.1:(11434|8787)' "$TUNNEL_CONFIG"; then
      report fail "Tunnel-Konfiguration zeigt auf Maschinenraum/Ollama-Port — niemals öffentlich exponieren"
    fi
  fi
  if grep -qiE 'ollama|engine|11434|8787' "$TUNNEL_CONFIG"; then
    report fail "Tunnel-Konfiguration enthält Maschinenraum/Ollama-Referenzen"
  fi
  # Brain is owner-only and loopback by default (ADR 004/007) — it must not appear
  # in the public tunnel ingress UNLESS the owner has deliberately opted in via
  # BRAIN_PUBLIC_TUNNEL=1 (Brain enforces owner-role auth on every route; enabling
  # this is a conscious decision to publish an owner-gated Brain host, and 2FA on
  # the owner is strongly expected). Without the opt-in, a brain hostname/:3002 in
  # the tunnel is still a hard failure. Only ACTIVE (non-comment) lines count.
  active_ingress="$(grep -vE '^[[:space:]]*#' "$TUNNEL_CONFIG" || true)"
  brain_opt_in=0
  case "${BRAIN_PUBLIC_TUNNEL:-}" in 1|true|TRUE|yes|on) brain_opt_in=1 ;; esac
  brain_port="${BRAIN_PORT:-3102}"
  if printf '%s\n' "$active_ingress" | grep -Eq "127\.0\.0\.1:${brain_port}"; then
    if [[ "$brain_opt_in" == "1" ]]; then
      report warn "Tunnel zeigt auf den Brain-Port (:${brain_port}) — bewusst per BRAIN_PUBLIC_TUNNEL=1 freigeschaltet (Owner-Auth + 2FA vorausgesetzt)"
    else
      report fail "Tunnel-Konfiguration zeigt auf den Brain-Port (:${brain_port}) — Brain ist owner-only/lokal; für öffentliche Freischaltung BRAIN_PUBLIC_TUNNEL=1 setzen"
    fi
  fi
  if printf '%s\n' "$active_ingress" | grep -qiE 'hostname:[[:space:]]*brain\.'; then
    if [[ "$brain_opt_in" == "1" ]]; then
      report warn "Brain-Hostname im Tunnel — bewusst per BRAIN_PUBLIC_TUNNEL=1 freigeschaltet (owner-gated)"
    else
      report fail "Tunnel-Konfiguration enthält einen Brain-Hostname — für öffentliche Freischaltung BRAIN_PUBLIC_TUNNEL=1 setzen"
    fi
  fi
  if grep -qE "hostname:[[:space:]]*portal\." "$TUNNEL_CONFIG" 2>/dev/null; then
    report ok "Split-Hostname-Ingress: portal-Hostname konfiguriert"
  elif [[ -n "$PORTAL_URL" && "$PORTAL_URL" == *"portal."* ]]; then
    report warn "NEXT_PUBLIC_PORTAL_URL zeigt auf einen portal-Hostnamen — Tunnel-Ingress fehlt lokal (Remote-Tunnel im Dashboard prüfen)"
  fi
  # Family ist häkchen-gegated, aber ausdrücklich für den Haushalt gedacht: ein
  # fehlender Ingress ist kein Sicherheitsproblem, sondern ein toter Link. UWE
  # leitet die Family-Adresse aus dem Split-Hostname-Layout ab, wenn
  # NEXT_PUBLIC_FAMILY_URL fehlt (resolveFamilyPublicBaseUrl) — geprüft wird
  # deshalb genau der Hostname, auf den die Links tatsächlich zeigen.
  family_host=""
  if [[ -n "$FAMILY_URL" ]]; then
    family_host="$(printf '%s' "$FAMILY_URL" | sed -E 's#^[a-z]+://##; s#/.*$##; s#:[0-9]+$##')"
  elif [[ -n "$APEX_DOMAIN" ]]; then
    family_host="family.${APEX_DOMAIN}"
  fi
  case "$family_host" in
    "" | localhost | 127.* | ::1) family_host="" ;;
  esac
  if grep -qE "hostname:[[:space:]]*family\." "$TUNNEL_CONFIG" 2>/dev/null; then
    report ok "Split-Hostname-Ingress: family-Hostname konfiguriert"
  elif [[ -n "$family_host" ]]; then
    report warn "Family-Links zeigen auf ${family_host}, im Tunnel fehlt der Ingress — einrichten: bash deploy/scripts/configure-cloudflare-tunnel.sh"
  else
    report warn "Family bleibt lokal (http://localhost:3004) — ohne öffentliche Domain gibt es keinen Family-Hostnamen"
  fi
  if grep -qE "hostname:[[:space:]]*studio\." "$TUNNEL_CONFIG" 2>/dev/null; then
    report ok "Split-Hostname-Ingress: studio-Hostname konfiguriert"
  elif grep -q '/studio' "$TUNNEL_CONFIG" 2>/dev/null; then
    report warn "Legacy-Pfad-Ingress erkannt — empfohlen: Split-Hostnames (deploy/cloudflare/config.yml.example)"
  fi
  # Der Apex trägt nur die Startseite (apps/landing, :3103). Zeigt er auf den
  # Studio-Port, liefert die Hauptdomain wieder die komplette Studio-Oberfläche
  # aus — genau die Kopplung, die die eigene Landing-App auflöst.
  apex_service=""
  if [[ -n "$APEX_DOMAIN" ]]; then
    apex_service="$(awk -v re="hostname:[[:space:]]*$(apex_re "$APEX_DOMAIN")[[:space:]]*$" \
      '$0 ~ re {found=1;next} found&&/service:/{print;exit}' "$TUNNEL_CONFIG" 2>/dev/null)"
  fi
  if [[ -n "$apex_service" ]]; then
    if printf '%s' "$apex_service" | grep -q '3103'; then
      report ok "Apex-Ingress: ${APEX_DOMAIN} → Startseiten-App (:3103)"
    else
      report warn "Apex-Ingress zeigt nicht auf die Startseiten-App (:3103):${apex_service}"
    fi
  fi
else
  report warn "Keine Tunnel-Konfiguration unter $TUNNEL_CONFIG"
fi

if command -v cloudflared >/dev/null 2>&1; then
  if cloudflared tunnel list 2>/dev/null | grep -q .; then
    report ok "cloudflared tunnel list — mindestens ein Tunnel registriert"
  else
    report warn "cloudflared tunnel list — keine Tunnel sichtbar (Login fehlt?)"
  fi
fi

if [[ -n "$PORTAL_URL" ]]; then
  public_health="${PORTAL_URL%/}/api/health/public"
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$public_health" 2>/dev/null || echo 000)"
  if [[ "$code" =~ ^2 ]]; then
    report ok "Portal Healthcheck $public_health → HTTP $code"
  elif [[ "$code" == "000" ]]; then
    report warn "Portal Healthcheck nicht erreichbar: $public_health"
  else
    report warn "Portal Healthcheck $public_health → HTTP $code"
  fi

  portal_root="${PORTAL_URL%/}/"
  portal_root_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -L "$portal_root" 2>/dev/null || echo 000)"
  if [[ "$portal_root_code" =~ ^(401|403|302|307)$ ]] || [[ "$portal_root_code" =~ ^2 ]]; then
    report ok "Portal-Root $portal_root → HTTP $portal_root_code (Login-Schutz erwartet)"
  elif [[ "$portal_root_code" == "000" ]]; then
    report warn "Portal-Root nicht erreichbar: $portal_root"
  else
    report warn "Portal-Root $portal_root → HTTP $portal_root_code"
  fi

  legacy_studio="${PORTAL_URL%/}/studio/worlds"
  legacy_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -L "$legacy_studio" 2>/dev/null || echo 000)"
  if [[ "$legacy_code" =~ ^(301|302|307|308)$ ]]; then
    report ok "Legacy /studio/* Redirect $legacy_studio → HTTP $legacy_code"
  elif [[ -n "$STUDIO_URL" && "$STUDIO_URL" != "$PORTAL_URL" ]]; then
    report warn "Legacy /studio/* ohne Redirect: $legacy_studio → HTTP $legacy_code"
  fi
else
  report warn "PUBLIC_APP_URL / NEXT_PUBLIC_PORTAL_URL nicht gesetzt — Portal-Probes übersprungen"
fi

if [[ -n "$STUDIO_URL" && "$STUDIO_URL" != "$PORTAL_URL" ]]; then
  studio_health="${STUDIO_URL%/}/api/health/public"
  studio_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$studio_health" 2>/dev/null || echo 000)"
  if [[ "$studio_code" =~ ^2 ]]; then
    report ok "Studio Healthcheck $studio_health → HTTP $studio_code"
  elif [[ "$studio_code" == "000" ]]; then
    report warn "Studio Healthcheck nicht erreichbar: $studio_health"
  else
    report warn "Studio Healthcheck $studio_health → HTTP $studio_code"
  fi

  studio_api="${STUDIO_URL%/}/api/health"
  studio_api_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$studio_api" 2>/dev/null || echo 000)"
  if [[ "$studio_api_code" =~ ^(401|403|302|307)$ ]]; then
    report ok "Studio-API geschützt $studio_api → HTTP $studio_api_code"
  elif [[ "$studio_api_code" =~ ^2 ]]; then
    report warn "Studio-API ohne Auth erreichbar ($studio_api → HTTP $studio_api_code) — Cloudflare Access prüfen"
  elif [[ "$studio_api_code" == "000" ]]; then
    report warn "Studio-API-Probe nicht erreichbar: $studio_api"
  else
    report warn "Studio-API-Probe $studio_api → HTTP $studio_api_code"
  fi
elif [[ -n "$PUBLIC_URL" ]]; then
  studio_probe="${PUBLIC_URL%/}/studio/api/health"
  studio_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$studio_probe" 2>/dev/null || echo 000)"
  if [[ "$studio_code" =~ ^(401|403|302|307)$ ]]; then
    report ok "Studio-API geschützt (Legacy-Pfad) $studio_probe → HTTP $studio_code"
  elif [[ "$studio_code" =~ ^2 ]]; then
    report warn "Studio-API ohne Auth erreichbar ($studio_probe → HTTP $studio_code) — Cloudflare Access prüfen"
  elif [[ "$studio_code" == "000" ]]; then
    report warn "Studio-API-Probe nicht erreichbar: $studio_probe"
  else
    report warn "Studio-API-Probe $studio_probe → HTTP $studio_code"
  fi
fi

# Managed Challenge (edge "Verify you are human") — desired state as UWE stored it.
# A challenge that also covered /api/health would make every probe above look
# like an outage, so the exemption is checked explicitly.
CHALLENGE_CONFIG="${UWE_DATA_DIR:-${UWE_HOME:-/opt/uwe}/data}/cloudflare/managed-challenge.json"
if [[ -f "$CHALLENGE_CONFIG" ]]; then
  challenge_enabled="$(grep -o '"enabled"[[:space:]]*:[[:space:]]*[a-z]*' "$CHALLENGE_CONFIG" | grep -o '[a-z]*$' || echo "false")"
  if [[ "$challenge_enabled" == "true" ]]; then
    if grep -q '"/api/health"' "$CHALLENGE_CONFIG"; then
      report ok "Managed Challenge aktiviert — /api/health ausgenommen"
    else
      report fail "Managed Challenge aktiviert, aber /api/health nicht ausgenommen — Probes und Timer scheitern"
    fi
  else
    report ok "Managed Challenge nicht aktiviert (UWE → System → Cloudflare)"
  fi
else
  report ok "Managed Challenge nie konfiguriert — kein Edge-Challenge-Gate"
fi

echo ""
echo "Cloudflare Tunnel check: ${status_fail} fail, ${status_warn} warn"

if [[ "$status_fail" -gt 0 ]]; then
  exit 1
fi
exit 0
