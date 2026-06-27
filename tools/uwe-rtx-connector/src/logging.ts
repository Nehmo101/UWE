/**
 * Connector logger. Never logs tokens or full job payloads — only job ids,
 * types and short statuses. Secrets must not reach the log stream.
 *
 * Beyond the console, an optional ring-buffer log file (in the client data dir)
 * keeps the last N lines so the desktop client can show recent activity. Lines
 * are tagged with a category (connection / models / downloads / jobs / error /
 * security) for filtering in the UI.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type LogLevel = "info" | "warn" | "error";

export const LOG_CATEGORIES = [
  "connection",
  "models",
  "downloads",
  "jobs",
  "error",
  "security",
] as const;

export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const CONNECTOR_LOG_FILENAME = "connector.log";
export const DEFAULT_LOG_RING_SIZE = 500;

export function connectorLogPath(dataDir: string): string {
  return join(dataDir, CONNECTOR_LOG_FILENAME);
}

function redact(value: string): string {
  return value.replace(/uwec_[A-Za-z0-9_-]+/g, "uwec_***");
}

interface FileSink {
  path: string;
  maxLines: number;
}

let fileSink: FileSink | null = null;
let ring: string[] = [];

/**
 * Point the logger at a ring-buffer file. Pass `null` to disable file logging
 * (the default). Existing lines in the file are loaded so the buffer survives
 * restarts. Best-effort: an unreadable file simply starts an empty buffer.
 */
export function configureConnectorLogFile(
  path: string | null,
  maxLines: number = DEFAULT_LOG_RING_SIZE,
): void {
  if (!path) {
    fileSink = null;
    ring = [];
    return;
  }
  fileSink = { path, maxLines: Math.max(1, maxLines) };
  try {
    ring = readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .slice(-fileSink.maxLines);
  } catch {
    ring = [];
  }
}

/** Snapshot of the in-memory log ring (oldest first). Mainly for tests/UI. */
export function readConnectorLogRing(): string[] {
  return [...ring];
}

function appendToRing(line: string): void {
  if (!fileSink) return;
  ring.push(line);
  if (ring.length > fileSink.maxLines) {
    ring = ring.slice(-fileSink.maxLines);
  }
  try {
    mkdirSync(dirname(fileSink.path), { recursive: true });
    writeFileSync(fileSink.path, `${ring.join("\n")}\n`, "utf8");
  } catch {
    // File logging is best-effort; never disrupt the work loop.
  }
}

function emit(
  level: LogLevel,
  category: LogCategory,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const time = new Date().toISOString();
  const suffix = meta ? ` ${redact(JSON.stringify(meta))}` : "";
  const line = `[${time}] [connector] [${category}] ${level.toUpperCase()} ${redact(message)}${suffix}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
  appendToRing(line);
}

export const log = {
  info: (message: string, meta?: Record<string, unknown>) =>
    emit("info", "connection", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    emit("warn", "connection", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    emit("error", "error", message, meta),
  /** Emit a line under an explicit category (connection/models/downloads/jobs/error/security). */
  event: (
    category: LogCategory,
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ) => emit(level, category, message, meta),
};
