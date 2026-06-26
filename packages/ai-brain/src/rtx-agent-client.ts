import { createHmac } from "node:crypto";

import type { GenerateTextOptions, GenerateTextResult } from "./types";
import { AiProviderError } from "./types";
import {
  resolveRtxAgentConfig,
  type RtxAgentConfig,
  type RtxAgentHealthPayload,
  type RtxAgentStatus,
} from "./rtx-agent-config";

const DEFAULT_MAX_RETRIES = 2;

function authHeaders(config: RtxAgentConfig, body?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
    headers["X-Agent-Token"] = config.token;
  }

  const hmacSecret = process.env.RTX_HMAC_SECRET?.trim();
  if (hmacSecret && body) {
    headers["X-UWE-Signature"] = createHmac("sha256", hmacSecret).update(body).digest("hex");
  }

  return headers;
}

function resolveMaxRetries(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.RTX_MAX_RETRIES?.trim();
  if (!raw) {
    return DEFAULT_MAX_RETRIES;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MAX_RETRIES;
  }

  return Math.min(parsed, 5);
}

async function fetchAgentJson<T>(
  config: RtxAgentConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const body = typeof init.body === "string" ? init.body : undefined;
  const maxRetries = resolveMaxRetries();
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.url}${path}`, {
        ...init,
        headers: {
          ...authHeaders(config, body),
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 401 || response.status === 403) {
        throw new AiProviderError(
          "RTX-Agent: Zugriff verweigert (Token prüfen — RTX_AGENT_TOKEN muss mit AGENT_TOKEN übereinstimmen).",
          "ollama",
        );
      }

      if (response.status >= 500 && attempt < maxRetries) {
        continue;
      }

      if (!response.ok) {
        const responseBody = await response.text();
        throw new AiProviderError(
          `RTX-Agent antwortet mit HTTP ${response.status}: ${responseBody.slice(0, 160)}`,
          "ollama",
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof AiProviderError) {
        throw error;
      }

      lastError = error;

      if (attempt >= maxRetries) {
        break;
      }
    }
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new AiProviderError(
      `RTX-Agent unter ${config.url} antwortet nicht rechtzeitig (Timeout ${config.timeoutMs}ms).`,
      "ollama",
    );
  }

  throw new AiProviderError(
    `RTX-Agent unter ${config.url} nicht erreichbar nach ${maxRetries + 1} Versuchen.` +
      (lastError instanceof Error ? ` ${lastError.message}` : ""),
    "ollama",
  );
}

export async function fetchRtxAgentHealth(
  config: RtxAgentConfig = resolveRtxAgentConfig()!,
): Promise<RtxAgentHealthPayload> {
  try {
    const payload = await fetchAgentJson<{
      status: string;
      enabled: boolean;
      message: string;
      model?: string;
      backend?: string;
    }>(config, "/health");

    const status = normalizeAgentStatus(payload.status, payload.enabled);

    return {
      status,
      enabled: payload.enabled,
      message: payload.message,
      model: payload.model,
      backend: payload.backend,
    };
  } catch (error) {
    const message =
      error instanceof AiProviderError
        ? error.message
        : "RTX-Agent nicht erreichbar.";
    return {
      status: "unreachable",
      enabled: true,
      message,
    };
  }
}

function normalizeAgentStatus(raw: string, enabled: boolean): RtxAgentStatus {
  if (!enabled || raw === "disabled") {
    return "disabled";
  }
  if (raw === "ready") {
    return "ready";
  }
  if (raw === "starting") {
    return "starting";
  }
  if (raw === "error") {
    return "error";
  }
  return "unreachable";
}

export async function fetchRtxAgentModels(
  config: RtxAgentConfig = resolveRtxAgentConfig()!,
): Promise<string[]> {
  try {
    const payload = await fetchAgentJson<{ models?: Array<{ name?: string }> }>(
      config,
      "/api/models",
    );
    const names = (payload.models ?? [])
      .map((m) => m.name?.trim())
      .filter((n): n is string => Boolean(n));
    return names;
  } catch {
    return [];
  }
}

export async function chatViaRtxAgent(
  options: GenerateTextOptions,
  config: RtxAgentConfig = resolveRtxAgentConfig()!,
): Promise<GenerateTextResult> {
  const model = options.model || config.preferredModel || "llama3.2";
  const messages: Array<{ role: string; content: string }> = [];

  if (options.systemPrompt?.trim()) {
    messages.push({ role: "system", content: options.systemPrompt.trim() });
  }
  messages.push({ role: "user", content: options.prompt });

  const requestBody = JSON.stringify({
    messages,
    model,
    options: {
      temperature: options.temperature,
      num_predict: options.maxTokens,
    },
  });

  const payload = await fetchAgentJson<{
    model: string;
    message: { role: string; content: string };
  }>(config, "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });

  return {
    text: payload.message.content,
    model: payload.model || model,
    provider: "ollama",
    finishReason: "stop",
  };
}
