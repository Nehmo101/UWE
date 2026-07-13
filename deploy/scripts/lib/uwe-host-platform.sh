#!/usr/bin/env bash
# OS detection, package management, firewall and SELinux helpers for UWE hosts.
# shellcheck shell=bash

UWE_OS_RELEASE_FILE="${UWE_OS_RELEASE_FILE:-/etc/os-release}"
UWE_OS_ID="${UWE_OS_ID:-unknown}"
UWE_OS_ID_LIKE="${UWE_OS_ID_LIKE:-}"
UWE_OS_VERSION_ID="${UWE_OS_VERSION_ID:-unknown}"
UWE_OS_PRETTY_NAME="${UWE_OS_PRETTY_NAME:-Unknown Linux}"
UWE_PACKAGE_FAMILY="${UWE_PACKAGE_FAMILY:-unknown}"

detect_host_platform() {
  local ID="" ID_LIKE="" VERSION_ID="" PRETTY_NAME=""

  if [[ ! -r "$UWE_OS_RELEASE_FILE" ]]; then
    UWE_OS_ID="unknown"
    UWE_PACKAGE_FAMILY="unknown"
    return 1
  fi

  # /etc/os-release is the distribution-owned machine-readable source of truth.
  # shellcheck disable=SC1090
  source "$UWE_OS_RELEASE_FILE"

  UWE_OS_ID="${ID:-unknown}"
  UWE_OS_ID_LIKE="${ID_LIKE:-}"
  UWE_OS_VERSION_ID="${VERSION_ID:-unknown}"
  UWE_OS_PRETTY_NAME="${PRETTY_NAME:-$UWE_OS_ID $UWE_OS_VERSION_ID}"

  case "$UWE_OS_ID" in
    debian | ubuntu)
      UWE_PACKAGE_FAMILY="apt"
      ;;
    fedora)
      UWE_PACKAGE_FAMILY="dnf"
      ;;
    *)
      UWE_PACKAGE_FAMILY="unknown"
      return 1
      ;;
  esac
}

require_supported_host_platform() {
  case "$UWE_PACKAGE_FAMILY" in
    apt)
      require_command apt-get "Unterstützt werden Debian, Ubuntu und Fedora."
      require_command dpkg "dpkg wird für Debian/Ubuntu benötigt."
      ;;
    dnf)
      require_command dnf "dnf wird für Fedora benötigt."
      require_command rpm "rpm wird für Fedora benötigt."
      ;;
    *)
      die "Nicht unterstütztes Linux: ${UWE_OS_PRETTY_NAME}. Unterstützt werden Debian, Ubuntu und Fedora."
      ;;
  esac
}

host_architecture() {
  case "$UWE_PACKAGE_FAMILY" in
    apt) dpkg --print-architecture 2>/dev/null || uname -m ;;
    dnf) rpm --eval '%{_arch}' 2>/dev/null || uname -m ;;
    *) uname -m ;;
  esac
}

host_package_installed() {
  local package="$1"
  case "$UWE_PACKAGE_FAMILY" in
    apt) dpkg -s "$package" >/dev/null 2>&1 ;;
    dnf) rpm -q "$package" >/dev/null 2>&1 ;;
    *) return 1 ;;
  esac
}

host_package_manager_name() {
  case "$UWE_PACKAGE_FAMILY" in
    apt) printf '%s\n' "apt-get" ;;
    dnf) printf '%s\n' "dnf" ;;
    *) printf '%s\n' "unknown" ;;
  esac
}

host_dependency_dns_name() {
  case "$UWE_PACKAGE_FAMILY" in
    apt) printf '%s\n' "deb.nodesource.com" ;;
    dnf) printf '%s\n' "mirrors.fedoraproject.org" ;;
    *) printf '%s\n' "registry.npmjs.org" ;;
  esac
}

host_base_packages() {
  case "$UWE_PACKAGE_FAMILY" in
    apt)
      printf '%s\n' \
        ca-certificates curl gnupg git iproute2 openssl sqlite3 \
        build-essential python3 apt-transport-https sudo util-linux
      ;;
    dnf)
      printf '%s\n' \
        ca-certificates curl gnupg2 git iproute openssl sqlite \
        gcc-c++ make python3 sudo util-linux shadow-utils findutils hostname \
        firewalld policycoreutils dnf5-plugins dnf5-plugin-automatic
      ;;
    *)
      return 1
      ;;
  esac
}

ensure_host_packages() {
  local packages=("$@")
  local missing=()
  local package

  for package in "${packages[@]}"; do
    if ! host_package_installed "$package"; then
      missing+=("$package")
    fi
  done

  if [[ ${#missing[@]} -eq 0 ]]; then
    return 0
  fi

  case "$UWE_PACKAGE_FAMILY" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      log "Installiere APT-Pakete: ${missing[*]}"
      apt-get update 2>&1 | tee "$UWE_PACKAGE_UPDATE_LOG"
      apt-get install -y "${missing[@]}"
      ;;
    dnf)
      log "Installiere DNF-Pakete: ${missing[*]}"
      dnf install -y "${missing[@]}" 2>&1 | tee "$UWE_PACKAGE_UPDATE_LOG"
      ;;
    *)
      die "Kein unterstützter Paketmanager erkannt."
      ;;
  esac
}

ensure_base_system_packages() {
  local packages=()
  mapfile -t packages < <(host_base_packages)
  ensure_host_packages "${packages[@]}"
}

remove_managed_node_packages() {
  case "$UWE_PACKAGE_FAMILY" in
    apt)
      apt-get remove -y nodejs npm 2>/dev/null || true
      apt-get purge -y nodejs npm 2>/dev/null || true
      apt-get autoremove -y || true
      ;;
    dnf)
      dnf remove -y \
        nodejs nodejs-npm nodejs22 nodejs22-bin nodejs22-npm nodejs22-npm-bin \
        2>/dev/null || true
      ;;
  esac
}

configure_firewalld() {
  if ! command -v firewall-cmd >/dev/null 2>&1; then
    return 1
  fi
  if ! firewall-cmd --state >/dev/null 2>&1; then
    return 1
  fi

  local zone="${UWE_FIREWALL_ZONE:-}"
  if [[ -z "$zone" ]]; then
    zone="$(firewall-cmd --get-default-zone)"
  fi

  log "Firewalld ist aktiv — erlaube UWE in Zone $zone (Ports ${STUDIO_PORT}/${PORTAL_PORT} tcp) …"
  local port
  for port in "$STUDIO_PORT" "$PORTAL_PORT"; do
    firewall-cmd --quiet --zone="$zone" --query-port="${port}/tcp" || \
      firewall-cmd --zone="$zone" --add-port="${port}/tcp"
    firewall-cmd --quiet --permanent --zone="$zone" --query-port="${port}/tcp" || \
      firewall-cmd --permanent --zone="$zone" --add-port="${port}/tcp"
  done
  ok "Firewalld-Regeln sind zur Laufzeit und dauerhaft gesetzt."
}

configure_ufw() {
  if ! command -v ufw >/dev/null 2>&1; then
    return 1
  fi
  if ! ufw status 2>/dev/null | grep -qi 'Status: active'; then
    return 1
  fi

  log "UFW ist aktiv — erlaube Port ${STUDIO_PORT}/tcp und ${PORTAL_PORT}/tcp …"
  ufw allow "${STUDIO_PORT}/tcp" >/dev/null 2>&1 || ufw allow "${STUDIO_PORT}/tcp"
  ufw allow "${PORTAL_PORT}/tcp" >/dev/null 2>&1 || ufw allow "${PORTAL_PORT}/tcp"
}

configure_firewall() {
  if configure_firewalld; then
    return 0
  fi
  if configure_ufw; then
    return 0
  fi
  ok "Keine aktive Firewalld-/UFW-Instanz — Firewall-Regeln unverändert."
}

restore_selinux_contexts() {
  if ! command -v selinuxenabled >/dev/null 2>&1 || ! selinuxenabled; then
    return 0
  fi
  if ! command -v restorecon >/dev/null 2>&1; then
    warn "SELinux ist aktiv, aber restorecon fehlt (Paket policycoreutils)."
    return 0
  fi

  log "Stelle SELinux-Standardkontexte für UWE-Pfade wieder her …"
  restorecon -RF "$UWE_HOME" "$UWE_ENV_DIR" "$UWE_DATA_DIR" "$UWE_LOG_DIR" "$UWE_BACKUP_DIR" \
    /etc/systemd/system/uwe*.service /etc/systemd/system/uwe*.timer 2>/dev/null || true
  ok "SELinux bleibt aktiv; Standardkontexte wurden angewendet."
}
