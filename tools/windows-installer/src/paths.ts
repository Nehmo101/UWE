import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { InstallPaths } from "./types.js";

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function defaultInstallRoot(): string {
  if (isWindows()) {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      return path.join(localAppData, "UWE");
    }
  }

  return path.join(os.homedir(), ".uwe");
}

export function resolveInstallPaths(root: string): InstallPaths {
  const normalizedRoot = path.resolve(root);

  return {
    root: normalizedRoot,
    app: path.join(normalizedRoot, "app"),
    data: path.join(normalizedRoot, "data"),
    uploads: path.join(normalizedRoot, "data", "uploads"),
    backups: path.join(normalizedRoot, "data", "backups"),
    exports: path.join(normalizedRoot, "exports"),
    logs: path.join(normalizedRoot, "logs"),
    config: path.join(normalizedRoot, "config"),
    envFile: path.join(normalizedRoot, ".env"),
    stateFile: path.join(normalizedRoot, "config", "installer-state.json"),
    studioPidFile: path.join(normalizedRoot, "config", "studio.pid"),
    portalPidFile: path.join(normalizedRoot, "config", "portal.pid"),
  };
}

export function toFileUrl(filePath: string): string {
  const resolved = toPosixPath(filePath);
  return `file:${resolved}`;
}

export function toPosixPath(filePath: string): string {
  if (/^[A-Za-z]:[\\/]/.test(filePath)) {
    return filePath.replace(/\\/g, "/");
  }

  return path.resolve(filePath).replace(/\\/g, "/");
}

export function ensureDirectory(dirPath: string, dryRun = false): void {
  if (dryRun) {
    return;
  }

  fs.mkdirSync(dirPath, { recursive: true });
}

export function ensureInstallLayout(paths: InstallPaths, dryRun = false): void {
  const dirs = [
    paths.root,
    paths.app,
    paths.data,
    paths.uploads,
    paths.backups,
    paths.exports,
    paths.logs,
    paths.config,
  ];

  for (const dir of dirs) {
    ensureDirectory(dir, dryRun);
  }
}

export function canWriteDirectory(dirPath: string): boolean {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    const probe = path.join(dirPath, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

export function getFreeDiskBytes(targetPath: string): number | null {
  try {
  if (isWindows()) {
      const drive = path.parse(path.resolve(targetPath)).root || "C:\\";
      const output = execSync(
        `wmic logicaldisk where "DeviceID='${drive.replace("\\", "")}'" get FreeSpace /value`,
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const match = output.match(/FreeSpace=(\d+)/);
      return match ? Number.parseInt(match[1], 10) : null;
    }

    const { statfsSync } = fs as typeof fs & {
      statfsSync?: (p: string) => { bavail: number; bsize: number };
    };

    if (typeof statfsSync === "function") {
      const stats = statfsSync(path.resolve(targetPath));
      return stats.bavail * stats.bsize;
    }
  } catch {
    return null;
  }

  return null;
}

export function findRepoRoot(startDir = process.cwd()): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const pkg = path.join(current, "package.json");
    const workspace = path.join(current, "pnpm-workspace.yaml");
    const apps = path.join(current, "apps", "studio");
    const portal = path.join(current, "apps", "portal");

    if (
      fs.existsSync(pkg) &&
      fs.existsSync(workspace) &&
      fs.existsSync(apps) &&
      fs.existsSync(portal)
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}
