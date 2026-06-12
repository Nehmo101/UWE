#!/usr/bin/env node
import path from "node:path";

import { defaultPortConfig } from "./config.js";
import { installUwe } from "./install.js";
import { startUwe, stopUwe, statusUwe } from "./launcher.js";
import {
  defaultInstallRoot,
  resolveInstallPaths,
} from "./paths.js";
import {
  createDesktopShortcut,
  createStartMenuShortcut,
  disableAutoStart,
  enableAutoStart,
} from "./startup.js";
import { runSystemCheck } from "./system-check.js";
import { readInstallerState } from "./state.js";
import type { InstallMode } from "./types.js";

interface ParsedArgs {
  command: string;
  installRoot: string;
  mode: InstallMode;
  bundlePath?: string;
  repoPath?: string;
  dryRun: boolean;
  json: boolean;
}

function printHelp(): void {
  console.log(`UWE Windows Installer

Usage:
  uwe-installer <command> [options]

Commands:
  check                 Run system checks
  install               Install or update UWE locally
  start                 Start Studio and Portal
  stop                  Stop Studio and Portal
  status                Show runtime status
  dry-run               Plan install without changes
  enable-autostart      Add Startup folder entry
  disable-autostart     Remove Startup folder entry
  shortcut-desktop      Create Desktop shortcut
  shortcut-startmenu    Create Start Menu shortcut

Options:
  --root <path>         Install root (default: %LOCALAPPDATA%\\UWE)
  --mode <release|dev>  Install mode (default: dev)
  --bundle <path>       Release bundle directory
  --repo <path>         Repository path for dev mode
  --dry-run             Do not write changes
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
    mode: "dev",
    dryRun: false,
    json: false,
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
      case "--dry-run":
        parsed.dryRun = true;
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
        });
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "start": {
        const result = startUwe(paths.stateFile);
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "stop": {
        const result = stopUwe(paths.stateFile);
        emit(result, parsed.json);
        return result.ok ? 0 : 1;
      }
      case "status": {
        const result = statusUwe(paths.stateFile);
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
