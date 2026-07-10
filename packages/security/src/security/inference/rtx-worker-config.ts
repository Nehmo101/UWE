// RTX worker URL/config resolver (`RTX_BASE_URL` / `RTX_SERVICE_TOKEN`).
// The legacy inbound RTX *Agent* LLM client/provider was removed — ai-brain inference
// now uses direct Ollama/LM Studio (`AI_INFERENCE_BASE_URL`) and the outbound RTX Host
// Connector. This module remains because the RTX worker security boundary
// (`@uwe/security` rtx-boundary) and the RTX worker (image) path still resolve and
// LAN-validate the worker URL through it. See docs/removed-legacy-runtime.md.
//
// Lives in `@uwe/security` (low-level layer). `@uwe/ai-brain/rtx-worker-config`
// re-exports these symbols so existing consumers keep working.
import { assertInferenceUrlAllowed, classifyInferenceUrl, type InferenceUrlKind } from "./inference-url-guard";

export type RtxWorkerStatus = "ready" | "disabled" | "starting" | "error" | "unreachable";

export interface RtxWorkerConfig {
  url: string;
  token: string;
  timeoutMs: number;
  preferredModel?: string;
}

export interface RtxWorkerHealthPayload {
  status: RtxWorkerStatus;
  enabled: boolean;
  message: string;
  model?: string;
  backend?: string;
}

export interface RtxWorkerUrlEvaluation {
  configured: boolean;
  url: string | null;
  urlAllowed: boolean;
  urlKind: InferenceUrlKind | null;
  blockReason: string | null;
}

export function evaluateRtxWorkerUrl(env: NodeJS.ProcessEnv = process.env): RtxWorkerUrlEvaluation {
  const rawUrl = env.RTX_BASE_URL?.trim();
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
    const message = error instanceof Error ? error.message : "RTX-Worker-URL blockiert.";
    return {
      configured: true,
      url: rawUrl.replace(/\/$/, ""),
      urlAllowed: false,
      urlKind,
      blockReason: message,
    };
  }
}

export function resolveRtxWorkerConfig(env: NodeJS.ProcessEnv = process.env): RtxWorkerConfig | null {
  const evaluation = evaluateRtxWorkerUrl(env);
  if (!evaluation.configured || !evaluation.url) {
    return null;
  }

  if (!evaluation.urlAllowed) {
    return null;
  }

  const timeoutMs = Number.parseInt(env.RTX_TIMEOUT_MS ?? "3000", 10);
  const token = env.RTX_SERVICE_TOKEN?.trim() || "";

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

export function isRtxWorkerConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RTX_BASE_URL?.trim());
}
