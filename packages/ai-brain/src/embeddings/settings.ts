import type { BrainEmbeddingSettings, EmbeddingProviderId } from "./types";

const DEFAULT_MODEL = "nomic-embed-text";
const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT_SECONDS = 60;

export function resolveBrainEmbeddingSettings(
  overrides?: Partial<BrainEmbeddingSettings>,
): BrainEmbeddingSettings {
  const enabled =
    overrides?.enabled ??
    (process.env.BRAIN_EMBEDDINGS_ENABLED !== "false" &&
      process.env.BRAIN_EMBEDDINGS_ENABLED !== "0");

  const provider =
    overrides?.provider ??
    resolveProviderId(process.env.BRAIN_EMBEDDING_PROVIDER) ??
    "ollama";

  return {
    enabled,
    provider,
    model: overrides?.model ?? process.env.BRAIN_EMBEDDING_MODEL ?? DEFAULT_MODEL,
    baseUrl:
      overrides?.baseUrl ??
      process.env.BRAIN_EMBEDDING_BASE_URL ??
      process.env.AI_INFERENCE_BASE_URL ??
      process.env.OLLAMA_BASE_URL ??
      DEFAULT_BASE_URL,
    timeoutSeconds:
      overrides?.timeoutSeconds ??
      parsePositiveInt(process.env.BRAIN_EMBEDDING_TIMEOUT_SECONDS) ??
      parsePositiveInt(process.env.AI_INFERENCE_TIMEOUT_SECONDS) ??
      DEFAULT_TIMEOUT_SECONDS,
    store: "uwe-database",
  };
}

function resolveProviderId(value: string | undefined): EmbeddingProviderId | undefined {
  if (!value) return undefined;

  switch (value.trim().toLowerCase()) {
    case "ollama":
      return "ollama";
    case "openai_compatible":
    case "openai-compatible":
      return "openai_compatible";
    case "mock":
      return "mock";
    case "disabled":
    case "off":
    case "none":
      return "disabled";
    default:
      return undefined;
  }
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
