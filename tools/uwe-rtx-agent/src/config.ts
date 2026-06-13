import { loadPersistedState } from "./state.js";

export interface AgentConfig {
  host: string;
  port: number;
  token: string;
  enabled: boolean;
  ollamaBaseUrl: string;
  defaultModel: string;
  startOllamaCommand?: string;
  logPrompts: boolean;
  allowedOrigins: string[];
  requestTimeoutMs: number;
}

const DEFAULT_PORT = 8787;
const DEFAULT_TIMEOUT_SECONDS = 120;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
}

function parsePort(value: string | undefined): number {
  const raw = value?.trim();
  if (!raw) {
    return DEFAULT_PORT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid AGENT_PORT: ${raw}`);
  }
  return parsed;
}

function parseTimeoutSeconds(value: string | undefined): number {
  const raw = value?.trim();
  if (!raw) {
    return DEFAULT_TIMEOUT_SECONDS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_SECONDS;
  }
  return Math.floor(parsed);
}

function parseOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return ["http://127.0.0.1:3000", "http://localhost:3000"];
  }
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeHost(value: string | undefined): string {
  const host = value?.trim() || "127.0.0.1";
  if (host === "0.0.0.0") {
    console.warn(
      "[uwe-rtx-agent] Warning: AGENT_HOST=0.0.0.0 exposes the agent on all interfaces. Prefer a private LAN IP or localhost.",
    );
  }
  return host;
}

function resolveEnabled(env: NodeJS.ProcessEnv, persistedEnabled: boolean): boolean {
  const inferenceFlag = env.AGENT_ENABLED?.trim().toLowerCase();
  if (inferenceFlag === "true") {
    return true;
  }
  if (inferenceFlag === "false") {
    return false;
  }
  return persistedEnabled;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const token = env.AGENT_TOKEN?.trim();
  if (!token) {
    throw new Error("AGENT_TOKEN is required. Set a shared secret in the environment.");
  }

  const startOllamaCommand = env.START_OLLAMA_COMMAND?.trim();
  const persisted = loadPersistedState();

  return {
    host: normalizeHost(env.AGENT_HOST),
    port: parsePort(env.AGENT_PORT),
    token,
    enabled: resolveEnabled(env, persisted.enabled),
    ollamaBaseUrl: env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434",
    defaultModel: env.DEFAULT_MODEL?.trim() || "llama3.2",
    startOllamaCommand: startOllamaCommand || undefined,
    logPrompts: parseBoolean(env.LOG_PROMPTS, false),
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    requestTimeoutMs: parseTimeoutSeconds(env.REQUEST_TIMEOUT_SECONDS) * 1000,
  };
}

export function setAgentEnabled(config: AgentConfig, enabled: boolean): void {
  config.enabled = enabled;
}
