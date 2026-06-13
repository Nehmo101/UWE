import fs from "node:fs";
import path from "node:path";

import { ensureAgentDataDir, getAgentLogDir } from "./paths.js";

const SECRET_PATTERNS = [
  /(agent_token\s*=\s*)([^\s\r\n]+)/gi,
  /(rtx_agent_token\s*=\s*)([^\s\r\n]+)/gi,
  /(authorization:\s*bearer\s+)([^\s\r\n]+)/gi,
  /(bearer\s+)([^\s\r\n]+)/gi,
  /("content"\s*:\s*")([^"]+)(")/gi,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (_match, prefix: string, _secret: string, suffix = "") => {
      return `${prefix}***REDACTED***${suffix}`;
    });
  }
  return result;
}

export function appendAgentLog(message: string): void {
  ensureAgentDataDir();
  const logFile = path.join(getAgentLogDir(), "agent.log");
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${redactSecrets(message)}\n`;
  fs.appendFileSync(logFile, line, "utf8");
}

export function readLogTail(maxLines = 200): string {
  const logFile = path.join(getAgentLogDir(), "agent.log");
  if (!fs.existsSync(logFile)) {
    return "";
  }

  const content = fs.readFileSync(logFile, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines.slice(-maxLines).join("\n");
}
