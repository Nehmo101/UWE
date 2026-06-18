# Backup & Restore

Anleitung für Backups unter Windows (und allgemein).

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
| Benutzer-Passwörter | Nein | Nein — wiederhergestellte User müssen Passwort setzen |
| Benutzer-Auth-Sessions | Nein | Nein |
| ShareLinks (Token/Passwort) | Ja (ohne Token/Passwort) | Ja — neue Tokens; Passwörter neu setzen |
| PlayerNotes | Opt-in (`includePlayerNotes`) | Ja (wenn exportiert) |
| Secrets / Tokens | Nein (automatisch ausgeschlossen) | — |

## Backup erstellen

### Über die Steuerung (empfohlen)

1. „UWE Steuerung“ öffnen
2. **„Backup erstellen“** klicken
3. Backup liegt in `%LOCALAPPDATA%\UWE\data\backups\`

### Über die Kommandozeile

```bash
pnpm backup
# oder im Entwicklermodus:
pnpm backup:create --type=full --format=zip
# PlayerNotes optional (Datenschutz beachten):
pnpm backup:create --type=full --include-player-notes
```

### Snapshot (Rohdaten)

Für schnelle Vollsicherung von DB + Uploads + Config:

```bash
node tools/windows-installer/dist/cli.js snapshot
```

Ergebnis: `%LOCALAPPDATA%\UWE\data\backups\snapshot-<timestamp>\`

## Restore

### Über die Steuerung

1. UWE stoppen
2. Steuerung → Restore (oder CLI):
   ```powershell
   node tools\windows-installer\dist\cli.js restore --backup "C:\Pfad\zum\backup.zip"
   ```

### Über UWE Studio

Nach dem Start: Studio → Backup → Wiederherstellen

### Manuell (Notfall)

1. UWE stoppen
2. `%LOCALAPPDATA%\UWE\data\uwe.db` sichern
3. Backup-ZIP entpacken oder Snapshot kopieren
4. Dateien ersetzen
5. UWE starten

## Automatische Backups

| Anlass | Speicherort |
|--------|-------------|
| Vor Migration | `data\backups\pre-migration-*.db` |
| Vor Update | `data\backups\snapshot-*` |
| Vor Restore | Automatisches Full-Backup |

## Update mit bestehenden Welten

Updates **behalten** standardmäßig:
- `data\` (Datenbank, Uploads, Backups)
- `.env` (Konfiguration inkl. AUTH_SECRET)
- `exports\`

Nur `app\` wird ersetzt und neu gebaut.

## Sicherheit

- Backups enthalten **keine** AUTH_SECRET oder API-Tokens
- Diagnosepakete redigieren Secrets automatisch
- Backups lokal aufbewahren — nicht in Cloud-Ordner mit öffentlichem Zugriff legen
