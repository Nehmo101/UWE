# UWE RTX Connector Client

Windows-focused **Tauri 2** desktop app for the local **UWE RTX Connector**.

## Scope in P0

- React 19 + TypeScript + Vite frontend in UWE Parchment style (`@uwe/shared-ui`)
- Tauri 2 shell with local JSON config in `%LOCALAPPDATA%/UWE/rtx-connector-client/`
- **Übersicht**, **Verbindung**, **Einstellungen** + 8-step **Erststart-Wizard**
- Starts/stops the same Connector Core as `pnpm connector:start` via `desktop-launcher.ts`
- Real host connection test: `GET /api/connectors/config` with Bearer token
- Placeholders for all 14 product navigation areas

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

## Local config

`config.json` in Windows local app data. Shape defined in `@uwe/connector-client-config`.

## Phased rollout

| Phase | Focus |
|-------|--------|
| P0 | Shell, connection, wizard, process control (this PR) |
| P1 | Model library, Ollama pull, UWE release, jobs, logs |
| P2 | Cookbook (`@uwe/cookbook`), runners, Ollama start, security page |
| P3 | Hugging Face downloads |
| P4 | Spotify OAuth, audio, image worker |
| P5 | Studio online models + connector model picker |
| P6 | Legacy RTX Agent cleanup, connector queue provider |
