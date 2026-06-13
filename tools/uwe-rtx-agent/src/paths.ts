import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function getAgentDataDir(): string {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    return path.join(localAppData, "UWE-RTX-Agent");
  }
  return path.join(os.homedir(), ".uwe-rtx-agent");
}

export function getAgentLogDir(): string {
  return path.join(getAgentDataDir(), "logs");
}

export function getAgentStatePath(): string {
  return path.join(getAgentDataDir(), "state.json");
}

export function getAgentRoot(): string {
  const fromEnv = process.env.UWE_RTX_AGENT_ROOT?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..");
}

export function getEnvFilePath(): string {
  const fromEnv = process.env.UWE_RTX_AGENT_ENV?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.join(getAgentRoot(), ".env");
}

export function resolveAgentUrl(host: string, port: number): string {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  return `http://${displayHost}:${port}`;
}

export function isPublicBindHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "0.0.0.0" || normalized === "::";
}

export function ensureAgentDataDir(): void {
  fs.mkdirSync(getAgentDataDir(), { recursive: true });
  fs.mkdirSync(getAgentLogDir(), { recursive: true });
}

export function getWindowsStartupFolder(): string | null {
  if (!isWindows()) {
    return null;
  }

  const appData = process.env.APPDATA;
  if (!appData) {
    return null;
  }

  return path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
}
