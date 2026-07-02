# Backup & Restore

Anleitung für Backups auf dem **Linux Host** (und allgemein). Der frühere
Windows-Installer-Pfad existiert nicht mehr — siehe
[removed-legacy-runtime.md](./removed-legacy-runtime.md).

## Was wird gesichert?

| Inhalt | Enthalten | Restore |
|--------|-----------|---------|
| Welten & Kampagnen | Ja | Ja |
| Seiten & Inhalte | Ja | Ja |
| Uploads / Medien | Ja | Ja |
| Label-Templates | Ja | Ja |
| Soundboard | Ja | Ja |
| Welt-Mitgliedschaften & Spieler-Zugriffe | Ja (Stub-User ohne Passwort) | Ja |
| Session-Unlocks / Page-Player-Access | Ja | Ja |
| Custom Page-Templates (nicht System) | Ja (Full-Backup) | Ja |
| Daily Admin OS: Capture-Einträge (inkl. Upload-Dateien) | Ja (Full-Backup) | Ja |
| Daily Admin OS: Persönliche Projekte, Werkstatt (Projekte, Rezepte, Druckprofile, Vermietung) | Ja (Full-Backup) | Ja |
| Daily Admin OS: Verträge/Ausgaben, Hardware-Geräte, Admin-Verknüpfungen | Ja (Full-Backup) | Ja |
| Life Brain (Dokumente, Chunks inkl. Embeddings, Fakten) | Ja (Full-Backup) — bleibt lokal | Ja |
| Benutzer-Passwörter | Nein | Nein — wiederhergestellte User müssen Passwort setzen |
| Benutzer-Auth-Sessions | Nein | Nein |
| ShareLinks (Token/Passwort) | Ja (ohne Token/Passwort) | Ja — neue Tokens; Passwörter neu setzen |
| PlayerNotes | Opt-in (`includePlayerNotes`) | Ja (wenn exportiert) |
| Secrets / Tokens | Nein (automatisch ausgeschlossen) | — |

## Backup erstellen

### Über UWE Studio (empfohlen)

Studio → **Backup** → **Backup erstellen**. Das ZIP liegt im konfigurierten
Backup-Verzeichnis (Host: `/var/lib/uwe/backups`).

### Über die Kommandozeile

```bash
pnpm backup:create --type=full --format=zip
# PlayerNotes optional (Datenschutz beachten):
pnpm backup:create --type=full --include-player-notes
```

### Host-Backup-Script / Snapshot

Für eine schnelle Vollsicherung von DB + Uploads + Config auf dem Linux Host:

```bash
bash deploy/scripts/uwe-backup.sh
```

Auf dem Host läuft dies automatisch über `deploy/systemd/uwe-backup.timer`.

## Restore

### Über UWE Studio (empfohlen)

Studio → **Backup** → **Wiederherstellen**, Backup-ZIP auswählen.

### Manuell (Notfall, Linux Host)

1. Dienst stoppen: `sudo systemctl stop uwe.service`
2. `/var/lib/uwe/uwe.db` sichern
3. Backup-ZIP entpacken oder Snapshot kopieren
4. Dateien ersetzen
5. Dienst starten: `sudo systemctl start uwe.service`

## Automatische Backups

| Anlass | Speicherort |
|--------|-------------|
| Vor Migration | `/var/lib/uwe/backups/pre-migration-*.db` |
| Vor Update | `/var/lib/uwe/backups/snapshot-*` |
| Vor Restore | Automatisches Full-Backup |

## Update mit bestehenden Welten

Host-Updates (`setup-uwe-host.sh --quick` / `uwe-host-update.sh`) **behalten**
standardmäßig:
- `/var/lib/uwe` (Datenbank, Uploads, Backups)
- `/etc/uwe/uwe.env` (Konfiguration inkl. AUTH_SECRET)
- Exporte

Nur der Anwendungs-Code wird via `git pull` aktualisiert und neu gebaut.

## Sicherheit

- Backups enthalten **keine** AUTH_SECRET oder API-Tokens
- Diagnosepakete redigieren Secrets automatisch
- Backups lokal aufbewahren — nicht in Cloud-Ordner mit öffentlichem Zugriff legen
