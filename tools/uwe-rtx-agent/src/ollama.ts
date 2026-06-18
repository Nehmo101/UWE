import type { AgentConfig } from "./config.js";
import type { ChatMessage, ChatRequest, ChatResponse } from "./types.js";

export async function checkOllamaReachable(
  baseUrl: string,
  timeoutMs: number,
): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${trimTrailingSlash(baseUrl)}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function resolveOllamaModel(
  baseUrl: string,
  preferredModel: string,
  timeoutMs: number,
): Promise<string> {
  try {
    const response = await fetchWithTimeout(`${trimTrailingSlash(baseUrl)}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return preferredModel;
    }

    const payload = (await response.json()) as {
      models?: Array<{ name?: string }>;
    };
    const names = payload.models?.map((entry) => entry.name).filter(Boolean) as string[] | undefined;
    if (!names?.length) {
      return preferredModel;
    }

    const exact = names.find((name) => name === preferredModel || name.startsWith(`${preferredModel}:`));
    return exact ?? names[0] ?? preferredModel;
  } catch {
    return preferredModel;
  }
}

export async function chatWithOllama(
  config: AgentConfig,
  request: ChatRequest,
): Promise<ChatResponse> {
  const model = request.model?.trim() || config.defaultModel;
  const body = {
    model,
    messages: request.messages,
    stream: false,
    options: request.options ?? {},
  };

  const response = await fetchWithTimeout(`${trimTrailingSlash(config.ollamaBaseUrl)}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  if (!response.ok) {
    const detail = await safeReadText(response);
    throw new OllamaError(
      `Ollama chat failed (${response.status})`,
      detail || "Backend returned an error",
    );
  }

  const payload = (await response.json()) as ChatResponse;
  return payload;
}

export class OllamaError extends Error {
  constructor(
    message: string,
    readonly detail: string,
  ) {
    super(message);
    this.name = "OllamaError";
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init);
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function summarizeMessages(messages: ChatMessage[]): string {
  return messages.map((message) => `${message.role}:${message.content.length}`).join(", ");
}

export interface OllamaModelInfo {
  name: string;
  size?: number;
}

export async function listOllamaModels(
  baseUrl: string,
  timeoutMs: number,
): Promise<OllamaModelInfo[]> {
  const response = await fetchWithTimeout(`${trimTrailingSlash(baseUrl)}/api/tags`, {
    method: "GET",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new OllamaError(`Ollama tags failed (${response.status})`, await safeReadText(response));
  }
  const payload = (await response.json()) as {
    models?: Array<{ name?: string; size?: number }>;
  };
  return (
    payload.models
      ?.filter((entry) => entry.name)
      .map((entry) => ({ name: entry.name as string, size: entry.size })) ?? []
  );
}

export async function pullOllamaModel(
  baseUrl: string,
  model: string,
  timeoutMs: number,
): Promise<void> {
  const response = await fetchWithTimeout(`${trimTrailingSlash(baseUrl)}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new OllamaError(`Ollama pull failed (${response.status})`, await safeReadText(response));
  }
}

export async function deleteOllamaModel(
  baseUrl: string,
  model: string,
  timeoutMs: number,
): Promise<void> {
  const response = await fetchWithTimeout(`${trimTrailingSlash(baseUrl)}/api/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: model }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new OllamaError(`Ollama delete failed (${response.status})`, await safeReadText(response));
  }
}
