#!/usr/bin/env bash
# Nightly safety-net restart for long-running UWE host services.
set -euo pipefail

units=(
  uwe.service
  uwe-host-command-center.service
)

failed=0
for unit in "${units[@]}"; do
  systemctl reset-failed "$unit" 2>/dev/null || true
  if systemctl restart "$unit"; then
    echo "Nightly restart: $unit OK"
  else
    echo "Nightly restart: $unit FAILED" >&2
    failed=1
  fi
done

exit "$failed"
