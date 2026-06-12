import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { generateEnvContent, defaultPortConfig } from "./config.js";
import { InstallerError } from "./errors.js";
import {
  ensureInstallLayout,
  findRepoRoot,
  resolveInstallPaths,
} from "./paths.js";
import { writeInstallerState } from "./state.js";
import { runSystemCheck } from "./system-check.js";
import type { CommandResult, InstallMode } from "./types.js";

export interface InstallOptions {
  installRoot: string;
  mode: InstallMode;
  bundlePath?: string;
  repoPath?: string;
  dryRun?: boolean;
}

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

function copyDirectory(source: string, target: string, dryRun: boolean): void {
  if (dryRun) {
    return;
  }

  fs.cpSync(source, target, { recursive: true });
}

function resolveSourceRepo(options: InstallOptions): string {
  if (options.repoPath && fs.existsSync(options.repoPath)) {
    return path.resolve(options.repoPath);
  }

  const discovered = findRepoRoot();
  if (discovered) {
    return discovered;
  }

  throw new InstallerError(
    "BUNDLE_MISSING",
    "No local repository found. Use --repo or run from the UWE checkout.",
  );
}

function resolveReleaseBundle(options: InstallOptions): string {
  if (options.bundlePath && fs.existsSync(options.bundlePath)) {
    return path.resolve(options.bundlePath);
  }

  const envBundle = process.env.UWE_RELEASE_BUNDLE;
  if (envBundle && fs.existsSync(envBundle)) {
    return path.resolve(envBundle);
  }

  throw new InstallerError(
    "BUNDLE_MISSING",
    "Release bundle not found. Set --bundle or UWE_RELEASE_BUNDLE to a prepared UWE release directory.",
  );
}

export async function installUwe(options: InstallOptions): Promise<CommandResult> {
  const dryRun = options.dryRun ?? false;
  const paths = resolveInstallPaths(options.installRoot);
  const ports = defaultPortConfig();

  const systemCheck = await runSystemCheck({
    installRoot: paths.root,
    ports,
    requireGit: options.mode === "dev" && !options.repoPath && !findRepoRoot(),
  });

  if (!systemCheck.ok) {
    return {
      ok: false,
      message: systemCheck.errors.join("\n"),
      details: { warnings: systemCheck.warnings, ...systemCheck.details },
    };
  }

  ensureInstallLayout(paths, dryRun);

  let appSource: string;
  if (options.mode === "release") {
    appSource = resolveReleaseBundle(options);
    if (!dryRun) {
      if (fs.existsSync(paths.app)) {
        fs.rmSync(paths.app, { recursive: true, force: true });
      }
      copyDirectory(appSource, paths.app, dryRun);
    }
  } else {
    appSource = resolveSourceRepo(options);
    if (!dryRun) {
      if (fs.existsSync(paths.app)) {
        fs.rmSync(paths.app, { recursive: true, force: true });
      }
      copyDirectory(appSource, paths.app, dryRun);
    }
  }

  const templatePath = path.join(appSource, ".env.example");
  const envResult = generateEnvContent({
    paths,
    ports,
    mode: options.mode,
    templatePath: fs.existsSync(templatePath) ? templatePath : undefined,
    dryRun,
  });

  if (!dryRun) {
    try {
      runCommand("pnpm install --frozen-lockfile", paths.app, dryRun);
      runCommand("pnpm --filter @uwe/windows-installer run build", paths.app, dryRun);
      runCommand("pnpm --filter @uwe/database db:generate", paths.app, dryRun);
      runCommand(
        "pnpm --filter @uwe/database exec prisma migrate deploy --schema prisma/schema.prisma",
        paths.app,
        dryRun,
      );

      if (options.mode === "dev") {
        runCommand("pnpm --filter @uwe/database db:seed", paths.app, dryRun);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InstallerError("DB_MIGRATION_FAILED", message);
    }
  }

  if (!dryRun) {
    const launcherSource = path.join(paths.app, "scripts", "windows", "installed-launcher.ps1");
    const launcherTarget = path.join(paths.config, "launcher.ps1");
    if (fs.existsSync(launcherSource)) {
      fs.copyFileSync(launcherSource, launcherTarget);
    }

    const cliSource = path.join(paths.app, "tools", "windows-installer", "dist", "cli.js");
    const cliTarget = path.join(paths.config, "uwe-installer-cli.js");
    if (fs.existsSync(cliSource)) {
      fs.copyFileSync(cliSource, cliTarget);
    }
  }

  writeInstallerState(
    paths.stateFile,
    {
      version: 1,
      installedAt: new Date().toISOString(),
      mode: options.mode,
      paths,
      ports,
      repoPath: options.mode === "dev" ? appSource : undefined,
      bundlePath: options.mode === "release" ? appSource : undefined,
    },
    dryRun,
  );

  return {
    ok: true,
    message: dryRun
      ? `Dry-run install planned for ${paths.root}`
      : `UWE installed to ${paths.root}`,
    details: {
      paths,
      warnings: envResult.warnings,
      mode: options.mode,
    },
  };
}
