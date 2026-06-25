#!/usr/bin/env bash
# Read-only Cloudflare Tunnel checks for UWE production hosts.
# Usage: bash deploy/scripts/check-cloudflare-tunnel.sh [--public-url URL]
set -euo pipefail

PUBLIC_URL="${PUBLIC_APP_URL:-${PUBLIC_BASE_URL:-}}"
TUNNEL_CONFIG="${CLOUDFLARED_CONFIG:-/etc/cloudflared/config.yml}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public-url)
      PUBLIC_URL="$2"
      shift 2
      ;;
    -h | --help)
      echo "Usage: $0 [--public-url https://uweandragons.org]"
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
fi

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

if [[ -n "$PUBLIC_URL" ]]; then
  public_health="${PUBLIC_URL%/}/api/health/public"
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$public_health" 2>/dev/null || echo 000)"
  if [[ "$code" =~ ^2 ]]; then
    report ok "Öffentlicher Healthcheck $public_health → HTTP $code"
  elif [[ "$code" == "000" ]]; then
    report warn "Öffentlicher Healthcheck nicht erreichbar: $public_health"
  else
    report warn "Öffentlicher Healthcheck $public_health → HTTP $code"
  fi

  studio_probe="${PUBLIC_URL%/}/studio/api/health"
  studio_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$studio_probe" 2>/dev/null || echo 000)"
  if [[ "$studio_code" =~ ^(401|403|302|307)$ ]]; then
    report ok "Studio-API geschützt $studio_probe → HTTP $studio_code"
  elif [[ "$studio_code" =~ ^2 ]]; then
    report warn "Studio-API ohne Auth erreichbar ($studio_probe → HTTP $studio_code) — Cloudflare Access prüfen"
  elif [[ "$studio_code" == "000" ]]; then
    report warn "Studio-API-Probe nicht erreichbar: $studio_probe"
  else
    report warn "Studio-API-Probe $studio_probe → HTTP $studio_code"
  fi
else
  report warn "PUBLIC_APP_URL nicht gesetzt — öffentliche Probes übersprungen"
fi

echo ""
echo "Cloudflare Tunnel check: ${status_fail} fail, ${status_warn} warn"

if [[ "$status_fail" -gt 0 ]]; then
  exit 1
fi
exit 0
