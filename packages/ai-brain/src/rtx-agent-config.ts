// RTX worker URL/config resolver (`RTX_AGENT_URL` / `RTX_BASE_URL`).
// The legacy inbound RTX *Agent* LLM client/provider was removed — ai-brain inference
// now uses direct Ollama/LM Studio (`AI_INFERENCE_BASE_URL`) and the outbound RTX Host
// Connector. This module remains because the RTX worker security boundary
// (`@uwe/security` rtx-boundary) and the RTX worker (image) path still resolve and
// LAN-validate the worker URL through it. See docs/removed-legacy-runtime.md.
import { assertInferenceUrlAllowed, classifyInferenceUrl, type InferenceUrlKind } from "./inference-url-guard";

export type RtxAgentStatus = "ready" | "disabled" | "starting" | "error" | "unreachable";

export interface RtxAgentConfig {
  url: string;
  token: string;
  timeoutMs: number;
  preferredModel?: string;
}

export interface RtxAgentHealthPayload {
  status: RtxAgentStatus;
  enabled: boolean;
  message: string;
  model?: string;
  backend?: string;
}

export interface RtxAgentUrlEvaluation {
  configured: boolean;
  url: string | null;
  urlAllowed: boolean;
  urlKind: InferenceUrlKind | null;
  blockReason: string | null;
}

export function evaluateRtxAgentUrl(env: NodeJS.ProcessEnv = process.env): RtxAgentUrlEvaluation {
  const rawUrl = env.RTX_AGENT_URL?.trim();
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
    const message = error instanceof Error ? error.message : "RTX-Agent-URL blockiert.";
    return {
      configured: true,
      url: rawUrl.replace(/\/$/, ""),
      urlAllowed: false,
      urlKind,
      blockReason: message,
    };
  }
}

export function resolveRtxAgentConfig(env: NodeJS.ProcessEnv = process.env): RtxAgentConfig | null {
  const evaluation = evaluateRtxAgentUrl(env);
  if (!evaluation.configured || !evaluation.url) {
    return null;
  }

  if (!evaluation.urlAllowed) {
    return null;
  }

  const timeoutMs = Number.parseInt(env.RTX_TIMEOUT_MS ?? "3000", 10);
  const token = env.RTX_AGENT_TOKEN?.trim() ?? "";

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

export function isRtxAgentConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RTX_AGENT_URL?.trim());
}
