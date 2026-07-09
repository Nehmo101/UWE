#!/usr/bin/env bash
# Install host-restart trigger script and sudoers drop-in.
# shellcheck shell=bash

install_host_restart_assets() {
  local trigger_script="$UWE_HOME/deploy/scripts/uwe-host-restart-trigger.sh"
  local sudoers_src="$UWE_HOME/deploy/sudoers/uwe-host-restart"

  if [[ ! -f "$trigger_script" ]]; then
    warn "Host-Restart-Trigger fehlt — überspringe Installation."
    return 0
  fi

  chmod +x "$trigger_script"

  if [[ -f "$sudoers_src" ]]; then
    local sudoers_dest="/etc/sudoers.d/uwe-host-restart"
    sed "s|/opt/uwe|${UWE_HOME}|g" "$sudoers_src" >"${sudoers_dest}.tmp"
    chmod 440 "${sudoers_dest}.tmp"
    if command -v visudo >/dev/null 2>&1; then
      if visudo -cf "${sudoers_dest}.tmp" >/dev/null 2>&1; then
        mv "${sudoers_dest}.tmp" "$sudoers_dest"
        ok "sudoers-Regel installiert: $sudoers_dest"
      else
        warn "sudoers-Validierung fehlgeschlagen — ${sudoers_dest}.tmp nicht aktiviert."
        rm -f "${sudoers_dest}.tmp"
      fi
    else
      mv "${sudoers_dest}.tmp" "$sudoers_dest"
      warn "visudo nicht verfügbar — sudoers manuell prüfen: $sudoers_dest"
    fi
  fi

  ok "Host-Restart-Trigger installiert: $trigger_script"
  ok "Aktivierung: UWE_HOST_RESTART_ENABLED=true in $UWE_ENV_FILE setzen."
}
