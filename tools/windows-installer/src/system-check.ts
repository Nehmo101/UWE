import { execSync } from "node:child_process";
import os from "node:os";

import {
  MIN_FREE_DISK_BYTES,
  MIN_NODE_MAJOR,
  MIN_PNPM_MAJOR,
} from "./constants.js";
import { canWriteDirectory, getFreeDiskBytes, isWindows } from "./paths.js";
import { checkPorts } from "./ports.js";
import type { PortConfig, SystemCheckResult } from "./types.js";

function parseMajor(version: string): number | null {
  const match = version.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function commandOutput(command: string): string | null {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function getNodeVersion(): string | null {
  return commandOutput("node --version");
}

export function getPnpmVersion(): string | null {
  return commandOutput("pnpm --version");
}

export function getGitVersion(): string | null {
  return commandOutput("git --version");
}

export function getWindowsRelease(): string | null {
  if (!isWindows()) {
    return null;
  }

  return os.release();
}

export interface SystemCheckOptions {
  installRoot: string;
  ports: PortConfig;
  requireGit?: boolean;
}

export async function runSystemCheck(
  options: SystemCheckOptions,
): Promise<SystemCheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, string> = {};

  if (isWindows()) {
    const release = getWindowsRelease();
    details.windowsRelease = release ?? "unknown";

    const major = release ? Number.parseInt(release.split(".")[0], 10) : NaN;
    if (!Number.isFinite(major) || major < 10) {
      errors.push(
        "Windows 10 or newer is required. Detected release: " + (release ?? "unknown"),
      );
    }
  } else {
    warnings.push("System check is running outside Windows; some checks are approximate.");
  }

  const nodeVersion = getNodeVersion();
  details.node = nodeVersion ?? "missing";
  if (!nodeVersion) {
    errors.push(
      `Node.js ${MIN_NODE_MAJOR}+ is required but was not found in PATH. Install from https://nodejs.org/`,
    );
  } else {
    const major = parseMajor(nodeVersion);
    if (!major || major < MIN_NODE_MAJOR) {
      errors.push(
        `Node.js ${MIN_NODE_MAJOR}+ is required. Found: ${nodeVersion}`,
      );
    }
  }

  const pnpmVersion = getPnpmVersion();
  details.pnpm = pnpmVersion ?? "missing";
  if (!pnpmVersion) {
    errors.push(
      `pnpm ${MIN_PNPM_MAJOR}+ is required. Enable with: corepack enable && corepack prepare pnpm@latest --activate`,
    );
  } else {
    const major = parseMajor(pnpmVersion);
    if (!major || major < MIN_PNPM_MAJOR) {
      errors.push(`pnpm ${MIN_PNPM_MAJOR}+ is required. Found: ${pnpmVersion}`);
    }
  }

  const gitVersion = getGitVersion();
  details.git = gitVersion ?? "missing";
  if (options.requireGit && !gitVersion) {
    errors.push(
      "Git is required for clone/update mode. Install from https://git-scm.com/download/win",
    );
  } else if (!gitVersion) {
    warnings.push("Git was not found. Clone/update mode will not be available.");
  }

  const portCheck = await checkPorts(
    options.ports.studioPort,
    options.ports.portalPort,
    options.ports.studioHost,
  );
  details.ports = portCheck.ok ? "available" : `busy: ${portCheck.busy.join(", ")}`;
  if (!portCheck.ok) {
    errors.push(`Required ports are already in use: ${portCheck.busy.join(", ")}`);
  }

  const writable = canWriteDirectory(options.installRoot);
  details.writeAccess = writable ? "ok" : "denied";
  if (!writable) {
    errors.push(`No write access to install directory: ${options.installRoot}`);
  }

  const freeBytes = getFreeDiskBytes(options.installRoot);
  details.freeDisk = freeBytes === null ? "unknown" : String(freeBytes);
  if (freeBytes !== null && freeBytes < MIN_FREE_DISK_BYTES) {
    errors.push(
      `At least ${Math.round(MIN_FREE_DISK_BYTES / (1024 * 1024 * 1024))} GiB free disk space required.`,
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    details,
  };
}
