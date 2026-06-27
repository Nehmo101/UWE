# UWE RTX Connector Client

Windows-focused **Tauri 2** desktop app for the local **UWE RTX Connector**.

## Scope in P1

- React 19 + TypeScript + Vite frontend in UWE Parchment style (`@uwe/shared-ui`)
- Tauri 2 shell with local JSON config in `%LOCALAPPDATA%/UWE/rtx-connector-client/`
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
  (`/v1/models`), „Ollama starten“ (nur Windows) und „Verbindung testen“.
  LM-Studio-Ausführung ist in P2 nur Sichtbarkeit.
- **Sicherheit**: statische Outbound-only-Aussagen plus **Privacy Mode**-Schalter.
  Privacy Mode wird beim Start als `UWE_CONNECTOR_PRIVACY_MODE` an den
  Connector-Prozess übergeben.
- Neue `client-cli`-Befehle: `cookbook-dashboard`, `probe-runners`,
  `start-ollama`, `test-runner`.
- Tray-Integration und Windows-Autostart bleiben Stubs („folgt“).

## Neu in P5

- **Studio-Workflow-Standards**: Studio bietet auf `/system/rtx-connector` einen
  Modell-Picker für vom Connector gemeldete Modelle (Anzeigename, Beschreibung,
  `bestFor`) und Workflow-Standards pro Anwendungsfall (chat, code, dnd, analysis,
  embedding, vision → `{ connectorId, modelId }`). Heartbeat-Modelle tragen dafür
  jetzt eine stabile Profil-`id`. Das alte `/admin/cookbook` leitet auf die
  RTX-Connector-Seite um; Online-/Cloud-KI bleibt in Einstellungen + AI Gateway.

## Commands

From the repo root:

```bash
pnpm connector:client:dev
pnpm connector:client:build
pnpm --filter @uwe/rtx-connector-client typecheck
```

Set `UWE_MONOREPO_ROOT` if the app cannot auto-detect the repo (e.g. packaged builds later).

## Architecture

```
Tauri UI  →  start/stop  →  node --import tsx tools/uwe-rtx-connector/src/desktop-launcher.ts
                                      ↓
                              ConnectorRunner (outbound heartbeat + job poll)
```

The headless CLI (`pnpm connector:start`) remains unchanged.

## Local config / data dir

- `config.json` in Windows local app data. Shape defined in `@uwe/connector-client-config`.
- `model-store.json`, `job-history.json` und Connector-Logs liegen daneben im selben Tauri-AppData-Verzeichnis.

## Phased rollout

| Phase | Focus |
|-------|--------|
| P0 | Shell, connection, wizard, process control |
| P1 | Model library, Ollama pull, UWE release, jobs, logs |
| P2 | Cookbook (`@uwe/cookbook`), runners, Ollama start, security/privacy page (current) |
| P3 | Hugging Face downloads |
| P4 | Spotify OAuth, audio, image worker |
| P5 | Studio online models + connector model picker |
| P6 | Legacy RTX Agent cleanup, connector queue provider |
