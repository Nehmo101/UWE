import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { appendInstallLog } from "./logging.js";
import { resolveInstallPaths } from "./paths.js";
import { readInstallerState } from "./state.js";
import { stopUwe } from "./launcher.js";
import type { CommandResult } from "./types.js";

function runBackupCommand(appRoot: string, args: string[]): string {
  const command = `pnpm --filter @uwe/database db:generate && node --import tsx packages/backup/src/cli.ts ${args.join(" ")}`;
  const output = execSync(command, {
    cwd: appRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    env: {
      ...process.env,
      ...loadEnvFromInstallRoot(path.dirname(appRoot)),
    },
  });

  const match = output.match(/Backup erstellt: (.+)/);
  return match?.[1]?.trim() ?? output.trim();
}

function loadEnvFromInstallRoot(installRoot: string): Record<string, string> {
  const envFile = path.join(installRoot, ".env");
  const env: Record<string, string> = {};

  if (!fs.existsSync(envFile)) {
    return env;
  }

  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    env[key] = rest.join("=");
  }

  return env;
}

export interface BackupOptions {
  installRoot: string;
  type?: "full" | "world" | "campaign";
  worldSlug?: string;
  dryRun?: boolean;
}

export async function createInstallBackup(options: BackupOptions): Promise<CommandResult> {
  const paths = resolveInstallPaths(options.installRoot);
  const state = readInstallerState(paths.stateFile);

  if (!state && !fs.existsSync(paths.app)) {
    return { ok: false, message: "UWE is not installed." };
  }

  if (options.dryRun) {
    return {
      ok: true,
      message: `Would create ${options.type ?? "full"} backup in ${paths.backups}`,
    };
  }

  stopUwe(paths.stateFile);

  try {
    const args = [`--type=${options.type ?? "full"}`, "--format=zip"];
    if (options.worldSlug) {
      args.push(`--world=${options.worldSlug}`);
    }

    const outputPath = runBackupCommand(paths.app, args);
    appendInstallLog(paths.logs, `Backup created: ${outputPath}`);

    return {
      ok: true,
      message: `Backup created: ${outputPath}`,
      details: { outputPath },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Backup failed: ${message}` };
  }
}

export interface RestoreOptions {
  installRoot: string;
  backupPath: string;
  dryRun?: boolean;
}

export async function restoreInstallBackup(options: RestoreOptions): Promise<CommandResult> {
  const paths = resolveInstallPaths(options.installRoot);
  const backupPath = path.resolve(options.backupPath);

  if (!fs.existsSync(backupPath)) {
    return { ok: false, message: `Backup file not found: ${backupPath}` };
  }

  if (options.dryRun) {
    return {
      ok: true,
      message: `Would restore from ${backupPath}`,
    };
  }

  stopUwe(paths.stateFile);

  try {
    const preRestoreBackup = await createInstallBackup({
      installRoot: options.installRoot,
      type: "full",
    });

    appendInstallLog(paths.logs, `Pre-restore safety backup: ${preRestoreBackup.message}`);

    execSync(
      `pnpm --filter @uwe/database db:generate && node --import tsx packages/backup/src/cli-restore.ts "${backupPath.replace(/\\/g, "/")}"`,
      {
        cwd: paths.app,
        stdio: "inherit",
        env: {
          ...process.env,
          ...loadEnvFromInstallRoot(paths.root),
        },
        shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
      },
    );

    appendInstallLog(paths.logs, `Restore completed from ${backupPath}`);

    return {
      ok: true,
      message: `Restore completed from ${backupPath}`,
      details: { preRestoreBackup: preRestoreBackup.details },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendInstallLog(paths.logs, `Restore failed: ${message}`);
    return {
      ok: false,
      message: `Restore failed: ${message}. Check logs for details.`,
    };
  }
}

export function createDataSnapshot(installRoot: string, dryRun = false): CommandResult {
  const paths = resolveInstallPaths(installRoot);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotDir = path.join(paths.backups, `snapshot-${timestamp}`);

  if (dryRun) {
    return { ok: true, message: `Would create snapshot at ${snapshotDir}` };
  }

  fs.mkdirSync(snapshotDir, { recursive: true });

  const items = [
    { source: path.join(paths.data, "uwe.db"), target: "uwe.db" },
    { source: paths.uploads, target: "uploads" },
    { source: paths.envFile, target: ".env" },
  ];

  for (const item of items) {
    if (!fs.existsSync(item.source)) {
      continue;
    }

    const target = path.join(snapshotDir, item.target);
    const stat = fs.statSync(item.source);
    if (stat.isDirectory()) {
      fs.cpSync(item.source, target, { recursive: true });
    } else {
      fs.copyFileSync(item.source, target);
    }
  }

  appendInstallLog(paths.logs, `Data snapshot created: ${snapshotDir}`);

  return {
    ok: true,
    message: `Data snapshot created: ${snapshotDir}`,
    details: { snapshotDir },
  };
}
