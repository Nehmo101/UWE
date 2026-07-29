#!/usr/bin/env bash
# Install and conditionally start the optional outbound Maschinenraum service.
# The unit keeps its historical name uwe-rtx-connector.service on purpose.
# shellcheck shell=bash

readonly RTX_CONNECTOR_UNIT="uwe-rtx-connector.service"
readonly RTX_CONNECTOR_ENV_REL="tools/uwe-rtx-connector/.env"

connector_env_value() {
  local key="$1"
  local file="$2"
  local value

  value="$(sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" "$file" 2>/dev/null | tail -n 1)"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s\n' "$value"
}

rtx_connector_configured() {
  local env_file="$UWE_HOME/$RTX_CONNECTOR_ENV_REL"
  if [[ ! -f "$env_file" ]]; then
    return 1
  fi

  local host_url token
  host_url="$(connector_env_value UWE_HOST_URL "$env_file")"
  token="$(connector_env_value UWE_CONNECTOR_TOKEN "$env_file")"

  [[ "$host_url" =~ ^https?:// ]] && \
    [[ "$token" == uwec_* ]] && \
    [[ "$token" != *replace_me* ]]
}

install_rtx_connector_unit() {
  local source_unit="$UWE_HOME/deploy/systemd/$RTX_CONNECTOR_UNIT"
  local target_unit="/etc/systemd/system/$RTX_CONNECTOR_UNIT"
  local connector_data="$UWE_DATA_DIR/rtx-connector"

  if [[ ! -f "$source_unit" ]]; then
    die "Maschinenraum-Unit fehlt: $source_unit"
  fi

  install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$connector_data"

  # The checked-in unit documents the official /opt/uwe layout. Preserve custom
  # UWE_HOME support by substituting only that canonical path during install.
  local escaped_home temporary
  escaped_home="${UWE_HOME//&/\\&}"
  temporary="$(mktemp)"
  sed "s|/opt/uwe|${escaped_home}|g" "$source_unit" >"$temporary"
  install -m 0644 "$temporary" "$target_unit"
  rm -f "$temporary"
  systemctl daemon-reload

  if rtx_connector_configured; then
    systemctl enable "$RTX_CONNECTOR_UNIT"
    ok "$RTX_CONNECTOR_UNIT installiert und für den Boot aktiviert."
  elif systemctl is-enabled --quiet "$RTX_CONNECTOR_UNIT" 2>/dev/null; then
    systemctl disable --now "$RTX_CONNECTOR_UNIT"
    warn "$RTX_CONNECTOR_UNIT wegen unvollständiger Connector-.env deaktiviert."
  else
    systemctl stop "$RTX_CONNECTOR_UNIT" 2>/dev/null || true
    ok "$RTX_CONNECTOR_UNIT installiert, aber ohne gültige Connector-.env nicht aktiviert."
  fi
}

start_or_restart_rtx_connector() {
  if rtx_connector_configured; then
    systemctl reset-failed "$RTX_CONNECTOR_UNIT" 2>/dev/null || true
    systemctl restart "$RTX_CONNECTOR_UNIT"
    ok "$RTX_CONNECTOR_UNIT gestartet."
  elif systemctl is-enabled --quiet "$RTX_CONNECTOR_UNIT" 2>/dev/null; then
    warn "$RTX_CONNECTOR_UNIT ist aktiviert, aber $UWE_HOME/$RTX_CONNECTOR_ENV_REL ist unvollständig."
  fi
}
