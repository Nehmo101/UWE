# UWE unter Windows installieren (One-Click)

Diese Anleitung richtet sich an **normale Windows-Nutzer** — ohne Terminal-Kenntnisse.

## Schnellstart

1. **Node.js 20+** installieren (falls noch nicht vorhanden): https://nodejs.org/
2. UWE herunterladen oder Repository klonen
3. **`UWE-Installieren.cmd`** doppelklicken **oder** den Installations-Assistenten starten:

```powershell
pnpm installer:windows
```

4. Im Assistenten auf **„Installieren & Starten“** klicken
5. UWE öffnet sich automatisch im Browser
6. Desktop-Verknüpfung **„UWE starten“** verwenden

## Was der Assistent automatisch erledigt

| Schritt | Beschreibung |
|---------|--------------|
| Voraussetzungen | Windows 10+, Node.js, pnpm, freie Ports, Schreibrechte |
| pnpm PATH | Repariert automatisch den häufigen Fehler „global bin directory not in PATH“ |
| Installation | Kopiert UWE nach `%LOCALAPPDATA%\UWE` |
| Build | Erstellt die Produktions-Builds für Studio und Portal |
| Datenbank | Führt Migrationen aus, optional Demo-Welt |
| Konfiguration | Erstellt `.env` mit sicherem `AUTH_SECRET` |
| Verknüpfungen | Desktop + Startmenü |
| Start | Startet UWE im Hintergrund, Browser öffnet sich |

## Installationsordner

Standard: `%LOCALAPPDATA%\UWE`

```
%LOCALAPPDATA%\UWE\
  .env                 ← Konfiguration (Secrets — nicht teilen!)
  app\                 ← UWE-Anwendung
  data\
    uwe.db             ← Datenbank (Welten, Kampagnen)
    uploads\           ← Bilder, Audio, Karten
    backups\           ← Backups
  logs\                ← Installations- und Laufzeit-Logs
  config\              ← Launcher, Steuerung
```

## Nach der Installation

| Aktion | So geht's |
|--------|-----------|
| **UWE starten** | Desktop-Verknüpfung „UWE starten“ |
| **Steuerung** | Desktop-Verknüpfung „UWE Steuerung“ oder Startmenü |
| **Logs anzeigen** | In der Steuerung: „Logs öffnen“ |
| **Backup** | Steuerung → „Backup erstellen“ |
| **Update** | Steuerung → „Update prüfen“ |
| **Deinstallieren** | Steuerung → „Deinstallieren“ (Daten optional behalten) |

## Demo-Welt

Im Assistenten kann optional die **Demo-Welt Terra** installiert werden (Beispielinhalte).

Login: `dm@uwe.local` / `uwe-dev`

## Sicherheit

- UWE läuft standardmäßig nur auf **localhost** (`127.0.0.1`)
- **Kein öffentliches Binding** ohne manuelle Konfiguration
- Warnung bei Netzwerkzugriff: UWE hat kein echtes DM-Login — nur hinter Reverse-Proxy/VPN sicher öffentlich nutzbar
- Windows-Firewall: UWE erstellt **keine** Firewall-Regel automatisch

## Für Entwickler

Entwickler können weiterhin wie gewohnt arbeiten:

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

Windows-Entwickler-Modus:

```powershell
.\scripts\windows\uwe-launcher.ps1 -Action install -Mode dev -RepoPath .
```

Weitere Details: [WINDOWS_INSTALLER.md](WINDOWS_INSTALLER.md) · [windows-troubleshooting.md](windows-troubleshooting.md)
