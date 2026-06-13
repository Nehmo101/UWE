import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { parseEnvFile } from "./config.js";
import { detectExistingInstall } from "./install-detection.js";
import { checkPnpmPath } from "./pnpm-path.js";
import { canWriteDirectory, resolveInstallPaths } from "./paths.js";
import { checkPorts } from "./ports.js";
import { defaultPortConfig } from "./config.js";
import { readInstallerState } from "./state.js";
import { getNodeVersion, getPnpmVersion, getGitVersion } from "./system-check.js";
import type { CommandResult, DoctorCheck, DoctorResult } from "./types.js";

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function checkBuildOutput(appRoot: string): DoctorCheck {
  const studioBuild = path.join(appRoot, "apps", "studio", ".next", "BUILD_ID");
  const portalBuild = path.join(appRoot, "apps", "portal", ".next", "BUILD_ID");

  const studioOk = fileExists(studioBuild);
  const portalOk = fileExists(portalBuild);

  if (studioOk && portalOk) {
    return { id: "build", ok: true, message: "Production build output is present." };
  }

  return {
    id: "build",
    ok: false,
    message: "Production build is missing. Run repair or reinstall to build UWE.",
    fixable: true,
    fixAction: "build",
  };
}

function checkEnvValues(envFile: string): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  if (!fileExists(envFile)) {
    checks.push({
      id: "env-file",
      ok: false,
      message: "Configuration file (.env) is missing.",
      fixable: true,
      fixAction: "regenerate-env",
    });
    return checks;
  }

  const content = fs.readFileSync(envFile, "utf8");
  const values = parseEnvFile(content);

  const required = ["AUTH_SECRET", "DATABASE_URL", "UPLOADS_DIR", "BACKUPS_DIR"];
  for (const key of required) {
    const value = values.get(key);
    checks.push({
      id: `env-${key.toLowerCase()}`,
      ok: Boolean(value && value.length > 0),
      message: value ? `${key} is set.` : `${key} is missing or empty.`,
      fixable: !value,
      fixAction: value ? undefined : "regenerate-env",
    });
  }

  if (values.get("AUTH_SECRET") === "change-me-in-production-use-openssl-rand-base64-32") {
    checks.push({
      id: "env-auth-secret-default",
      ok: false,
      message: "AUTH_SECRET still uses the placeholder value.",
      fixable: true,
      fixAction: "regenerate-auth-secret",
    });
  }

  return checks;
}

function checkDatabase(dbPath: string): DoctorCheck {
  if (!fileExists(dbPath)) {
    return {
      id: "database",
      ok: false,
      message: "Database file is missing. Migrations may need to run.",
      fixable: true,
      fixAction: "migrate",
    };
  }

  return { id: "database", ok: true, message: "Database file exists." };
}

function checkMigrations(appRoot: string): DoctorCheck {
  const migrationsDir = path.join(appRoot, "packages", "database", "prisma", "migrations");
  if (!fileExists(migrationsDir)) {
    return {
      id: "migrations",
      ok: false,
      message: "Migration directory is missing from the installation.",
      fixable: true,
      fixAction: "reinstall",
    };
  }

  try {
    execSync(
      "pnpm --filter @uwe/database exec prisma migrate status --schema prisma/schema.prisma",
      {
        cwd: appRoot,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        shell: process.platform === "win32" ? "cmd.exe" : undefined,
      },
    );
    return { id: "migrations", ok: true, message: "Database migrations are up to date." };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: "migrations",
      ok: false,
      message: `Migration status check failed: ${message}`,
      fixable: true,
      fixAction: "migrate",
    };
  }
}

export interface DoctorOptions {
  installRoot: string;
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const paths = resolveInstallPaths(options.installRoot);
  const ports = defaultPortConfig();
  const existing = detectExistingInstall(options.installRoot);
  const state = readInstallerState(paths.stateFile);
  const checks: DoctorCheck[] = [];

  const nodeVersion = getNodeVersion();
  checks.push({
    id: "node",
    ok: Boolean(nodeVersion && Number.parseInt(nodeVersion.replace(/\D/g, ""), 10) >= 20),
    message: nodeVersion ? `Node.js ${nodeVersion}` : "Node.js is not installed or not in PATH.",
    fixable: !nodeVersion,
    fixAction: nodeVersion ? undefined : "install-node-hint",
  });

  const pnpmVersion = getPnpmVersion();
  checks.push({
    id: "pnpm",
    ok: Boolean(pnpmVersion && Number.parseInt(pnpmVersion, 10) >= 10),
    message: pnpmVersion ? `pnpm ${pnpmVersion}` : "pnpm is not installed or not in PATH.",
    fixable: !pnpmVersion,
    fixAction: !pnpmVersion ? "install-pnpm" : undefined,
  });

  const pnpmPath = checkPnpmPath();
  checks.push({
    id: "pnpm-path",
    ok: pnpmPath.ok,
    message: pnpmPath.ok
      ? "pnpm global bin directory is in PATH."
      : pnpmPath.errors.join(" "),
    fixable: !pnpmPath.ok,
    fixAction: !pnpmPath.ok ? "repair-pnpm-path" : undefined,
  });

  const gitVersion = getGitVersion();
  checks.push({
    id: "git",
    ok: true,
    message: gitVersion ? `Git ${gitVersion}` : "Git not found (optional for release installs).",
  });

  const portCheck = await checkPorts(ports.studioPort, ports.portalPort, ports.studioHost);
  checks.push({
    id: "ports",
    ok: portCheck.ok,
    message: portCheck.ok
      ? `Ports ${ports.studioPort} and ${ports.portalPort} are available.`
      : `Ports in use: ${portCheck.busy.join(", ")}`,
    fixable: false,
  });

  checks.push({
    id: "write-access",
    ok: canWriteDirectory(paths.root),
    message: canWriteDirectory(paths.root)
      ? "Install directory is writable."
      : `Cannot write to ${paths.root}`,
    fixable: false,
  });

  if (existing.installed) {
    checks.push({
      id: "installation",
      ok: existing.hasApp,
      message: existing.hasApp
        ? `UWE installed at ${paths.root}`
        : "Installation state found but app files are missing.",
      fixable: !existing.hasApp,
      fixAction: !existing.hasApp ? "reinstall" : undefined,
    });

    if (existing.hasApp) {
      checks.push(checkBuildOutput(paths.app));
    }

    checks.push(...checkEnvValues(paths.envFile));
    checks.push(checkDatabase(path.join(paths.data, "uwe.db")));

    if (existing.hasApp) {
      checks.push(checkMigrations(paths.app));
    }
  } else {
    checks.push({
      id: "installation",
      ok: false,
      message: "UWE is not installed yet.",
      fixable: true,
      fixAction: "install",
    });
  }

  const failed = checks.filter((check) => !check.ok);
  const fixable = failed.filter((check) => check.fixable);

  return {
    ok: failed.length === 0,
    checks,
    summary: failed.length === 0
      ? "All checks passed."
      : `${failed.length} issue(s) found, ${fixable.length} can be repaired automatically.`,
    installRoot: paths.root,
    uweVersion: existing.uweVersion ?? state?.uweVersion,
    details: {
      existing,
      paths,
    },
  };
}

export function formatDoctorResult(result: DoctorResult): string {
  const lines = [result.summary, ""];

  for (const check of result.checks) {
    const icon = check.ok ? "[OK]" : "[FAIL]";
    lines.push(`${icon} ${check.message}`);
    if (!check.ok && check.fixAction) {
      lines.push(`     Fix: ${check.fixAction}`);
    }
  }

  return lines.join("\n");
}

export function doctorToCommandResult(result: DoctorResult): CommandResult {
  return {
    ok: result.ok,
    message: formatDoctorResult(result),
    details: result as unknown as Record<string, unknown>,
  };
}
