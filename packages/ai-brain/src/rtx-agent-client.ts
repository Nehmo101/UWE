import type { GenerateTextOptions, GenerateTextResult } from "./types";
import { AiProviderError } from "./types";
import {
  resolveRtxAgentConfig,
  type RtxAgentConfig,
  type RtxAgentHealthPayload,
  type RtxAgentStatus,
} from "./rtx-agent-config";

function authHeaders(config: RtxAgentConfig): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }
  return headers;
}

async function fetchAgentJson<T>(
  config: RtxAgentConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.url}${path}`, {
      ...init,
      headers: {
        ...authHeaders(config),
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new AiProviderError(
        "RTX-Agent: Zugriff verweigert (Token prüfen — RTX_AGENT_TOKEN muss mit AGENT_TOKEN übereinstimmen).",
        "ollama",
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new AiProviderError(
        `RTX-Agent antwortet mit HTTP ${response.status}: ${body.slice(0, 160)}`,
        "ollama",
      );
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiProviderError(
        `RTX-Agent unter ${config.url} antwortet nicht rechtzeitig (Timeout ${config.timeoutMs}ms).`,
        "ollama",
      );
    }
    throw new AiProviderError(
      `RTX-Agent unter ${config.url} nicht erreichbar. Agent aktivieren oder Netzwerk prüfen.`,
      "ollama",
    );
  } finally {
    clearTimeout(timeout);
  }
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

  const payload = await fetchAgentJson<{
    model: string;
    message: { role: string; content: string };
  }>(config, "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      model,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
    }),
  });

  return {
    text: payload.message.content,
    model: payload.model || model,
    provider: "ollama",
    finishReason: "stop",
  };
}
