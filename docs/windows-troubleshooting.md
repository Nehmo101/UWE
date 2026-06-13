# Windows — Fehlerbehebung

Kurze Hilfe bei häufigen Problemen mit dem UWE Windows-Installer.

## Diagnose-Tools

| Tool | Befehl / Aktion |
|------|-----------------|
| Doctor | `pnpm doctor` oder Steuerung → „Diagnose“ |
| Reparatur | `pnpm repair` oder Steuerung → „Reparieren“ |
| Diagnosepaket | Steuerung → „Diagnosepaket“ (ZIP ohne Secrets) |
| Logs | `%LOCALAPPDATA%\UWE\logs\` |

## Häufige Probleme

### Node.js fehlt oder ist zu alt

**Symptom:** „Node.js 20+ is required“

**Lösung:**
1. Node.js 20 oder neuer von https://nodejs.org/ installieren
2. PC oder Terminal neu starten
3. Assistent erneut starten

### pnpm fehlt

**Symptom:** „pnpm is required“

**Lösung:** Der Assistent installiert pnpm automatisch. Alternativ:

```powershell
corepack enable
corepack prepare pnpm@10.12.1 --activate
```

Oder: `node tools/windows-installer/dist/cli.js install-pnpm`

### pnpm PATH-Fehler

**Symptom:**
```
The configured global bin directory C:\Users\<user>\AppData\Local\pnpm is not in PATH
```

**Lösung:** Automatisch durch Assistent oder:

```powershell
node tools/windows-installer/dist/cli.js repair-pnpm-path
```

Danach Terminal/Wizard **schließen und neu starten**.

### Port bereits belegt

**Symptom:** „Required ports are already in use: 3000, 3001“

**Lösung:**
1. Andere Anwendung beenden (z. B. anderer Dev-Server)
2. Prüfen: `netstat -ano | findstr :3000`
3. Prozess beenden oder Ports in `.env` ändern (`STUDIO_PORT`, `PORTAL_PORT`)

### UWE startet nicht

**Symptom:** Verknüpfung reagiert, Browser bleibt leer

**Lösung:**
1. Steuerung öffnen → Status prüfen
2. `pnpm doctor` ausführen
3. Logs prüfen: `%LOCALAPPDATA%\UWE\logs\studio.log`
4. Reparatur: `pnpm repair`

### Build fehlt

**Symptom:** „Production build is missing“

**Lösung:** `pnpm repair` (führt Build erneut aus)

### Migration fehlgeschlagen

**Symptom:** Fehler bei Installation/Update

**Lösung:**
1. Logs prüfen
2. Pre-Migration-Backup liegt in `data\backups\pre-migration-*.db`
3. `pnpm repair` ausführen

### Beschädigte Konfiguration

**Symptom:** UWE startet, aber Fehler bei Spotify/Auth

**Lösung:**
- `pnpm repair` (regeneriert `.env`, behält `AUTH_SECRET` bei Updates)
- Bei komplett kaputter Config: Backup wiederherstellen

### Windows Defender / SmartScreen

Beim ersten Start kann Windows eine Warnung anzeigen (nicht signierte EXE).

**Lösung:** „Weitere Informationen“ → „Trotzdem ausführen“ (nur bei vertrauenswürdiger Quelle)

## Deinstallation

**Mit Daten behalten:** Steuerung → Deinstallieren → „Ja“ bei „Daten behalten?“

**Komplett löschen:** Steuerung → Deinstallieren → „Nein“

Manuell:
1. UWE stoppen
2. `%LOCALAPPDATA%\UWE` löschen (optional nur `app\`, `config\`, `logs\` behalten für Daten)
3. Desktop-Verknüpfungen löschen

## Support-Informationen sammeln

1. Steuerung → „Diagnosepaket“
2. ZIP enthält: Systeminfo, Doctor-Report, Logs (ohne Secrets)
3. ZIP an Support senden — **niemals** die `.env`-Datei im Klartext teilen
