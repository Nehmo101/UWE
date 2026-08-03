#!/usr/bin/env bash
# Install and conditionally start the optional outbound Maschinenraum service.
# shellcheck shell=bash

readonly ENGINE_CONNECTOR_UNIT="uwe-engine-connector.service"
readonly ENGINE_CONNECTOR_ENV_REL="tools/uwe-engine-connector/.env"

# Namen vor dem Maschinenraum-Rebranding. Bleiben als Literale stehen, damit
# `migrate_legacy_engine_connector` Bestandshosts findet und aufräumt.
readonly LEGACY_CONNECTOR_UNIT="uwe-rtx-connector.service"
readonly LEGACY_CONNECTOR_ENV_REL="tools/uwe-rtx-connector/.env"

# Einmaliger Umzug eines Hosts, der noch unter dem RTX-Namen läuft.
#
# Drei Dinge tragen den alten Namen: die systemd-Unit, das State-Verzeichnis
# unter $UWE_DATA_DIR (Tokens, Modellprofile) und die nicht versionierte .env
# im alten Werkzeugordner. Ein `git pull` benennt nur die versionierten Pfade
# um — die .env bliebe als verwaiste Datei liegen und der Connector startete
# ohne Zugangsdaten.
#
# Alles nur, wenn das jeweilige Ziel noch nicht existiert: der Umzug darf bei
# jedem Setup-Lauf mitlaufen, ohne einen bereits migrierten Host anzufassen.
migrate_legacy_engine_connector() {
  local legacy_unit="/etc/systemd/system/$LEGACY_CONNECTOR_UNIT"
  local legacy_data="$UWE_DATA_DIR/rtx-connector"
  local target_data="$UWE_DATA_DIR/engine-connector"
  local legacy_env="$UWE_HOME/$LEGACY_CONNECTOR_ENV_REL"
  local target_env="$UWE_HOME/$ENGINE_CONNECTOR_ENV_REL"

  if [[ -f "$legacy_unit" ]]; then
    systemctl disable --now "$LEGACY_CONNECTOR_UNIT" 2>/dev/null || true
    rm -f "$legacy_unit"
    systemctl daemon-reload
    ok "$LEGACY_CONNECTOR_UNIT entfernt — ersetzt durch $ENGINE_CONNECTOR_UNIT."
  fi

  if [[ -d "$legacy_data" && ! -d "$target_data" ]]; then
    mv "$legacy_data" "$target_data"
    ok "Connector-Daten von $legacy_data nach $target_data übernommen."
  fi

  if [[ -f "$legacy_env" && ! -f "$target_env" ]]; then
    install -d -m 750 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$(dirname "$target_env")"
    mv "$legacy_env" "$target_env"
    ok "Connector-.env von $legacy_env nach $target_env übernommen."
  fi
}

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

engine_connector_configured() {
  local env_file="$UWE_HOME/$ENGINE_CONNECTOR_ENV_REL"
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

install_engine_connector_unit() {
  local source_unit="$UWE_HOME/deploy/systemd/$ENGINE_CONNECTOR_UNIT"
  local target_unit="/etc/systemd/system/$ENGINE_CONNECTOR_UNIT"
  local connector_data="$UWE_DATA_DIR/engine-connector"

  if [[ ! -f "$source_unit" ]]; then
    die "Maschinenraum-Unit fehlt: $source_unit"
  fi

  migrate_legacy_engine_connector

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

  if engine_connector_configured; then
    systemctl enable "$ENGINE_CONNECTOR_UNIT"
    ok "$ENGINE_CONNECTOR_UNIT installiert und für den Boot aktiviert."
  elif systemctl is-enabled --quiet "$ENGINE_CONNECTOR_UNIT" 2>/dev/null; then
    systemctl disable --now "$ENGINE_CONNECTOR_UNIT"
    warn "$ENGINE_CONNECTOR_UNIT wegen unvollständiger Connector-.env deaktiviert."
  else
    systemctl stop "$ENGINE_CONNECTOR_UNIT" 2>/dev/null || true
    ok "$ENGINE_CONNECTOR_UNIT installiert, aber ohne gültige Connector-.env nicht aktiviert."
  fi
}

start_or_restart_engine_connector() {
  if engine_connector_configured; then
    systemctl reset-failed "$ENGINE_CONNECTOR_UNIT" 2>/dev/null || true
    systemctl restart "$ENGINE_CONNECTOR_UNIT"
    ok "$ENGINE_CONNECTOR_UNIT gestartet."
  elif systemctl is-enabled --quiet "$ENGINE_CONNECTOR_UNIT" 2>/dev/null; then
    warn "$ENGINE_CONNECTOR_UNIT ist aktiviert, aber $UWE_HOME/$ENGINE_CONNECTOR_ENV_REL ist unvollständig."
  fi
}
