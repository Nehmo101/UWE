# Windows Installer — Manuelle Test-Checkliste

Checkliste für QA des One-Click-Install-Wizards.

## Voraussetzungen

- [ ] Windows 10 oder 11 (64-bit)
- [ ] Test-VM oder sauberer Test-User empfohlen

## Testszenarien

### Frische Installation

- [ ] `UWE-Installieren.cmd` oder `pnpm installer:windows` startet Wizard
- [ ] Systemcheck zeigt grüne/erfolgreiche Meldungen
- [ ] Installation schließt ohne Fehler ab
- [ ] Desktop-Verknüpfung „UWE starten“ vorhanden
- [ ] Browser öffnet http://localhost:3000
- [ ] Portal erreichbar auf http://localhost:3001
- [ ] `%LOCALAPPDATA%\UWE\logs\install.log` vorhanden

### Fehlendes Node.js

- [ ] Wizard erkennt fehlendes Node.js
- [ ] Verständliche Meldung + Link zu nodejs.org
- [ ] Kein kryptischer Terminal-Absturz

### Fehlendes pnpm

- [ ] Wizard/CLI erkennt fehlendes pnpm
- [ ] `install-pnpm` repariert automatisch
- [ ] Installation danach erfolgreich

### pnpm PATH-Fehler

- [ ] Simulieren: pnpm installiert, aber nicht im PATH
- [ ] `repair-pnpm-path` fügt `%LOCALAPPDATA%\pnpm` hinzu
- [ ] Wizard zeigt Hinweis zum Neustart
- [ ] Nach Neustart: Installation erfolgreich

### Port belegt

- [ ] Anderen Dienst auf :3000 starten
- [ ] Wizard zeigt verständliche Fehlermeldung
- [ ] Kein stilles Scheitern

### Update mit bestehender Welt

- [ ] UWE installieren + Demo-Welt nutzen
- [ ] Update auslösen (`update` oder Re-Install mit `--upgrade`)
- [ ] Welten/Daten noch vorhanden
- [ ] Pre-Update-Snapshot in `data\backups\`

### Backup / Restore

- [ ] Backup über Steuerung erstellen
- [ ] UWE stoppen, Restore aus Backup
- [ ] Daten wiederhergestellt
- [ ] Pre-Restore-Backup automatisch erstellt

### Deinstallation

- [ ] **Daten behalten:** `app\` weg, `data\` vorhanden
- [ ] **Daten löschen:** gesamter `%LOCALAPPDATA%\UWE` Ordner weg
- [ ] Verknüpfungen entfernt

### Beschädigte Config

- [ ] `.env` löschen oder beschädigen
- [ ] `pnpm repair` regeneriert Config
- [ ] UWE startet wieder

### Fehlende Datenbank

- [ ] `uwe.db` löschen
- [ ] `pnpm repair` führt Migration aus
- [ ] UWE startet (ggf. leer oder mit Demo nach Seed)

### Diagnosepaket

- [ ] Diagnosepaket erstellen
- [ ] ZIP enthält Logs, Systeminfo, Doctor-Report
- [ ] Keine Secrets im Klartext (AUTH_SECRET redacted)

### Developer-Workflow

- [ ] `pnpm install` funktioniert
- [ ] `pnpm dev` funktioniert
- [ ] `pnpm build` funktioniert
- [ ] `pnpm test` funktioniert

## CLI-Befehle zum Testen

```powershell
node tools\windows-installer\dist\cli.js check
node tools\windows-installer\dist\cli.js doctor
node tools\windows-installer\dist\cli.js repair --fix-all
node tools\windows-installer\dist\cli.js backup
node tools\windows-installer\dist\cli.js diagnostics
node tools\windows-installer\dist\cli.js status
```

## Bekannte Einschränkungen

- Node.js muss vom Nutzer installiert werden (noch nicht gebündelt)
- Nach PATH-Reparatur ggf. Wizard/Terminal neu starten
- Inno Setup EXE erfordert Build auf Windows mit ISCC installiert
- Firewall-Regel wird nicht automatisch erstellt (Sicherheit)
