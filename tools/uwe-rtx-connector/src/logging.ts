/**
 * Minimal connector logger. Never logs tokens or full job payloads — only
 * job ids, types and short statuses. Secrets must not reach the log stream.
 */

export type LogLevel = "info" | "warn" | "error";

function redact(value: string): string {
  return value.replace(/uwec_[A-Za-z0-9_-]+/g, "uwec_***");
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const time = new Date().toISOString();
  const suffix = meta ? ` ${redact(JSON.stringify(meta))}` : "";
  const line = `[${time}] [connector] ${level.toUpperCase()} ${redact(message)}${suffix}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
};
