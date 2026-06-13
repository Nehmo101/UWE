# Backup & Restore

Anleitung für Backups unter Windows (und allgemein).

## Was wird gesichert?

| Inhalt | Enthalten |
|--------|-----------|
| Welten & Kampagnen | Ja |
| Seiten & Inhalte | Ja |
| Uploads / Medien | Ja |
| Label-Templates | Ja |
| Soundboard | Ja |
| Benutzer-Auth-Sessions | Nein |
| Secrets / Tokens | Nein (automatisch ausgeschlossen) |

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
