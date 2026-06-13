# UWE Windows Installer

This document describes the Windows bootstrapper for installing, configuring, and running UWE locally without Docker.

> **End users:** See [windows-install.md](windows-install.md) for a simple step-by-step guide.

## Overview

The Windows installer consists of:

| Component | Path | Role |
|-----------|------|------|
| **GUI Wizard** | `scripts/windows/uwe-wizard.ps1` | One-click install for non-technical users |
| **Control Panel** | `scripts/windows/uwe-control-panel.ps1` | Start/stop, backup, update, repair, uninstall |
| Node CLI | `tools/windows-installer/` | System checks, install, doctor, repair, backup |
| PowerShell launcher | `scripts/windows/uwe-launcher.ps1` | Interactive menu and thin wrappers |
| Inno Setup | `tools/windows-installer/inno/UWE-Setup.iss` | Proper Windows installer EXE |
| EXE build | `tools/windows-installer/dist/exe/UWE-Setup.exe` | Packaged CLI (CI artifact) |

End users should run **`UWE-Installieren.cmd`** or the GUI wizard. Developers use `pnpm installer:windows` or `pnpm launcher:dev`.

## New commands (CLI)

```bash
node tools/windows-installer/dist/cli.js doctor
node tools/windows-installer/dist/cli.js repair --fix-all
node tools/windows-installer/dist/cli.js backup
node tools/windows-installer/dist/cli.js restore --backup <path>
node tools/windows-installer/dist/cli.js update
node tools/windows-installer/dist/cli.js diagnostics
node tools/windows-installer/dist/cli.js repair-pnpm-path
node tools/windows-installer/dist/cli.js uninstall --keep-data
```

Root shortcuts: `pnpm doctor`, `pnpm repair`, `pnpm backup`, `pnpm restore`

## pnpm PATH auto-repair

The installer detects when `C:\Users\<user>\AppData\Local\pnpm` is not in PATH and adds it to the user environment via `setx`. After repair, restart open terminals.

## What the installer does

1. **System check**
   - Windows 10+
   - Node.js ≥ 20
   - pnpm ≥ 10
   - Git (required for dev/clone mode)
   - Free Studio/Portal ports (default `3000` / `3001`)
   - Write access to the install directory
   - At least 2 GiB free disk space

2. **Install layout**

Default root: `%LOCALAPPDATA%\UWE`

```
%LOCALAPPDATA%\UWE\
  .env
  app\                 # UWE application files
  data\
    uwe.db
    uploads\
    backups\
  exports\
  logs\
  config\
    installer-state.json
    studio.pid
    portal.pid
```

3. **Setup**
   - Copies a release bundle or local repository into `app/`
   - Runs `pnpm install --frozen-lockfile`
   - Runs `pnpm build:release` (production build)
   - Generates `.env` with a random `AUTH_SECRET`
   - Sets absolute Windows paths for DB/uploads/backups/exports
   - Runs `prisma generate` and `prisma migrate deploy`
   - Pre-migration DB backup to `data/backups/pre-migration-*.db`
   - Seeds demo data only in **dev** mode or when `--seed-demo` is set
   - Creates Desktop/Start Menu shortcuts and opens browser on start

4. **Launcher UX**
   - Start / stop Studio and Portal
   - Status and logs
   - Open Studio / Portal in the browser
   - Optional Desktop and Start Menu shortcuts
   - Optional auto-start via Windows Startup folder

## Dev mode vs release mode

### Dev mode (`--mode dev`)

Use when installing from a local checkout or Git clone.

- Source: current repository or `--repo <path>`
- `RUN_DB_SEED=auto` (demo world on empty DB)
- Intended for contributors and local testing

Example:

```powershell
git clone https://github.com/nehmo101/uwe
cd uwe
pnpm install
pnpm installer:windows:dry-run
.\scripts\windows\uwe-launcher.ps1 -Action install -Mode dev -RepoPath .
```

### Release mode (`--mode release`)

Use for shipping a prepared bundle to end users.

- Source: `--bundle <path>` or `UWE_RELEASE_BUNDLE`
- `RUN_DB_SEED=false` by default
- No demo seed in production installs

### Final release bundle contents

A release bundle directory should contain a built UWE monorepo tree:

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `apps/studio/.next/standalone` or full app with `pnpm start` support
- `apps/portal/.next/standalone` or full app with `pnpm start` support
- `packages/database/prisma/` with migrations
- `.env.example`
- `node_modules/` after `pnpm install --frozen-lockfile`
- Built output from `pnpm build:release`

Recommended build pipeline:

```bash
pnpm install --frozen-lockfile
pnpm build:release
# package the repo root into uwe-release-<version>.zip
```

## Building the installer

From the repository root:

```bash
# GUI wizard (dev)
pnpm installer:windows

# Release bundle + EXE
pnpm package:windows
```

This builds:
1. Release bundle in `tools/windows-installer/dist/release/`
2. CLI compiled to `dist/cli.js`
3. Optional `UWE-Setup.exe` via `@yao-pkg/pkg` (Windows CI)
4. Optional Inno Setup installer if ISCC is installed

## Building the EXE (legacy/pkg)

From the repository root:

```bash
pnpm installer:windows:build
```

This:

1. Compiles `tools/windows-installer` to `dist/cli.js`
2. Uses `@yao-pkg/pkg` on Windows CI to produce `dist/exe/UWE-Setup.exe`

On Linux/macOS dev machines without `pkg`, the build script still compiles the CLI and prints instructions for Windows artifact generation.

GitHub Actions workflow: `.github/workflows/windows-installer.yml`

## Using the installer

### PowerShell (from repository)

```powershell
# Interactive menu
.\scripts\windows\uwe-launcher.ps1

# Direct commands
.\scripts\windows\install.ps1 -Mode dev -RepoPath .
.\scripts\windows\start-uwe.ps1
.\scripts\windows\status-uwe.ps1
.\scripts\windows\stop-uwe.ps1
```

### Node CLI

```bash
node tools/windows-installer/dist/cli.js check --root "%LOCALAPPDATA%\UWE"
node tools/windows-installer/dist/cli.js install --mode dev --repo .
node tools/windows-installer/dist/cli.js start --root "%LOCALAPPDATA%\UWE"
```

### Dry run

```bash
pnpm installer:windows:dry-run
```

Plans the install without writing files or running package managers.

## Data locations

| Path | Purpose |
|------|---------|
| `%LOCALAPPDATA%\UWE\data\uwe.db` | SQLite database |
| `%LOCALAPPDATA%\UWE\data\uploads` | Uploaded assets |
| `%LOCALAPPDATA%\UWE\data\backups` | Backup ZIPs and pre-migration copies |
| `%LOCALAPPDATA%\UWE\exports` | Static HTML exports |
| `%LOCALAPPDATA%\UWE\logs` | `studio.log`, `portal.log` |
| `%LOCALAPPDATA%\UWE\.env` | Local configuration and secrets |

## Backup and restore

Use UWE Studio's built-in backup UI after startup, or copy:

- `%LOCALAPPDATA%\UWE\data\uwe.db`
- `%LOCALAPPDATA%\UWE\data\uploads\`
- `%LOCALAPPDATA%\UWE\data\backups\`

Restore via Studio → Backup, or stop UWE and replace the files above from a known-good backup.

## Auto-start

Enable:

```powershell
.\scripts\windows\setup-startup.ps1
# or
node tools/windows-installer/dist/cli.js enable-autostart
```

This creates:

`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\UWE-Autostart.cmd`

Disable:

```powershell
.\scripts\windows\remove-startup.ps1
```

Alternative for advanced setups: Windows Task Scheduler (not created automatically).

## Security notes

- `AUTH_SECRET` is generated randomly on first install; never hardcoded.
- Default host is `127.0.0.1` / `localhost`.
- Binding to `0.0.0.0` shows a warning because Studio has no login screen.
- `RUN_DB_SEED=false` in release mode.

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| Node missing / too old | Install Node 20+ and reopen PowerShell |
| pnpm missing | `corepack enable && corepack prepare pnpm@latest --activate` |
| Ports busy | `netstat -ano \| findstr :3000` and stop conflicting apps |
| Migration failed | `%LOCALAPPDATA%\UWE\logs\`, DB path in `.env`, write permissions |
| Start failed | Ensure install completed, run `status-uwe.ps1`, inspect logs |
| Bundle missing | Set `--bundle` or `UWE_RELEASE_BUNDLE` in release mode |

## Uninstall

1. Stop UWE: `.\scripts\windows\stop-uwe.ps1`
2. Remove auto-start: `.\scripts\windows\remove-startup.ps1`
3. Delete shortcuts:
   - Desktop: `UWE Launcher.cmd`
   - Start Menu: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\UWE\`
   - Startup: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\UWE-Autostart.cmd`
4. Delete install directory (default): `%LOCALAPPDATA%\UWE`

No Windows registry entries are created by the current installer.
