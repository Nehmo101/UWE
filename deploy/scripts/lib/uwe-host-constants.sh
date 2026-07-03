#!/usr/bin/env bash
# Single source of truth for shared UWE host paths, ports and systemd unit names.
# Sourced by both the privileged setup machinery (deploy/scripts/lib/uwe-host-common.sh)
# and the unprivileged operator wrappers (scripts/uwe-host-lib.sh) so the literals
# below are defined exactly once and cannot drift between the two layers.
#
# These are DEFAULT values. Consumers decide their own semantics:
#   - the setup layer promotes them to `readonly` (fixed production paths)
#   - the operator layer keeps them overridable via `${VAR:-${UWE_DEFAULT_VAR}}`
# shellcheck shell=bash
# shellcheck disable=SC2034  # consumed by scripts that source this file

UWE_DEFAULT_ENV_DIR="/etc/uwe"
UWE_DEFAULT_ENV_FILE="/etc/uwe/uwe.env"
UWE_DEFAULT_DATA_DIR="/var/lib/uwe"
UWE_DEFAULT_LOG_DIR="/var/log/uwe"
UWE_DEFAULT_BACKUP_DIR="/var/backups/uwe"
UWE_DEFAULT_STUDIO_PORT="3000"
UWE_DEFAULT_PORTAL_PORT="3001"
UWE_DEFAULT_SYSTEMD_UNIT="uwe.service"
UWE_DEFAULT_LEGACY_SYSTEMD_UNIT="uwe-host.service"
