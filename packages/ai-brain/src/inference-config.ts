import type { AiProviderId } from "./types";
import {
  assertInferenceUrlAllowed,
  classifyInferenceUrl,
  isInferenceUrlAllowed,
  sanitizeInferenceEndpointLabel,
  type InferenceUrlKind,
} from "./inference-url-guard";

export type InferenceProviderKind = "ollama" | "openai_compatible";

export interface InferenceConfig {
  enabled: boolean;
  provider: InferenceProviderKind;
  providerId: AiProviderId;
  baseUrl: string;
  defaultModel: string;
  timeoutSeconds: number;
  timeoutMs: number;
  allowPublicUrl: boolean;
  apiKey?: string;
  urlAllowed: boolean;
  urlKind: InferenceUrlKind;
  endpointLabel: string;
  urlBlockReason?: string;
}

const DEFAULT_TIMEOUT_SECONDS = 120;

const PROVIDER_ALIASES: Record<string, InferenceProviderKind> = {
  ollama: "ollama",
  "openai-compatible": "openai_compatible",
  openai_compatible: "openai_compatible",
  "lm-studio": "openai_compatible",
  lmstudio: "openai_compatible",
};

function parseProvider(value: string | undefined): InferenceProviderKind {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "ollama";
  }
  return PROVIDER_ALIASES[normalized] ?? "ollama";
}

function resolveBaseUrl(provider: InferenceProviderKind): string {
  const unified = process.env.AI_INFERENCE_BASE_URL?.trim();
  if (unified) {
    return unified;
  }

  if (provider === "ollama") {
    return process.env.OLLAMA_BASE_URL?.trim() ?? "http://localhost:11434";
  }

  return process.env.OPENAI_COMPATIBLE_BASE_URL?.trim() ?? "http://localhost:8080/v1";
}

function resolveDefaultModel(provider: InferenceProviderKind): string {
  const unified = process.env.AI_INFERENCE_DEFAULT_MODEL?.trim();
  if (unified) {
    return unified;
  }

  if (provider === "ollama") {
    return "llama3.2";
  }

  return "local-model";
}

function resolveEnabled(): boolean {
  const inferenceFlag = process.env.AI_INFERENCE_ENABLED?.trim().toLowerCase();
  if (inferenceFlag === "true") {
    return true;
  }
  if (inferenceFlag === "false") {
    return false;
  }
  return process.env.AI_BRAIN_ENABLED !== "false";
}

function resolveProviderFromEnv(): InferenceProviderKind {
  const unified = process.env.AI_INFERENCE_PROVIDER?.trim();
  if (unified) {
    return parseProvider(unified);
  }

  const legacy = process.env.AI_DEFAULT_PROVIDER?.trim();
  if (legacy === "openai_compatible" || legacy === "openai-compatible") {
    return "openai_compatible";
  }

  return "ollama";
}

function resolveTimeoutSeconds(): number {
  const raw = process.env.AI_INFERENCE_TIMEOUT_SECONDS?.trim();
  if (!raw) {
    return DEFAULT_TIMEOUT_SECONDS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_SECONDS;
  }

  return Math.floor(parsed);
}

function resolveAllowPublicUrl(): boolean {
  return process.env.AI_INFERENCE_ALLOW_PUBLIC_URL?.trim().toLowerCase() === "true";
}

export function resolveInferenceConfig(
  overrides?: Partial<
    Pick<
      InferenceConfig,
      "enabled" | "provider" | "baseUrl" | "defaultModel" | "timeoutSeconds" | "allowPublicUrl" | "apiKey"
    >
  >,
): InferenceConfig {
  const provider = overrides?.provider ?? resolveProviderFromEnv();
  const baseUrl = overrides?.baseUrl ?? resolveBaseUrl(provider);
  const allowPublicUrl = overrides?.allowPublicUrl ?? resolveAllowPublicUrl();
  const urlKind = classifyInferenceUrl(baseUrl);
  const urlAllowed = isInferenceUrlAllowed(baseUrl, allowPublicUrl);

  let urlBlockReason: string | undefined;
  if (!urlAllowed) {
    urlBlockReason =
      `Öffentlicher Inference-Endpoint (${urlKind}) ist blockiert. ` +
      "Nutze eine private Heimnetz-IP oder localhost.";
  }

  return {
    enabled: overrides?.enabled ?? resolveEnabled(),
    provider,
    providerId: provider,
    baseUrl,
    defaultModel: overrides?.defaultModel ?? resolveDefaultModel(provider),
    timeoutSeconds: overrides?.timeoutSeconds ?? resolveTimeoutSeconds(),
    timeoutMs: (overrides?.timeoutSeconds ?? resolveTimeoutSeconds()) * 1000,
    allowPublicUrl,
    apiKey: overrides?.apiKey ?? process.env.AI_INFERENCE_API_KEY?.trim(),
    urlAllowed,
    urlKind,
    endpointLabel: sanitizeInferenceEndpointLabel(baseUrl),
    urlBlockReason,
  };
}

export function assertInferenceConfigUsable(config: InferenceConfig): void {
  if (!config.enabled) {
    throw new Error("RTX-Inference ist deaktiviert (AI_INFERENCE_ENABLED=false).");
  }

  assertInferenceUrlAllowed(config.baseUrl, config.allowPublicUrl);
}
