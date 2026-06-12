import fs from "node:fs";

import { INSTALLER_STATE_VERSION } from "./constants.js";
import type { InstallMode, InstallPaths, PortConfig } from "./types.js";

export interface InstallerState {
  version: number;
  installedAt: string;
  mode: InstallMode;
  paths: InstallPaths;
  ports: PortConfig;
  repoPath?: string;
  bundlePath?: string;
}

export function readInstallerState(stateFile: string): InstallerState | null {
  if (!fs.existsSync(stateFile)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8")) as InstallerState;
    if (parsed.version !== INSTALLER_STATE_VERSION) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeInstallerState(
  stateFile: string,
  state: InstallerState,
  dryRun = false,
): void {
  if (dryRun) {
    return;
  }

  fs.mkdirSync(state.paths.config, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf8");
}
