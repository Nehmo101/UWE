# UWE Command Center

Das **UWE Command Center** ist die zentrale Desktop-Anlaufstation für ein
All-in-one-Setup: UWE Studio, UWE Portal, Datenhaltung und lokale RTX-Leistung
laufen auf demselben Windows-PC und werden aus einer Oberfläche bedient.

Der bisherige Produktname „UWE RTX Connector Client“ bleibt nur in internen
Paket-, Release- und Datenpfaden erhalten. Dadurch bleiben bestehende
Konfigurationen, Tokens, Modelle und Updater-Installationen kompatibel.

## Verantwortungsgrenzen

| Baustein | Verantwortung |
|---|---|
| Command-Center-UI | Status, Einrichtung, Start/Stopp, Neustart, Backup, Logs und RTX-Konfiguration |
| Desktop-Host-Steuerung | Ein idempotenter lokaler Orchestrator für Studio und Portal |
| UWE Studio | Source of Truth, Admin, Daten und Connector-Tokens |
| UWE Portal | Spieleransicht; weiterhin strikt player-safe |
| RTX Connector | Outbound-only Worker für Ollama, Audio, Bilder und lokale Geräte |

Es wird bewusst **kein zweiter lokaler Webserver** für das Command Center
gestartet. Die Tauri-App ruft dieselbe kleine Host-Steuerung auf, die auch ohne
UI diagnostiziert werden kann. Das reduziert Ports, Prozesse und Fehlerquellen.

## All-in-one-Ablauf

```text
UWE Command Center
  ├─ Einrichten/Reparieren → pnpm, Prisma, Migration, optional Seed, Release-Build
  ├─ Starten/Stoppen       → Studio/Portal auf den in .env festgelegten Ports
  ├─ Überwachen            → Healthchecks, Prozesse, CPU/RAM/Disk/GPU, Logs
  ├─ Sichern               → SQLite-Backup in AppData
  └─ RTX verbinden         → ausgehender Connector zum lokalen Studio
```

Das Command Center führt absichtlich **kein stilles** `git pull` aus. Updates
laufen nur über den expliziten Button **Nach Updates suchen** /
**Update installieren** (oder die CLI-Aktionen `check-update` / `update`). Dabei
wird der Checkout auf den neuesten GitHub-Release-Tag `uwe-v*` synchronisiert,
Studio/Portal neu gebaut, und bei Bedarf der Windows-Installer für das Command
Center geöffnet. Lokale Arbeitsbaum-Änderungen werden vorher per `git stash`
gesichert — nie still überschrieben. „Reparieren / neu bauen“ baut weiterhin den
aktuellen Checkout ohne Remote-Sync.

## Lokale Pfade (Windows)

| Inhalt | Pfad |
|---|---|
| Checkout | frei wählbar, z. B. `C:\git\UWE` |
| Kompatibler AppData-Stamm | `%LOCALAPPDATA%\UWE\rtx-connector-client` |
| Host-Daten | `...\host\data` |
| Backups | `...\host\data\backups` |
| Logs | `...\host\logs` |
| PID-Dateien | `...\host\runtime` |

Bei der ersten Einrichtung wird nur dann eine sichere lokale `.env` erzeugt,
wenn noch keine vorhanden ist. Bestehende Konfigurationen werden nicht
überschrieben. Fehlende lokale Pflichtwerte werden ergänzt. Neue Secrets sind
zufällig, Cookies bleiben bei lokalem HTTP funktionsfähig und die Ports lassen
sich über `STUDIO_PORT`/`PORTAL_PORT` ändern (Standard 3000/3001). So kann
eine installierte Instanz konfliktfrei neben einem Dev-Server laufen.

## Bedienung

1. UWE-Projektordner wählen und Einstellungen speichern.
2. **UWE einrichten** ausführen. Das installiert Abhängigkeiten, migriert die
   Datenbank, registriert idempotent einen lokalen Connector und erzeugt die
   Produktions-Builds. Eine vorherige Remote-Konfiguration wird einmalig gesichert.
3. **Alles starten** startet Studio, Portal und die bereits provisionierte RTX-Verbindung.
4. Unter **RTX einrichten** Ollama, Modelle und optionale lokale
   Executor konfigurieren.

Entwicklungs- und Build-Befehle:

```powershell
pnpm command-center:dev
pnpm command-center:build
pnpm --filter @uwe/rtx-connector-client typecheck
```

Die Host-Steuerung kann separat geprüft werden (Node 22.18+ bzw. Node 24):

```powershell
node tools/uwe-host-command-center/src/desktop-host-cli.ts status --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts setup --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts start --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts backup --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts stop --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts check-update --root C:\git\UWE
node tools/uwe-host-command-center/src/desktop-host-cli.ts update --root C:\git\UWE
```

Windows-Releases werden über GitHub Actions
(`.github/workflows/uwe-windows-release.yml`) als Tag `uwe-vX.Y.Z` veröffentlicht.
Details: [docs/engineering/rtx-connector-release.md](./engineering/rtx-connector-release.md).

## Sicherheit

- Studio, Portal und Ollama werden nicht automatisch ins Internet exponiert.
- Der RTX Connector bleibt outbound-only; auf dem RTX-PC wird kein API-Port
  geöffnet.
- Secrets werden weder in Statusantworten noch in Logs ausgegeben.
- UWE-Daten und Modelle bleiben außerhalb des Git-Checkouts erhalten.
- Vor öffentlicher Freigabe sind TLS/Reverse Proxy und eine separate
  Zugriffskontrolle für Studio erforderlich.

## Weiterhin unterstütztes Split-Modell

Ein Linux-Host mit systemd und ein separater RTX-PC bleiben vollständig
unterstützt. Im Split-Modell ist der Linux-Host die Source of Truth und das
Command Center verwaltet auf dem RTX-PC primär den ausgehenden Connector. So
bleibt die bestehende Always-on-Topologie verfügbar, ohne den All-in-one-Pfad
mit Linux-spezifischer Komplexität zu belasten.

## Bewusste Strukturentscheidungen

1. **Ein Orchestrator statt zweier Dashboards:** weniger Prozesse und keine
   konkurrierenden Zustände.
2. **Health plus Prozessbesitz:** „Online“ bedeutet erfolgreicher
   `/api/health` eines vom Command Center gestarteten Prozesses; fremde
   Portbelegungen und fehlerhafte Healthchecks werden getrennt gemeldet.
3. **Daten außerhalb des Repos:** Updates und Builds berühren keine Nutzdaten.
4. **Kompatible technische IDs:** keine erzwungene Token-/Modellmigration.
5. **Explizite Updates:** nur der Update-Button/CLI rollt Releases aus; lokale
   Änderungen werden per Stash gesichert, nie still überschrieben.
6. **Checkout statt Runtime-Duplikat:** Produktionsprozesse nutzen den
   installierten Workspace gezielt; große doppelte Standalone-Bäume entfallen.
7. **Linux bleibt optional:** All-in-one und Split-Hosting teilen Kern und
   Sicherheitsregeln, aber nicht unnötig denselben Betriebsmechanismus.
