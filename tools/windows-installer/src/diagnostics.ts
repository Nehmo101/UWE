import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseEnvFile } from "./config.js";
import { runDoctor } from "./doctor.js";
import { appendInstallLog, redactSecrets } from "./logging.js";
import { getSystemInfo } from "./pnpm-path.js";
import { resolveInstallPaths } from "./paths.js";
import { readInstallerState } from "./state.js";
import type { CommandResult } from "./types.js";

export function sanitizeEnvForExport(envFile: string): string {
  if (!fs.existsSync(envFile)) {
    return "# .env not found\n";
  }

  const values = parseEnvFile(fs.readFileSync(envFile, "utf8"));
  const lines: string[] = ["# Sanitized environment (secrets redacted)"];

  for (const [key, value] of values.entries()) {
    const isSecret =
      key.toLowerCase().includes("secret") ||
      key.toLowerCase().includes("token") ||
      key.toLowerCase().includes("password");

    lines.push(isSecret ? `${key}=***REDACTED***` : `${key}=${value}`);
  }

  return `${lines.join("\n")}\n`;
}

function collectLogFiles(logsDir: string): string[] {
  if (!fs.existsSync(logsDir)) {
    return [];
  }

  return fs
    .readdirSync(logsDir)
    .filter((name) => name.endsWith(".log"))
    .map((name) => path.join(logsDir, name))
    .filter((filePath) => fs.existsSync(filePath));
}

function createZipArchive(sourceDir: string, outputZip: string): void {
  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir.replace(/'/g, "''")}\\*' -DestinationPath '${outputZip.replace(/'/g, "''")}' -Force"`,
      { stdio: "inherit" },
    );
    return;
  }

  execSync(`cd "${sourceDir}" && zip -r "${outputZip}" .`, { stdio: "inherit" });
}

export interface DiagnosticsOptions {
  installRoot: string;
  dryRun?: boolean;
}

export async function createDiagnosticsPackage(
  options: DiagnosticsOptions,
): Promise<CommandResult> {
  const paths = resolveInstallPaths(options.installRoot);
  const dryRun = options.dryRun ?? false;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const workDir = path.join(os.tmpdir(), `uwe-diagnostics-${timestamp}`);
  const outputZip = path.join(paths.logs, `uwe-diagnostics-${timestamp}.zip`);

  if (dryRun) {
    return {
      ok: true,
      message: `Would create diagnostics package at ${outputZip}`,
    };
  }

  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(paths.logs, { recursive: true });

  const doctor = await runDoctor({ installRoot: options.installRoot });
  const state = readInstallerState(paths.stateFile);

  fs.writeFileSync(
    path.join(workDir, "system-info.json"),
    JSON.stringify(getSystemInfo(), null, 2),
    "utf8",
  );

  fs.writeFileSync(
    path.join(workDir, "doctor-report.json"),
    JSON.stringify(doctor, null, 2),
    "utf8",
  );

  fs.writeFileSync(
    path.join(workDir, "installer-state.json"),
    JSON.stringify(
      state
        ? {
            ...state,
            paths: { ...state.paths, envFile: "[redacted path only]" },
          }
        : { installed: false },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    path.join(workDir, "env-sanitized.txt"),
    sanitizeEnvForExport(paths.envFile),
    "utf8",
  );

  for (const logFile of collectLogFiles(paths.logs)) {
    const content = redactSecrets(fs.readFileSync(logFile, "utf8"));
    fs.writeFileSync(path.join(workDir, path.basename(logFile)), content, "utf8");
  }

  createZipArchive(workDir, outputZip);
  fs.rmSync(workDir, { recursive: true, force: true });

  appendInstallLog(paths.logs, `Diagnostics package created: ${outputZip}`);

  return {
    ok: true,
    message: `Diagnostics package created: ${outputZip}`,
    details: { outputZip },
  };
}
