import fs from "node:fs";
import path from "node:path";

const SECRET_KEYS = [
  "AUTH_SECRET",
  "STUDIO_API_TOKEN",
  "SPOTIFY_CLIENT_SECRET",
  "SPOTIFY_ACCESS_TOKEN",
  "SPOTIFY_REFRESH_TOKEN",
  "password",
  "token",
  "secret",
];

export function redactSecrets(text: string): string {
  let result = text;

  for (const key of SECRET_KEYS) {
    const pattern = new RegExp(`(${key}\\s*=\\s*)([^\\s\\r\\n]+)`, "gi");
    result = result.replace(pattern, "$1***REDACTED***");
  }

  return result;
}

export function ensureLogDirectory(logDir: string): void {
  fs.mkdirSync(logDir, { recursive: true });
}

export function appendInstallLog(logDir: string, message: string): void {
  ensureLogDirectory(logDir);
  const logFile = path.join(logDir, "install.log");
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${redactSecrets(message)}\n`;
  fs.appendFileSync(logFile, line, "utf8");
}

export function appendRuntimeLog(logDir: string, message: string): void {
  ensureLogDirectory(logDir);
  const logFile = path.join(logDir, "launcher.log");
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${redactSecrets(message)}\n`;
  fs.appendFileSync(logFile, line, "utf8");
}

export function readLogTail(logFile: string, maxLines = 200): string {
  if (!fs.existsSync(logFile)) {
    return "";
  }

  const content = fs.readFileSync(logFile, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines.slice(-maxLines).join("\n");
}
