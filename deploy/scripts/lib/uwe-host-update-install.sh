#!/usr/bin/env bash
# Install host-update scripts, systemd unit, and sudoers drop-in.
# shellcheck shell=bash

install_host_update_assets() {
  local trigger_script="$UWE_HOME/deploy/scripts/uwe-host-update-trigger.sh"
  local update_script="$UWE_HOME/deploy/scripts/uwe-host-update.sh"
  local sudoers_src="$UWE_HOME/deploy/sudoers/uwe-host-update"
  local unit_path="/etc/systemd/system/uwe-host-update.service"

  if [[ ! -f "$update_script" || ! -f "$trigger_script" ]]; then
    warn "Host-Update-Skripte fehlen — überspringe Installation."
    return 0
  fi

  chmod +x "$update_script" "$trigger_script"

  log "Installiere uwe-host-update.service …"
  sed \
    -e "s|/opt/uwe|${UWE_HOME}|g" \
    -e "s|UWE_ENV=/etc/uwe/uwe.env|UWE_ENV=${UWE_ENV_FILE}|g" \
    "$UWE_HOME/deploy/systemd/uwe-host-update.service" >"$unit_path"

  if [[ -f "$sudoers_src" ]]; then
    local sudoers_dest="/etc/sudoers.d/uwe-host-update"
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

  systemctl daemon-reload || true
  ok "Host-Update-Unit installiert: $unit_path"
  ok "Aktivierung: UWE_HOST_UPDATE_ENABLED=true in $UWE_ENV_FILE setzen."
}
