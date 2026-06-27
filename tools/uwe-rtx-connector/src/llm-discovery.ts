/**
 * Local LLM / generation provider discovery.
 *
 * Probes well-known local endpoints (Ollama, LM Studio, llama.cpp server) and
 * reports what is available. Everything is best-effort and offline-safe: if a
 * provider is not running, it is reported as `unavailable` rather than throwing.
 *
 * No world/brain data ever leaves the machine here — discovery only lists model
 * metadata exposed by the local server.
 */

import type { ModelScanPath } from "@uwe/connector-model-profile";

import { scanFilesystemModels } from "./filesystem-models";

export type ProviderStatus = "ready" | "unavailable" | "error";

export interface DiscoveredModel {
  provider: string;
  name: string;
  status: ProviderStatus;
  contextLength?: number;
  capabilities?: string[];
  /** Absolute path for filesystem (`.gguf`) models; undefined for API models. */
  path?: string;
  /** On-disk size in bytes for filesystem models, when known. */
  sizeBytes?: number;
}

export interface ProviderResult {
  provider: string;
  status: ProviderStatus;
  models: DiscoveredModel[];
  error?: string;
}

export interface DiscoveryConfig {
  ollamaUrl?: string;
  lmStudioUrl?: string;
  llamaCppUrl?: string;
  timeoutMs: number;
}

export function resolveDiscoveryConfig(env: NodeJS.ProcessEnv = process.env): DiscoveryConfig {
  return {
    ollamaUrl: env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434",
    lmStudioUrl: env.LM_STUDIO_BASE_URL?.trim() || "http://127.0.0.1:1234",
    llamaCppUrl: env.LLAMACPP_BASE_URL?.trim() || undefined,
    timeoutMs: 2500,
  };
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function discoverOllama(
  baseUrl: string,
  timeoutMs: number,
): Promise<ProviderResult> {
  try {
    const payload = await fetchJson<{ models?: Array<{ name?: string }> }>(
      `${trimSlash(baseUrl)}/api/tags`,
      timeoutMs,
    );
    const models = (payload.models ?? [])
      .map((entry) => entry.name?.trim())
      .filter((name): name is string => Boolean(name))
      .map<DiscoveredModel>((name) => ({
        provider: "ollama",
        name,
        status: "ready",
        capabilities: inferModelCapabilities(name),
      }));
    return { provider: "ollama", status: "ready", models };
  } catch (error) {
    return providerUnavailable("ollama", error);
  }
}

/** LM Studio and llama.cpp both expose an OpenAI-compatible /v1/models route. */
export async function discoverOpenAiCompatible(
  provider: string,
  baseUrl: string,
  timeoutMs: number,
): Promise<ProviderResult> {
  try {
    const payload = await fetchJson<{ data?: Array<{ id?: string }> }>(
      `${trimSlash(baseUrl)}/v1/models`,
      timeoutMs,
    );
    const models = (payload.data ?? [])
      .map((entry) => entry.id?.trim())
      .filter((id): id is string => Boolean(id))
      .map<DiscoveredModel>((name) => ({
        provider,
        name,
        status: "ready",
        capabilities: inferModelCapabilities(name),
      }));
    return { provider, status: "ready", models };
  } catch (error) {
    return providerUnavailable(provider, error);
  }
}

function providerUnavailable(provider: string, error: unknown): ProviderResult {
  const message = error instanceof Error ? error.message : String(error);
  // A connection refused / timeout is the normal "not running" case.
  const status: ProviderStatus = /timed out|fetch failed|ECONNREFUSED|HTTP 4|HTTP 5/i.test(message)
    ? "unavailable"
    : "error";
  return { provider, status, models: [], error: message.slice(0, 200) };
}

function inferModelCapabilities(name: string): string[] {
  const lower = name.toLowerCase();
  const caps: string[] = ["chat"];
  if (/embed|nomic|bge|minilm|gte/.test(lower)) {
    return ["embeddings"];
  }
  if (/llava|vision|-vl|bakllava|moondream/.test(lower)) {
    caps.push("vision");
  }
  return caps;
}

export interface LocalLlmSummary {
  providers: ProviderResult[];
  models: DiscoveredModel[];
  hasChat: boolean;
  hasEmbeddings: boolean;
  hasVision: boolean;
}

/** Map scanned `.gguf` files into a discovery `ProviderResult`. */
export function discoverFilesystemModels(
  scanPaths: readonly ModelScanPath[],
): ProviderResult {
  const models = scanFilesystemModels(scanPaths).map<DiscoveredModel>((file) => ({
    provider: "filesystem",
    name: file.name,
    status: "ready",
    path: file.path,
    sizeBytes: file.sizeBytes,
    capabilities:
      file.modelType === "embedding"
        ? ["embeddings"]
        : file.modelType === "vision"
          ? ["chat", "vision"]
          : ["chat"],
  }));
  return { provider: "filesystem", status: "ready", models };
}

export async function discoverLocalLlms(
  config: DiscoveryConfig,
  scanPaths: readonly ModelScanPath[] = [],
): Promise<LocalLlmSummary> {
  const tasks: Array<Promise<ProviderResult>> = [];
  if (config.ollamaUrl) {
    tasks.push(discoverOllama(config.ollamaUrl, config.timeoutMs));
  }
  if (config.lmStudioUrl) {
    tasks.push(discoverOpenAiCompatible("lmstudio", config.lmStudioUrl, config.timeoutMs));
  }
  if (config.llamaCppUrl) {
    tasks.push(discoverOpenAiCompatible("llamacpp", config.llamaCppUrl, config.timeoutMs));
  }

  const providers = await Promise.all(tasks);
  if (scanPaths.length > 0) {
    providers.push(discoverFilesystemModels(scanPaths));
  }
  const models = providers.flatMap((result) => result.models);

  return {
    providers,
    models,
    hasChat: models.some((model) => model.capabilities?.includes("chat")),
    hasEmbeddings: models.some((model) => model.capabilities?.includes("embeddings")),
    hasVision: models.some((model) => model.capabilities?.includes("vision")),
  };
}
