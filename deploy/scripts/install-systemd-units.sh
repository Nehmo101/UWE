#!/usr/bin/env bash
# Einmaliges Bootstrap: installiert ALLE UWE systemd-Units/Timer nach
# /etc/systemd/system und aktiviert die Timer. Danach wird alles Laufende (Backup,
# Briefing, Healthcheck …) aus UWE gesteuert — siehe docs/engineering/self-service-config.md.
#
# Nutzung:  sudo /opt/uwe/deploy/scripts/install-systemd-units.sh
set -euo pipefail

UWE_HOME="${UWE_HOME:-/opt/uwe}"
SRC_DIR="${UWE_HOME}/deploy/systemd"
DEST_DIR="/etc/systemd/system"

if [[ $EUID -ne 0 ]]; then
  echo "Bitte als root ausführen: sudo $0" >&2
  exit 1
fi

if [[ ! -d "$SRC_DIR" ]]; then
  echo "systemd-Quellverzeichnis nicht gefunden: $SRC_DIR" >&2
  exit 1
fi

echo "Installiere UWE systemd-Units aus $SRC_DIR → $DEST_DIR"
installed=()
for unit in "$SRC_DIR"/*.service "$SRC_DIR"/*.timer; do
  [[ -e "$unit" ]] || continue
  install -m 0644 "$unit" "$DEST_DIR/"
  installed+=("$(basename "$unit")")
  echo "  + $(basename "$unit")"
done

systemctl daemon-reload

# Hauptdienst: Boot-Persistenz sicherstellen (Start bleibt Deploy-/manuell-gesteuert).
if [[ -f "$DEST_DIR/uwe.service" ]]; then
  systemctl enable uwe.service || true
fi

# Alle Timer aktivieren + starten — sie planen nur; die eigentliche Logik gaten
# die jeweiligen Skripte über die aus UWE gesyncten Konfig-Dateien.
for unit in "${installed[@]}"; do
  if [[ "$unit" == *.timer ]]; then
    systemctl enable --now "$unit"
    echo "  ✓ aktiviert: $unit"
  fi
done

echo
echo "Aktive UWE-Timer:"
systemctl list-timers --all | grep -E "uwe-" || true
