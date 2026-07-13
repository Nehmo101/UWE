#!/usr/bin/env bash
# Lightweight Fedora container smoke for host-platform selection and package names.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# shellcheck source=lib/uwe-host-common.sh
source "$LIB_DIR/uwe-host-common.sh"
# shellcheck source=lib/uwe-host-platform.sh
source "$LIB_DIR/uwe-host-platform.sh"

assert_equal() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "[FAIL] $label: expected=$expected actual=$actual" >&2
    exit 1
  fi
}

detect_host_platform
assert_equal "fedora" "$UWE_OS_ID" "os-release ID"
assert_equal "dnf" "$UWE_PACKAGE_FAMILY" "package family"
assert_equal "dnf" "$(host_package_manager_name)" "package manager"

command -v dnf >/dev/null
command -v rpm >/dev/null

mapfile -t base_packages < <(host_base_packages)
array_contains() {
  local expected="$1"
  shift
  local item

  for item in "$@"; do
    if [[ "$item" == "$expected" ]]; then
      return 0
    fi
  done

  return 1
}
for required in gcc-c++ make sqlite iproute gnupg2 firewalld policycoreutils dnf5-plugins dnf5-plugin-automatic; do
  if ! array_contains "$required" "${base_packages[@]}"; then
    echo "[FAIL] Fedora base package mapping misses $required" >&2
    exit 1
  fi
done

# Resolve the exact Fedora 44 Node.js packages without mutating the container.
dnf --quiet list --available \
  nodejs22 nodejs22-npm nodejs22-bin nodejs22-npm-bin \
  dnf5-plugins dnf5-plugin-automatic >/dev/null

for script in \
  "$SCRIPT_DIR/setup-uwe-host.sh" \
  "$SCRIPT_DIR/fedora-host-smoke.sh" \
  "$LIB_DIR/uwe-host-common.sh" \
  "$LIB_DIR/uwe-host-platform.sh" \
  "$LIB_DIR/uwe-host-preflight.sh" \
  "$LIB_DIR/uwe-host-deps.sh" \
  "$LIB_DIR/uwe-host-connector-install.sh"; do
  bash -n "$script"
done

grep -q 'ConditionPathExists=/opt/uwe/tools/uwe-rtx-connector/.env' \
  "$SCRIPT_DIR/../systemd/uwe-rtx-connector.service"

echo "[OK] Fedora host smoke passed (${UWE_OS_PRETTY_NAME}, $(host_architecture))."
