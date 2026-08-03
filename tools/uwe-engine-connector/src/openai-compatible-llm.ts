/**
 * OpenAI-compatible local LLM calls (LM Studio, llama.cpp server).
 */

export type OpenAiCompatibleProvider = "lmstudio" | "llamacpp";

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function openAiBaseUrl(baseUrl: string): string {
  const trimmed = trimSlash(baseUrl);
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function runOpenAiCompatibleChat(
  baseUrl: string,
  provider: OpenAiCompatibleProvider,
  payload: Record<string, unknown>,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const prompt = asString(payload.prompt);
  if (!prompt) {
    throw new Error("llm_generate: 'prompt' fehlt im Payload.");
  }
  const model = asString(payload.model, "local-model");
  const maxTokens = asNumber(payload.maxTokens);
  const messages: Array<{ role: string; content: string }> = [];
  const system = asString(payload.system);
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = { model, messages, stream: false };
  if (maxTokens != null) body.max_tokens = maxTokens;

  const response = await fetchImpl(`${openAiBaseUrl(baseUrl)}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${provider} chat HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? model,
    provider,
  };
}

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function runOpenAiCompatibleVision(
  baseUrl: string,
  provider: OpenAiCompatibleProvider,
  payload: Record<string, unknown>,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const prompt = asString(payload.prompt);
  if (!prompt) {
    throw new Error("vision_extract: 'prompt' fehlt im Payload.");
  }
  const images = Array.isArray(payload.images)
    ? payload.images.filter((image): image is string => typeof image === "string" && image.length > 0)
    : [];
  if (images.length === 0) {
    throw new Error("vision_extract: 'images' (Base64) fehlt im Payload.");
  }
  const model = asString(payload.model, "local-model");
  const maxTokens = asNumber(payload.maxTokens);
  const mimeType = asString(payload.mimeType, "image/jpeg");
  const content: OpenAiContentPart[] = [{ type: "text", text: prompt }];
  for (const image of images) {
    const url = image.startsWith("data:")
      ? image
      : `data:${mimeType};base64,${image}`;
    content.push({ type: "image_url", image_url: { url } });
  }

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content }],
    stream: false,
  };
  if (maxTokens != null) body.max_tokens = maxTokens;

  const response = await fetchImpl(`${openAiBaseUrl(baseUrl)}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${provider} vision HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? model,
    provider,
  };
}

export async function runOpenAiCompatibleEmbedding(
  baseUrl: string,
  provider: OpenAiCompatibleProvider,
  payload: Record<string, unknown>,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const input = asString(payload.input ?? payload.prompt);
  if (!input) {
    throw new Error("embedding_generate: 'input' fehlt im Payload.");
  }
  const model = asString(payload.model, "nomic-embed-text");

  const response = await fetchImpl(`${openAiBaseUrl(baseUrl)}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${provider} embeddings HTTP ${response.status}`);
  }
  const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  return {
    embedding: data.data?.[0]?.embedding ?? [],
    model,
    provider,
  };
}

export function resolveOpenAiCompatibleBaseUrl(
  provider: string,
  ctx: { lmStudioUrl?: string; llamaCppUrl?: string },
): string | null {
  if (provider === "lmstudio") return ctx.lmStudioUrl?.trim() || null;
  if (provider === "llamacpp") return ctx.llamaCppUrl?.trim() || null;
  return null;
}
