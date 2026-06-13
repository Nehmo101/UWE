#!/usr/bin/env node
import path from "node:path";

import { createInstallBackup, createDataSnapshot, restoreInstallBackup } from "./backup-restore.js";
import { defaultPortConfig } from "./config.js";
import { createDiagnosticsPackage } from "./diagnostics.js";
import { doctorToCommandResult, runDoctor } from "./doctor.js";
import { installUwe } from "./install.js";
import {
  startUwe,
  stopUwe,
  restartUwe,
  statusUwe,
  openUweInBrowser,
} from "./launcher.js";
import {
  defaultInstallRoot,
  resolveInstallPaths,
} from "./paths.js";
import { installPnpmViaCorepack, repairPnpmPath } from "./pnpm-path.js";
import { runRepair } from "./repair.js";
import {
  createDesktopShortcut,
  createStartMenuShortcut,
  disableAutoStart,
  enableAutoStart,
} from "./startup.js";
import { runSystemCheck } from "./system-check.js";
import { readInstallerState } from "./state.js";
import { checkForUpdate, getInstalledVersion, runUpdate } from "./update.js";
import { uninstallUwe } from "./uninstall.js";
import type { InstallMode } from "./types.js";

interface ParsedArgs {
  command: string;
  installRoot: string;
  mode: InstallMode;
  bundlePath?: string;
  repoPath?: string;
  backupPath?: string;
  dryRun: boolean;
  json: boolean;
  keepData: boolean;
  seedDemo: boolean;
  fixAll: boolean;
  actions: string[];
  noBrowser: boolean;
}

function printHelp(): void {
  console.log(`UWE Windows Installer

Usage:
  uwe-installer <command> [options]

Commands:
  check                 Run system checks
  install               Install or update UWE locally
  start                 Start Studio and Portal (opens browser)
  stop                  Stop Studio and Portal
  restart               Restart UWE
  status                Show runtime status
  open                  Open UWE Studio in browser
  doctor                Diagnose installation and environment
  repair                Repair common problems
  backup                Create a backup
  restore               Restore from backup ZIP
  snapshot              Create raw data snapshot (db + uploads + config)
  update                Check for and install updates
  update-check          Check if update is available
  uninstall             Remove UWE (use --keep-data to preserve worlds)
  diagnostics           Create diagnostics ZIP (no secrets)
  enable-autostart      Add Startup folder entry
  disable-autostart     Remove Startup folder entry
  shortcut-desktop      Create Desktop shortcut
  shortcut-startmenu    Create Start Menu shortcut
  install-pnpm          Install pnpm via corepack
  repair-pnpm-path      Add pnpm global bin to user PATH
  dry-run               Plan install without changes

Options:
  --root <path>         Install root (default: %LOCALAPPDATA%\\UWE)
  --mode <release|dev>  Install mode (default: release)
  --bundle <path>       Release bundle directory
  --repo <path>         Repository path for dev mode
  --backup <path>       Backup ZIP for restore
  --keep-data           Keep data on uninstall
  --seed-demo           Install demo world (dev/fresh installs)
  --fix-all             Repair all fixable doctor issues
  --action <name>       Specific repair action (repeatable)
  --dry-run             Do not write changes
  --no-browser          Do not open browser on start
  --json                Print machine-readable JSON
  -h, --help            Show help
`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const command = args.shift() ?? "help";

  const parsed: ParsedArgs = {
    command,
    installRoot: defaultInstallRoot(),
    mode: "release",
    dryRun: false,
    json: false,
    keepData: false,
    seedDemo: false,
    fixAll: false,
    actions: [],
    noBrowser: false,
  };

  while (args.length > 0) {
    const current = args.shift();
    if (!current) {
      break;
    }

    switch (current) {
      case "--root":
        parsed.installRoot = path.resolve(args.shift() ?? parsed.installRoot);
        break;
      case "--mode": {
        const mode = args.shift();
        if (mode === "release" || mode === "dev") {
          parsed.mode = mode;
        }
        break;
      }
      case "--bundle":
        parsed.bundlePath = args.shift();
        break;
      case "--repo":
        parsed.repoPath = args.shift();
        break;
      case "--backup":
        parsed.backupPath = args.shift();
        break;
      case "--keep-data":
        parsed.keepData = true;
        break;
      case "--seed-demo":
        parsed.seedDemo = true;
        break;
      case "--fix-all":
        parsed.fixAll = true;
        break;
      case "--action":
        parsed.actions.push(args.shift() ?? "");
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--no-browser":
        parsed.noBrowser = true;
        break;
      case "--json":
        parsed.json = true;
        break;
      case "-h":
      case "--help":
        parsed.command = "help";
        break;
      default:
        break;
    }
  }

  if (parsed.command === "dry-run") {
    parsed.dryRun = true;
    parsed.command = "install";
  }

  return parsed;
}

function emit(result: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (
    result &&
    typeof result === "object" &&
    "message" in result &&
    typeof (result as { message: unknown }).message === "string"
  ) {
    console.log((result as { message: string }).message);
  } else {
    console.log(result);
  }
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  const paths = resolveInstallPaths(parsed.installRoot);
  const ports = defaultPortConfig();

  if (parsed.command === "help") {
    printHelp();
    return 0;
  }

  try {
    switch (parsed.command) {
      case "check": {
        const result = await runSystemCheck({
          installRoot: paths.root,
          ports,
          requireGit: parsed.mode === "dev",
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "install": {
        const result = await installUwe({
          installRoot: paths.root,
          mode: parsed.mode,
          bundlePath: parsed.bundlePath,
          repoPath: parsed.repoPath,
          dryRun: parsed.dryRun,
          seedDemo: parsed.seedDemo,
          upgrade: Boolean(readInstallerState(paths.stateFile)),
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "start": {
        const result = await startUwe(paths.stateFile, {
          openBrowser: !parsed.noBrowser,
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "stop": {
        const result = stopUwe(paths.stateFile);
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "restart": {
        const result = await restartUwe(paths.stateFile, {
          openBrowser: !parsed.noBrowser,
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "status": {
        const result = statusUwe(paths.stateFile);
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "open": {
        const result = openUweInBrowser(paths.stateFile, "studio");
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "doctor": {
        const result = await runDoctor({ installRoot: paths.root });
        emit(doctorToCommandResult(result), parsed.json);
        return result.ok ? 0 : 1;
      }
      case "repair": {
        const result = await runRepair({
          installRoot: paths.root,
          actions: parsed.actions,
          fixAll: parsed.fixAll || parsed.actions.length === 0,
          dryRun: parsed.dryRun,
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "backup": {
        const result = await createInstallBackup({
          installRoot: paths.root,
          dryRun: parsed.dryRun,
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "restore": {
        if (!parsed.backupPath) {
          emit({ ok: false, message: "Provide --backup <path> to a UWE backup ZIP." }, parsed.json);
          return 1;
        }
        const result = await restoreInstallBackup({
          installRoot: paths.root,
          backupPath: parsed.backupPath,
          dryRun: parsed.dryRun,
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "snapshot": {
        const result = createDataSnapshot(paths.root, parsed.dryRun);
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "update-check": {
        const state = readInstallerState(paths.stateFile);
        const source =
          parsed.bundlePath ??
          parsed.repoPath ??
          state?.bundlePath ??
          state?.repoPath;
        if (!source) {
          emit({ ok: false, message: "No update source. Provide --bundle or --repo." }, parsed.json);
          return 1;
        }
        const check = checkForUpdate(paths.root, source);
        const message = check.updateAvailable
          ? `Update available: ${check.installedVersion} -> ${check.availableVersion}`
          : `UWE is up to date (${getInstalledVersion(paths.root) ?? "unknown"}).`;
        emit({ ok: true, message, details: check }, parsed.json);
        return 0;
      }
      case "update": {
        const result = await runUpdate({
          installRoot: paths.root,
          bundlePath: parsed.bundlePath,
          repoPath: parsed.repoPath,
          dryRun: parsed.dryRun,
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "uninstall": {
        const result = await uninstallUwe({
          installRoot: paths.root,
          keepData: parsed.keepData,
          dryRun: parsed.dryRun,
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "diagnostics": {
        const result = await createDiagnosticsPackage({
          installRoot: paths.root,
          dryRun: parsed.dryRun,
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "install-pnpm": {
        const result = installPnpmViaCorepack(parsed.dryRun);
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "repair-pnpm-path": {
        const result = repairPnpmPath(parsed.dryRun);
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "enable-autostart": {
        const state = readInstallerState(paths.stateFile);
        const launcherScript = path.join(paths.config, "launcher.ps1");
        const result = enableAutoStart(
          state?.paths.root ?? paths.root,
          launcherScript,
          parsed.dryRun,
        );
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "disable-autostart": {
        const result = disableAutoStart(parsed.dryRun);
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "shortcut-desktop": {
        const state = readInstallerState(paths.stateFile);
        const launcherScript = path.join(paths.config, "launcher.ps1");
        const result = createDesktopShortcut(
          state?.paths.root ?? paths.root,
          launcherScript,
          parsed.dryRun,
        );
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "shortcut-startmenu": {
        const state = readInstallerState(paths.stateFile);
        const launcherScript = path.join(paths.config, "launcher.ps1");
        const result = createStartMenuShortcut(
          state?.paths.root ?? paths.root,
          launcherScript,
          parsed.dryRun,
        );
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      default:
        printHelp();
        return 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit({ ok: false, message }, parsed.json);
    return 1;
  }
}

main().then((code) => {
  process.exitCode = code;
});
