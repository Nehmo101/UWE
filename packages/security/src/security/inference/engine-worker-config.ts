// Maschinenraum worker URL/config resolver (`ENGINE_BASE_URL` / `ENGINE_SERVICE_TOKEN`).
// The legacy inbound Maschinenraum *Agent* LLM client/provider was removed — ai-brain inference
// now uses direct Ollama/LM Studio (`AI_INFERENCE_BASE_URL`) and the outbound Maschinenraum.
// This module remains because the Maschinenraum worker security boundary
// (`@uwe/security` engine-boundary) and the Maschinenraum worker (image) path still resolve and
// LAN-validate the worker URL through it. See docs/removed-legacy-runtime.md.
//
// Lives in `@uwe/security` (low-level layer). `@uwe/ai-brain/engine-worker-config`
// re-exports these symbols so existing consumers keep working.
import { assertInferenceUrlAllowed, classifyInferenceUrl, type InferenceUrlKind } from "./inference-url-guard";

export type EngineWorkerStatus = "ready" | "disabled" | "starting" | "error" | "unreachable";

export interface EngineWorkerConfig {
  url: string;
  token: string;
  timeoutMs: number;
  preferredModel?: string;
}

export interface EngineWorkerHealthPayload {
  status: EngineWorkerStatus;
  enabled: boolean;
  message: string;
  model?: string;
  backend?: string;
}

export interface EngineWorkerUrlEvaluation {
  configured: boolean;
  url: string | null;
  urlAllowed: boolean;
  urlKind: InferenceUrlKind | null;
  blockReason: string | null;
}

export function evaluateEngineWorkerUrl(env: NodeJS.ProcessEnv = process.env): EngineWorkerUrlEvaluation {
  const rawUrl = env.ENGINE_BASE_URL?.trim();
  if (!rawUrl) {
    return {
      configured: false,
      url: null,
      urlAllowed: true,
      urlKind: null,
      blockReason: null,
    };
  }

  const allowPublicUrl = env.AI_INFERENCE_ALLOW_PUBLIC_URL === "true";
  const urlKind = classifyInferenceUrl(rawUrl);

  try {
    assertInferenceUrlAllowed(rawUrl, allowPublicUrl);
    return {
      configured: true,
      url: rawUrl.replace(/\/$/, ""),
      urlAllowed: true,
      urlKind,
      blockReason: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Maschinenraum-Worker-URL blockiert.";
    return {
      configured: true,
      url: rawUrl.replace(/\/$/, ""),
      urlAllowed: false,
      urlKind,
      blockReason: message,
    };
  }
}

export function resolveEngineWorkerConfig(env: NodeJS.ProcessEnv = process.env): EngineWorkerConfig | null {
  const evaluation = evaluateEngineWorkerUrl(env);
  if (!evaluation.configured || !evaluation.url) {
    return null;
  }

  if (!evaluation.urlAllowed) {
    return null;
  }

  const timeoutMs = Number.parseInt(env.ENGINE_TIMEOUT_MS ?? "3000", 10);
  const token = env.ENGINE_SERVICE_TOKEN?.trim() || "";

  if (!token) {
    return null;
  }

  return {
    url: evaluation.url,
    token,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3000,
    preferredModel: env.PREFERRED_LOCAL_MODEL?.trim() || undefined,
  };
}

export function isEngineWorkerConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ENGINE_BASE_URL?.trim());
}
