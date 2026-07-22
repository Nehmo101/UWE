#!/usr/bin/env bash
# Read-only Cloudflare Tunnel checks for UWE production hosts.
# Usage: bash deploy/scripts/check-cloudflare-tunnel.sh [--public-url URL]
set -euo pipefail

PUBLIC_URL="${PUBLIC_APP_URL:-${PUBLIC_BASE_URL:-}}"
STUDIO_URL="${NEXT_PUBLIC_STUDIO_URL:-}"
PORTAL_URL="${NEXT_PUBLIC_PORTAL_URL:-}"
TUNNEL_CONFIG="${CLOUDFLARED_CONFIG:-/etc/cloudflared/config.yml}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public-url)
      PUBLIC_URL="$2"
      shift 2
      ;;
    -h | --help)
      echo "Usage: $0 [--public-url https://uweanddragons.org]"
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
fi

PORTAL_URL="${PORTAL_URL:-$PUBLIC_URL}"

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
      report fail "Tunnel-Konfiguration zeigt auf RTX/Ollama-Port — niemals öffentlich exponieren"
    fi
  fi
  if grep -qiE 'ollama|rtx|11434|8787' "$TUNNEL_CONFIG"; then
    report fail "Tunnel-Konfiguration enthält RTX/Ollama-Referenzen"
  fi
  # Brain is owner-only and local/LAN (ADR 004/007) — it must never appear in the
  # public tunnel ingress. Port 3002 is the Brain dev/app port; a brain hostname
  # is likewise forbidden. This mirrors the RTX/Ollama deny-by-default above.
  if grep -Eq '127\.0\.0\.1:3002' "$TUNNEL_CONFIG"; then
    report fail "Tunnel-Konfiguration zeigt auf den Brain-Port (:3002) — Brain ist owner-only/lokal und darf nie öffentlich exponiert werden"
  fi
  if grep -qiE 'hostname:[[:space:]]*brain\.|brain\.uweanddragons\.org' "$TUNNEL_CONFIG"; then
    report fail "Tunnel-Konfiguration enthält einen Brain-Hostname — Brain nie im öffentlichen Tunnel"
  fi
  if grep -q 'portal\.uweanddragons\.org' "$TUNNEL_CONFIG" 2>/dev/null; then
    report ok "Split-Hostname-Ingress: portal.uweanddragons.org konfiguriert"
  elif [[ -n "$PORTAL_URL" && "$PORTAL_URL" == *"portal.uweanddragons.org"* ]]; then
    report warn "NEXT_PUBLIC_PORTAL_URL=portal.uweanddragons.org — Tunnel-Ingress fehlt lokal (Remote-Tunnel im Dashboard prüfen)"
  fi
  if grep -q 'studio\.uweanddragons\.org' "$TUNNEL_CONFIG" 2>/dev/null; then
    report ok "Split-Hostname-Ingress: studio.uweanddragons.org konfiguriert"
  elif grep -q '/studio' "$TUNNEL_CONFIG" 2>/dev/null; then
    report warn "Legacy-Pfad-Ingress erkannt — empfohlen: Split-Hostnames (deploy/cloudflare/config.yml.example)"
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

echo ""
echo "Cloudflare Tunnel check: ${status_fail} fail, ${status_warn} warn"

if [[ "$status_fail" -gt 0 ]]; then
  exit 1
fi
exit 0
