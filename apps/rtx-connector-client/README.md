# UWE Command Center

**Tauri 2** Desktop-App für lokales UWE-Hosting und den **UWE Maschinenraum**.
Der technische Paketname und der AppData-Pfad bleiben für Updates kompatibel.

## All-in-one Scope

- UWE installieren/reparieren: pnpm, Prisma, Migration, Seed und Release-Build
- Studio und Portal gemeinsam starten, stoppen und per Healthcheck überwachen
- CPU, RAM, Datenträger, NVIDIA-GPU, Branch und Revision anzeigen
- SQLite-Backups und gebündelte Host-Logs aus der Oberfläche
- Windows-Anmelde-Autostart für App und optional UWE-Dienste
- bestehende RTX-, Modell-, Download-, Drucker- und Runner-Funktionen

Details: [`../../docs/command-center.md`](../../docs/command-center.md).

## Scope in P1

- React 19 + TypeScript + Vite frontend in UWE Parchment style (`@uwe/shared-ui`)
- Tauri 2 shell with local JSON config in `%LOCALAPPDATA%/UWE/rtx-connector-client/`
  (Windows) bzw. `~/.local/share/UWE/rtx-connector-client/` (Linux)
- **Übersicht**, **Verbindung**, **Einstellungen** + 8-step **Erststart-Wizard**
- Starts/stops the same Connector Core as `pnpm connector:start` via `desktop-launcher.ts`
- Real host connection test: `GET /api/connectors/config` with Bearer token
- **Downloads**, **Modell-Bibliothek**, **UWE-Freigabe**, **Jobs** und **Logs** aktiv
- Model-Store CRUD via `client-cli.ts` (`model-store-get/save`, `scan`, `pull-ollama`, `jobs`, `logs`)

## Neu in P2

- **Cookbook**: Hardware-Profil (`detectHardwareProfile`), Empfehlungen
  (`buildCookbookRecommendations`) und Modell-Katalog mit Fit-Scores aus
  `@uwe/cookbook`; Buttons für Ollama-Pull und „Für UWE aktivieren“.
- **Runner**: Status von Ollama (`/api/tags`), LM Studio und llama.cpp
  (`/v1/models`), „Ollama starten“ (Windows & Linux) und „Verbindung testen“.
  LM-Studio-Ausführung ist in P2 nur Sichtbarkeit.
- **Sicherheit**: statische Outbound-only-Aussagen plus **Privacy Mode**-Schalter.
  Privacy Mode wird beim Start als `UWE_CONNECTOR_PRIVACY_MODE` an den
  Connector-Prozess übergeben.
- **Desktop-Shell**: Tray-Icon mit Öffnen/Beenden, Start im Tray/minimierter Start
  und Autostart beim Login — unter Windows über
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, unter Linux über einen
  XDG-Autostart-Eintrag (`~/.config/autostart/uwe-rtx-connector-client.desktop`).
- Neue `client-cli`-Befehle: `cookbook-dashboard`, `probe-runners`,
  `start-ollama`, `test-runner`.

## Neu in P3

- **Hugging Face Downloads**: Der Download-Tab kann einzelne Modell-Dateien aus
  einem Hugging-Face-Repo laden (`repoId`, Datei, Revision). Dateien landen unter
  `%LOCALAPPDATA%/UWE/rtx-connector-client/models/huggingface/` und werden danach
  als lokale `huggingface`-Profile in `model-store.json` registriert.
- Private/gated Repos werden über `HF_TOKEN` oder `HUGGINGFACE_HUB_TOKEN` im lokalen
  Prozess-Environment unterstützt. Der UWE Host sieht nur aktiv freigegebene
  Model-Store-Metadaten.
- Windows-Packaging ist aktiviert (`tauri build` erzeugt MSI/NSIS-Ziele). Das SVG
  unter `src-tauri/icons/icon.svg` ist das Quell-Icon; falls der lokale Tauri-
  Bundler `.ico`/PNG-Größen verlangt, diese im Checkout aus dem SVG generieren und
  in `bundle.icon` ergänzen.

## Neu in P5

- **Studio-Workflow-Standards**: Studio bietet auf `/system/rtx-connector` einen
  Modell-Picker für vom Connector gemeldete Modelle (Anzeigename, Beschreibung,
  `bestFor`) und Workflow-Standards pro Anwendungsfall (chat, code, dnd, analysis,
  embedding, vision → `{ connectorId, modelId }`). Heartbeat-Modelle tragen dafür
  jetzt eine stabile Profil-`id`. Das alte `/admin/cookbook` leitet auf die
  Maschinenraum-Seite um; Online-/Cloud-KI bleibt in Einstellungen + AI Gateway.

## Linux

Der Client läuft vollständig unter Linux; alle OS-Integrationen haben einen
Linux-Pfad:

- **Autostart**: XDG-Autostart-Eintrag in
  `~/.config/autostart/uwe-rtx-connector-client.desktop` (Toggle in den
  Einstellungen, gleiches Feld wie der Windows-Autostart).
- **Drucken**: Drucker-Erkennung über CUPS (`lpstat -p` / `lpstat -d`),
  Testdruck und `label_print`-Jobs über `lp -d <drucker>`.
- **„Ollama starten“**: sucht `ollama` im `PATH` sowie unter
  `/usr/local/bin`, `/usr/bin` und `~/.local/bin` und startet `ollama serve`
  (alternativ läuft Ollama als systemd-Dienst weiter: `systemctl start ollama`).
- **Config/Daten**: `~/.local/share/UWE/rtx-connector-client/` (config.json,
  model-store.json, Hugging-Face-Downloads, Logs).

Build-Voraussetzungen (Tauri 2, Ubuntu/Debian-Paketnamen):

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

`pnpm connector:client:build` erzeugt auf einem Linux-Host `deb`- und
`AppImage`-Bundles (siehe `tauri.conf.json` → `bundle.targets`). Das Tray-Icon
benötigt zur Laufzeit `libayatana-appindicator3`; ohne Tray-Unterstützung der
Desktop-Umgebung bleibt die App über das Fenster bedienbar.

## Commands

From the repo root:

```bash
pnpm command-center:dev
pnpm command-center:build
pnpm --filter @uwe/rtx-connector-client typecheck
```

Set `UWE_MONOREPO_ROOT` if the app cannot auto-detect the repo (e.g. packaged builds later).

```text
## Architecture

Tauri UI  →  Host-Aktionen → node tools/uwe-host-command-center/src/desktop-host-cli.ts
                                      ↓
                              Studio + Portal + SQLite + Backups + Logs

Tauri UI  →  start/stop  →  node --import tsx tools/uwe-rtx-connector/src/desktop-launcher.ts
                                      ↓
                              ConnectorRunner (outbound heartbeat + queue/direct/hybrid transport)

Tauri UI  →  downloads   →  node --import tsx tools/uwe-rtx-connector/src/huggingface-cli.ts
                                      ↓
                              AppData model cache + model-store.json
```

The headless CLI (`pnpm connector:start`) uses the same transport core. Set
`UWE_CONNECTOR_TRANSPORT=queue|direct|hybrid`; every mode remains outbound-only
and opens no listening port on the RTX machine.

## Local config / data dir

- `config.json` in local app data (Windows: `%LOCALAPPDATA%`, Linux:
  `~/.local/share`). Shape defined in `@uwe/connector-client-config`; its
  `transportMode` is `queue`, `direct`, or `hybrid`.
- `model-store.json`, `job-history.json`, Hugging-Face downloads and Connector-Logs
  liegen daneben im selben Tauri-AppData-Verzeichnis.

## Phased rollout

| Phase | Focus |
|-------|--------|
| P0 | Shell, connection, wizard, process control |
| P1 | Model library, Ollama pull, UWE release, jobs, logs |
| P2 | Cookbook (`@uwe/cookbook`), runners, Ollama start, security/privacy page, tray/autostart |
| P3 | Hugging Face downloads (current) |
| P4 | Spotify OAuth, audio, image worker |
| P5 | Studio online models + connector model picker |
| P6 | Legacy RTX Agent cleanup, connector queue provider |
