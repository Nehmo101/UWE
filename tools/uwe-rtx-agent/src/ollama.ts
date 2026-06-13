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
