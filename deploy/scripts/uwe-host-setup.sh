#!/usr/bin/env bash
# Convenience wrapper — see setup-uwe-host.sh for implementation.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/setup-uwe-host.sh" "$@"
