import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { generateEnvContent, defaultPortConfig } from "./config.js";
import { runDoctor } from "./doctor.js";
import { installUwe } from "./install.js";
import { appendInstallLog } from "./logging.js";
import { installPnpmViaCorepack, repairPnpmPath } from "./pnpm-path.js";
import { resolveInstallPaths } from "./paths.js";
import { readInstallerState } from "./state.js";
import { generateAuthSecret } from "./secrets.js";
import type { CommandResult, InstallMode, RepairOptions } from "./types.js";

function runCommand(command: string, cwd: string, dryRun: boolean): void {
  if (dryRun) {
    return;
  }

  execSync(command, {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
  });
}

function backupDatabaseBeforeMigration(dbPath: string, backupsDir: string, dryRun: boolean): string | null {
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(backupsDir, `pre-repair-${timestamp}.db`);

  if (!dryRun) {
    fs.mkdirSync(backupsDir, { recursive: true });
    fs.copyFileSync(dbPath, target);
  }

  return target;
}

export async function runRepair(options: RepairOptions): Promise<CommandResult> {
  const paths = resolveInstallPaths(options.installRoot);
  const dryRun = options.dryRun ?? false;
  const fixes: string[] = [];

  appendInstallLog(paths.logs, `Repair started (dryRun=${dryRun})`);

  if (options.fixAll || options.actions.includes("repair-pnpm-path")) {
    const result = repairPnpmPath(dryRun);
    fixes.push(result.message);
    if (!result.ok && !dryRun) {
      return { ok: false, message: result.message, details: { fixes } };
    }
  }

  if (options.fixAll || options.actions.includes("install-pnpm")) {
    const result = installPnpmViaCorepack(dryRun);
    fixes.push(result.message);
    if (!result.ok) {
      return { ok: false, message: result.message, details: { fixes } };
    }
  }

  const state = readInstallerState(paths.stateFile);
  const appRoot = paths.app;
  const mode: InstallMode = state?.mode ?? "release";

  if (options.fixAll || options.actions.includes("regenerate-env") || options.actions.includes("regenerate-auth-secret")) {
    if (fs.existsSync(appRoot)) {
      const envResult = generateEnvContent({
        paths,
        ports: state?.ports ?? defaultPortConfig(),
        mode,
        existingEnvPath: fs.existsSync(paths.envFile) ? paths.envFile : undefined,
        dryRun,
      });
      fixes.push("Configuration (.env) regenerated.");
      if (envResult.warnings.length > 0) {
        fixes.push(...envResult.warnings);
      }
    }
  }

  if (options.actions.includes("regenerate-auth-secret") && fs.existsSync(paths.envFile) && !dryRun) {
    const content = fs.readFileSync(paths.envFile, "utf8");
    const updated = content.replace(
      /^AUTH_SECRET=.*$/m,
      `AUTH_SECRET=${generateAuthSecret()}`,
    );
    fs.writeFileSync(paths.envFile, updated, "utf8");
    fixes.push("AUTH_SECRET regenerated.");
  }

  if ((options.fixAll || options.actions.includes("migrate")) && fs.existsSync(appRoot)) {
    backupDatabaseBeforeMigration(
      path.join(paths.data, "uwe.db"),
      paths.backups,
      dryRun,
    );
    try {
      runCommand("pnpm --filter @uwe/database db:generate", appRoot, dryRun);
      runCommand(
        "pnpm --filter @uwe/database exec prisma migrate deploy --schema prisma/schema.prisma",
        appRoot,
        dryRun,
      );
      fixes.push("Database migrations applied.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Migration repair failed: ${message}`, details: { fixes } };
    }
  }

  if (options.fixAll || options.actions.includes("build")) {
    if (fs.existsSync(appRoot)) {
      try {
        runCommand("pnpm --filter @uwe/database db:generate", appRoot, dryRun);
        runCommand("pnpm build:release", appRoot, dryRun);
        fixes.push("Production build completed.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, message: `Build repair failed: ${message}`, details: { fixes } };
      }
    }
  }

  if (options.fixAll || options.actions.includes("reinstall")) {
    const installResult = await installUwe({
      installRoot: options.installRoot,
      mode,
      repoPath: state?.repoPath,
      bundlePath: state?.bundlePath,
      dryRun,
      upgrade: true,
      seedDemo: false,
    });

    fixes.push(installResult.message);
    if (!installResult.ok) {
      return { ok: false, message: installResult.message, details: { fixes } };
    }
  }

  if (options.fixAll && fixes.length === 0) {
    const doctor = await runDoctor({ installRoot: options.installRoot });
    const fixable = doctor.checks.filter((check) => !check.ok && check.fixable && check.fixAction);

    for (const check of fixable) {
      if (!check.fixAction) {
        continue;
      }

      const nested = await runRepair({
        installRoot: options.installRoot,
        actions: [check.fixAction],
        dryRun,
      });

      fixes.push(`${check.id}: ${nested.message}`);
      if (!nested.ok) {
        return { ok: false, message: nested.message, details: { fixes } };
      }
    }
  }

  appendInstallLog(paths.logs, `Repair completed: ${fixes.join("; ")}`);

  const doctor = await runDoctor({ installRoot: options.installRoot });

  return {
    ok: doctor.ok,
    message: doctor.ok
      ? `Repair completed successfully.\n${fixes.join("\n")}`
      : `Repair applied but issues remain.\n${formatDoctorSummary(doctor)}\n${fixes.join("\n")}`,
    details: { fixes, doctor },
  };
}

function formatDoctorSummary(doctor: Awaited<ReturnType<typeof runDoctor>>): string {
  return doctor.checks
    .filter((check) => !check.ok)
    .map((check) => `- ${check.message}`)
    .join("\n");
}
