#!/usr/bin/env bash
# Preflight / doctor checks for UWE Linux host setup.
# shellcheck shell=bash

run_preflight() {
  local readonly="${1:-0}"
  echo ""
  echo "========================================"
  echo " UWE Preflight / Doctor"
  echo "========================================"
  echo ""

  preflight_check_os
  preflight_check_arch
  preflight_check_user
  preflight_check_sudo
  preflight_check_repo
  preflight_check_git
  preflight_check_disk
  preflight_check_ram
  preflight_check_network
  preflight_check_apt
  preflight_check_tool curl
  preflight_check_tool ca-certificates
  preflight_check_tool gnupg
  preflight_check_tool git
  preflight_check_node
  preflight_check_tool npm
  preflight_check_pnpm
  preflight_check_tool corepack
  preflight_check_systemd
  preflight_check_uwe_env
  preflight_check_uwe_home

  echo ""
  echo "========================================"
  echo " Preflight abgeschlossen"
  echo "========================================"
  echo ""

  if [[ "$readonly" -eq 1 ]]; then
    return 0
  fi
}

preflight_check_os() {
  if [[ -f /etc/os-release ]]; then
    local pretty
    pretty="$(grep '^PRETTY_NAME=' /etc/os-release | cut -d= -f2- | tr -d '"' || true)"
    ok "Betriebssystem: ${pretty:-$(. /etc/os-release; echo "$ID $VERSION_ID")}"
  else
    warn "Betriebssystem: /etc/os-release nicht gefunden"
  fi
}

preflight_check_arch() {
  if command -v dpkg >/dev/null 2>&1; then
    ok "Architektur: $(dpkg --print-architecture)"
  elif command -v uname >/dev/null 2>&1; then
    ok "Architektur: $(uname -m)"
  else
    warn "Architektur: unbekannt"
  fi
}

preflight_check_user() {
  ok "User: $(whoami) (uid=$(id -u))"
}

preflight_check_sudo() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    ok "Root/sudo: root"
  else
    fail "Root/sudo: nicht root — Script mit sudo ausführen"
  fi
}

preflight_check_repo() {
  if [[ -n "$UWE_HOME" && -f "$UWE_HOME/package.json" ]]; then
    ok "Repository: $UWE_HOME"
  else
    fail "Repository: nicht gefunden"
  fi
}

preflight_check_git() {
  if [[ ! -d "$UWE_HOME/.git" ]]; then
    warn "Git: kein Repository unter $UWE_HOME"
    return 0
  fi

  local branch commit
  branch="$(git -C "$UWE_HOME" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  commit="$(git -C "$UWE_HOME" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  ok "Git: Branch=$branch Commit=$commit"
}

preflight_check_disk() {
  if command -v df >/dev/null 2>&1; then
    local avail
    avail="$(df -h "$UWE_HOME" 2>/dev/null | awk 'NR==2 {print $4}' || echo unknown)"
    if [[ "$avail" == "unknown" ]]; then
      warn "Disk Space: unbekannt"
    else
      ok "Disk Space (frei auf $UWE_HOME): $avail"
    fi
  fi
}

preflight_check_ram() {
  if [[ -r /proc/meminfo ]]; then
    local total_kb total_mb
    total_kb="$(grep '^MemTotal:' /proc/meminfo | awk '{print $2}')"
    total_mb=$((total_kb / 1024))
    ok "RAM: ${total_mb} MiB"
  else
    warn "RAM: unbekannt"
  fi
}

preflight_check_network() {
  local host
  for host in github.com deb.nodesource.com registry.npmjs.org; do
    if getent hosts "$host" >/dev/null 2>&1 || host "$host" >/dev/null 2>&1; then
      ok "DNS: $host erreichbar"
    else
      warn "DNS: $host nicht auflösbar"
    fi
  done
}

preflight_check_apt() {
  if command -v apt-get >/dev/null 2>&1; then
    ok "apt: verfügbar"
  else
    fail "apt: nicht verfügbar — Debian/Ubuntu erforderlich"
  fi
}

preflight_check_tool() {
  local tool="$1"
  if command -v "$tool" >/dev/null 2>&1; then
    ok "$tool: verfügbar ($(command -v "$tool"))"
  elif dpkg -s "$tool" >/dev/null 2>&1; then
    ok "$tool: installiert (Paket)"
  else
    fix "$tool: fehlt — wird installiert"
  fi
}

preflight_check_node() {
  export_system_path
  local node_bin major version
  node_bin="$(find_node_binary)"

  if [[ -z "$node_bin" ]]; then
    fix "node: nicht gefunden — Node.js ${NODE_MAJOR}.x wird installiert"
    return 0
  fi

  version="$("$node_bin" --version 2>/dev/null || echo unknown)"
  major="${version#v}"
  major="${major%%.*}"

  if [[ "$major" == "$NODE_MAJOR" ]]; then
    ok "node: $version ($node_bin)"
    if [[ "$node_bin" == "/usr/bin/node" ]]; then
      ok "node systemd-Pfad: /usr/bin/node"
    else
      warn "node: nicht unter /usr/bin/node ($node_bin) — systemd kann Probleme haben"
    fi
  else
    fix "node: $version — erwartet v${NODE_MAJOR}.x, wird repariert"
  fi
}

preflight_check_pnpm() {
  export_system_path
  local pnpm_bin required version
  pnpm_bin="$(find_pnpm_binary)"
  required="$(get_required_pnpm_version)"

  if [[ -z "$pnpm_bin" ]]; then
    fix "pnpm: nicht gefunden — wird installiert (Ziel: $required)"
    return 0
  fi

  version="$("$pnpm_bin" --version 2>/dev/null || echo unknown)"
  if [[ "$version" == "$required" ]]; then
    ok "pnpm: $version ($pnpm_bin)"
  else
    fix "pnpm: $version — erwartet $required, wird repariert"
  fi
}

preflight_check_systemd() {
  if command -v systemctl >/dev/null 2>&1; then
    ok "systemd: verfügbar"
    if systemctl list-unit-files "$SYSTEMD_UNIT" >/dev/null 2>&1; then
      local state enabled
      state="$(systemctl is-active "$SYSTEMD_UNIT" 2>/dev/null || echo inactive)"
      enabled="$(systemctl is-enabled "$SYSTEMD_UNIT" 2>/dev/null || echo disabled)"
      ok "uwe.service: state=$state enabled=$enabled"
    else
      fix "uwe.service: Unit fehlt — wird angelegt"
    fi
  else
    fail "systemd: nicht verfügbar"
  fi
}

preflight_check_uwe_env() {
  if [[ -f "$UWE_ENV_FILE" ]]; then
    ok "UWE_ENV: $UWE_ENV_FILE vorhanden"
  else
    fix "UWE_ENV: $UWE_ENV_FILE fehlt — wird angelegt"
  fi
}

preflight_check_uwe_home() {
  if [[ -d "$DEFAULT_UWE_HOME" ]]; then
    ok "UWE_HOME: $DEFAULT_UWE_HOME vorhanden"
  elif [[ -n "$UWE_HOME" ]]; then
    ok "UWE_HOME: $UWE_HOME (nicht $DEFAULT_UWE_HOME)"
  else
    fix "UWE_HOME: $DEFAULT_UWE_HOME fehlt"
  fi
}
