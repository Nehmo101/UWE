#!/usr/bin/env bash
# Optional AI-assisted diagnostics for UWE host setup failures.
# Disabled by default — never required for installation.
# shellcheck shell=bash

UWE_AI_DIAG_ENABLED="${UWE_AI_DIAG_ENABLED:-0}"
UWE_AI_DIAG_PROVIDER="${UWE_AI_DIAG_PROVIDER:-openai}"
UWE_AI_DIAG_MODEL="${UWE_AI_DIAG_MODEL:-gpt-4o-mini}"
UWE_AI_DIAG_BASE_URL="${UWE_AI_DIAG_BASE_URL:-https://api.openai.com/v1}"

_uwe_ai_diag_key() {
  printf '%s' "${UWE_AI_DIAG_API_KEY:-}"
}

redact_sensitive_text() {
  local input="$1"
  printf '%s' "$input" | sed -E \
    -e 's/((DATABASE_URL|SECRET|TOKEN|API_KEY|PASSWORD|AUTH|COOKIE|PRIVATE_KEY|OPENAI_API_KEY)[^[:space:]]*=)[^[:space:]]+/\1[REDACTED]/gi' \
    -e 's/(Bearer[[:space:]]+)[A-Za-z0-9._-]+/\1[REDACTED]/g'
}

collect_diagnostic_context() {
  local step="$1"
  local error_msg="$2"
  local context=""

  context+="Install step: ${step}\n"
  context+="Error: ${error_msg}\n\n"

  if [[ -f /etc/os-release ]]; then
    context+="OS:\n$(grep -E '^(PRETTY_NAME|ID|VERSION_ID)=' /etc/os-release | tr -d '"')\n\n"
  fi

  context+="Architecture: $(dpkg --print-architecture 2>/dev/null || uname -m)\n\n"

  export_system_path
  context+="node: $(command -v node 2>/dev/null || echo missing) $(node --version 2>/dev/null || true)\n"
  context+="npm: $(command -v npm 2>/dev/null || echo missing) $(npm --version 2>/dev/null || true)\n"
  context+="pnpm: $(command -v pnpm 2>/dev/null || echo missing) $(pnpm --version 2>/dev/null || true)\n\n"

  if command -v systemctl >/dev/null 2>&1; then
    context+="systemctl status uwe (truncated):\n"
    context+="$(systemctl status uwe --no-pager -l 2>/dev/null | tail -n 25 || true)\n\n"
    context+="journalctl uwe (last 40 lines, redacted):\n"
    context+="$(journalctl -u uwe -n 40 --no-pager 2>/dev/null || true)\n"
  fi

  redact_sensitive_text "$context"
}

prompt_ai_consent() {
  if [[ "${UWE_AI_DIAG_ENABLED:-0}" == "1" ]]; then
    return 0
  fi

  if [[ ! -t 0 ]]; then
    return 1
  fi

  echo ""
  echo "Optionale AI-Diagnose verfügbar (deaktiviert by default)."
  echo "Es werden nur geschwärzte Logs gesendet — keine Secrets aus /etc/uwe/uwe.env."
  echo -n "AI-Diagnose starten? [y/N]: "
  local answer
  read -r answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

resolve_ai_api_key() {
  if [[ -n "${UWE_AI_DIAG_API_KEY:-}" ]]; then
    return 0
  fi

  if [[ -t 0 ]]; then
    echo -n "API-Key für ${UWE_AI_DIAG_PROVIDER} (wird nicht geloggt): "
    read -rs UWE_AI_DIAG_API_KEY
    echo ""
  fi

  [[ -n "${UWE_AI_DIAG_API_KEY:-}" ]]
}

call_ai_diagnostics_api() {
  local prompt="$1"
  local payload response
  local api_url="${UWE_AI_DIAG_BASE_URL%/}/chat/completions"

  payload="$(python3 - <<'PY' "$prompt" "$UWE_AI_DIAG_MODEL"
import json, sys
prompt, model = sys.argv[1], sys.argv[2]
print(json.dumps({
    "model": model,
    "messages": [
        {"role": "system", "content": "You are a Linux DevOps assistant helping diagnose UWE self-hosted installation failures. Be concise, actionable, and safe. Never ask for secrets."},
        {"role": "user", "content": prompt},
    ],
    "temperature": 0.2,
}))
PY
)"

  response="$(curl -fsS --max-time 60 \
    -H "Authorization: Bearer $(_uwe_ai_diag_key)" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$api_url" 2>/dev/null || true)"

  if [[ -z "$response" ]]; then
    warn "AI-Diagnose: API-Aufruf fehlgeschlagen (keine Antwort)."
    return 1
  fi

  python3 - <<'PY' "$response"
import json, sys
try:
    data = json.loads(sys.argv[1])
    content = data["choices"][0]["message"]["content"]
    print(content.strip())
except Exception as exc:
    print(f"AI response parse error: {exc}", file=sys.stderr)
    sys.exit(1)
PY
}

save_ai_diagnostic_report() {
  local step="$1"
  local report="$2"
  local timestamp outfile

  timestamp="$(date +%Y%m%d-%H%M%S)"
  install -d -m 750 -o root -g "$SERVICE_GROUP" "$UWE_DIAG_DIR" 2>/dev/null || install -d -m 755 "$UWE_DIAG_DIR"
  outfile="${UWE_DIAG_DIR}/${timestamp}-${step}.md"

  {
    echo "# UWE AI Diagnostic Report"
    echo ""
    echo "- Timestamp: $(date -Iseconds)"
    echo "- Step: $step"
    echo ""
    echo "$report"
  } >"$outfile"

  ok "AI-Diagnose gespeichert: $outfile"
}

uwe_ai_diagnostics_offer() {
  local step="${1:-unknown}"
  local error_msg="${2:-unknown error}"

  if ! prompt_ai_consent; then
    return 0
  fi

  if ! resolve_ai_api_key; then
    warn "AI-Diagnose übersprungen — kein API-Key."
    return 0
  fi

  log "Starte optionale AI-Diagnose …"
  local context prompt result
  context="$(collect_diagnostic_context "$step" "$error_msg")"
  prompt="Analyze this UWE Linux host setup failure and suggest concrete fix steps.\n\n${context}"

  if result="$(call_ai_diagnostics_api "$prompt")"; then
    echo ""
    echo "========================================"
    echo " AI Diagnose"
    echo "========================================"
    echo "$result"
    echo "========================================"
    save_ai_diagnostic_report "$step" "$result"
  else
    warn "AI-Diagnose fehlgeschlagen — Setup wird dadurch nicht blockiert."
  fi
}
