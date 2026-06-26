# UWE RTX Connector Client

Windows-focused Tauri 2 desktop scaffold for the local **UWE RTX Connector**.

## Scope in P0

- React 19 + TypeScript + Vite frontend.
- Tauri 2 shell with minimal Rust commands.
- Shared UWE parchment theme via `@uwe/shared-ui/uwe.css`.
- Sidebar placeholders for the full desktop-client surface.
- JSON config persistence in local app data.
- Stub start/stop status only; no real connector process spawn yet.

## Commands

From the repo root:

```bash
pnpm connector:client:dev
pnpm connector:client:build
pnpm --filter @uwe/rtx-connector-client typecheck
```

From this app folder:

```bash
pnpm tauri:dev
pnpm tauri:build
pnpm build
pnpm typecheck
```

## Local config storage

The Tauri backend stores `config.json` in the OS local app-data directory.

- Windows: `%LOCALAPPDATA%/UWE/rtx-connector-client/config.json`
- Linux dev fallback: `~/.local/share/UWE/rtx-connector-client/config.json`

## Notes

- `start_connector` and `stop_connector` only toggle in-memory process state in P0.
- `test_host_connection` currently validates URL shape only; it does not open a real network connection yet.
- `bundle.active` is disabled until native icons and Windows packaging details are added.
- `build` is the CI-safe web build; desktop packaging is behind `tauri:build`.
