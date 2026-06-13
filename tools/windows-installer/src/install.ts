import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { generateEnvContent, defaultPortConfig } from "./config.js";
import { detectExistingInstall } from "./install-detection.js";
import { InstallerError } from "./errors.js";
import { appendInstallLog } from "./logging.js";
import {
  ensureInstallLayout,
  findRepoRoot,
  resolveInstallPaths,
} from "./paths.js";
import { repairPnpmPath } from "./pnpm-path.js";
import { writeInstallerState } from "./state.js";
import {
  createDesktopShortcut,
  createStartMenuShortcut,
  createControlPanelShortcut,
} from "./startup.js";
import { runSystemCheck } from "./system-check.js";
import type { CommandResult, InstallMode } from "./types.js";

export interface InstallOptions {
  installRoot: string;
  mode: InstallMode;
  bundlePath?: string;
  repoPath?: string;
  dryRun?: boolean;
  upgrade?: boolean;
  seedDemo?: boolean;
  createShortcuts?: boolean;
  openBrowser?: boolean;
}

function runCommand(command: string, cwd: string, dryRun: boolean, logDir?: string): void {
  if (dryRun) {
    return;
  }

  appendInstallLog(logDir ?? cwd, `Running: ${command}`);

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

function readUweVersion(appSource: string): string | undefined {
  const versionFile = path.join(appSource, "VERSION");
  if (fs.existsSync(versionFile)) {
    return fs.readFileSync(versionFile, "utf8").trim();
  }

  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(appSource, "package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version;
  } catch {
    return undefined;
  }
}

function backupDatabaseBeforeMigration(
  dbPath: string,
  backupsDir: string,
  dryRun: boolean,
): void {
  if (!fs.existsSync(dbPath)) {
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(backupsDir, `pre-migration-${timestamp}.db`);

  if (!dryRun) {
    fs.mkdirSync(backupsDir, { recursive: true });
    fs.copyFileSync(dbPath, target);
    appendInstallLog(path.dirname(backupsDir), `Pre-migration backup: ${target}`);
  }
}

function validateBuildOutput(appRoot: string): void {
  const studioBuild = path.join(appRoot, "apps", "studio", ".next", "BUILD_ID");
  const portalBuild = path.join(appRoot, "apps", "portal", ".next", "BUILD_ID");

  if (!fs.existsSync(studioBuild) || !fs.existsSync(portalBuild)) {
    throw new InstallerError(
      "START_FAILED",
      "Production build is missing after install. Run repair or reinstall.",
    );
  }
}

export async function installUwe(options: InstallOptions): Promise<CommandResult> {
  const dryRun = options.dryRun ?? false;
  const upgrade = options.upgrade ?? false;
  const paths = resolveInstallPaths(options.installRoot);
  const ports = defaultPortConfig();
  const existing = detectExistingInstall(options.installRoot);

  appendInstallLog(paths.logs, `Install started (mode=${options.mode}, upgrade=${upgrade}, dryRun=${dryRun})`);

  const pathRepair = repairPnpmPath(dryRun);
  if (!pathRepair.ok && !dryRun) {
    appendInstallLog(paths.logs, `pnpm PATH repair attempted: ${pathRepair.message}`);
  }

  const systemCheck = await runSystemCheck({
    installRoot: paths.root,
    ports,
    requireGit: options.mode === "dev" && !options.repoPath && !findRepoRoot(),
    checkExistingInstall: !upgrade,
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
  } else {
    appSource = resolveSourceRepo(options);
  }

  const uweVersion = readUweVersion(appSource);

  if (!dryRun) {
    if (fs.existsSync(paths.app)) {
      fs.rmSync(paths.app, { recursive: true, force: true });
    }
    copyDirectory(appSource, paths.app, dryRun);
  }

  const templatePath = path.join(appSource, ".env.example");
  const preserveEnv = upgrade && fs.existsSync(paths.envFile);

  const envResult = generateEnvContent({
    paths,
    ports,
    mode: options.mode,
    templatePath: fs.existsSync(templatePath) ? templatePath : undefined,
    existingEnvPath: preserveEnv ? paths.envFile : undefined,
    dryRun,
  });

  if (!dryRun) {
    try {
      runCommand("pnpm install --frozen-lockfile", paths.app, dryRun, paths.logs);
      runCommand("pnpm --filter @uwe/windows-installer run build", paths.app, dryRun, paths.logs);
      runCommand("pnpm --filter @uwe/database db:generate", paths.app, dryRun, paths.logs);
      runCommand("pnpm build:release", paths.app, dryRun, paths.logs);

      backupDatabaseBeforeMigration(
        path.join(paths.data, "uwe.db"),
        paths.backups,
        dryRun,
      );

      runCommand(
        "pnpm --filter @uwe/database exec prisma migrate deploy --schema prisma/schema.prisma",
        paths.app,
        dryRun,
        paths.logs,
      );

      const shouldSeed =
        options.seedDemo === true ||
        (options.seedDemo !== false && options.mode === "dev" && !upgrade && !existing.hasDatabase);

      if (shouldSeed) {
        runCommand("pnpm --filter @uwe/database db:seed", paths.app, dryRun, paths.logs);
      }

      validateBuildOutput(paths.app);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendInstallLog(paths.logs, `Install failed: ${message}`);
      throw new InstallerError("DB_MIGRATION_FAILED", message);
    }
  }

  if (!dryRun) {
    const launcherSource = path.join(paths.app, "scripts", "windows", "installed-launcher.ps1");
    const launcherTarget = path.join(paths.config, "launcher.ps1");
    if (fs.existsSync(launcherSource)) {
      fs.copyFileSync(launcherSource, launcherTarget);
    }

    const controlPanelSource = path.join(paths.app, "scripts", "windows", "uwe-control-panel.ps1");
    const controlPanelTarget = path.join(paths.config, "control-panel.ps1");
    if (fs.existsSync(controlPanelSource)) {
      fs.copyFileSync(controlPanelSource, controlPanelTarget);
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
      uweVersion,
    },
    dryRun,
  );

  const createShortcuts = options.createShortcuts !== false;
  const shortcutResults: string[] = [];

  if (createShortcuts && !dryRun) {
    const launcherScript = path.join(paths.config, "launcher.ps1");
    const controlPanelScript = path.join(paths.config, "control-panel.ps1");

    shortcutResults.push(
      createDesktopShortcut(paths.root, launcherScript, dryRun).message,
      createStartMenuShortcut(paths.root, launcherScript, dryRun).message,
    );

    if (fs.existsSync(controlPanelScript)) {
      shortcutResults.push(
        createControlPanelShortcut(paths.root, controlPanelScript, dryRun).message,
      );
    }
  }

  appendInstallLog(paths.logs, `Install completed at ${paths.root}`);

  return {
    ok: true,
    message: dryRun
      ? `Dry-run install planned for ${paths.root}`
      : upgrade
        ? `UWE updated at ${paths.root}`
        : `UWE installed to ${paths.root}`,
    details: {
      paths,
      warnings: envResult.warnings,
      mode: options.mode,
      uweVersion,
      shortcuts: shortcutResults,
      existing: upgrade ? existing : undefined,
    },
  };
}
