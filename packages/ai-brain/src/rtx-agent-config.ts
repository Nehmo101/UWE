import { assertInferenceUrlAllowed } from "./inference-url-guard";

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

export function resolveRtxAgentConfig(env: NodeJS.ProcessEnv = process.env): RtxAgentConfig | null {
  const rawUrl = env.RTX_AGENT_URL?.trim();
  if (!rawUrl) {
    return null;
  }

  assertInferenceUrlAllowed(rawUrl, env.AI_INFERENCE_ALLOW_PUBLIC_URL === "true");

  const timeoutMs = Number.parseInt(env.RTX_TIMEOUT_MS ?? "3000", 10);

  return {
    url: rawUrl.replace(/\/$/, ""),
    token: env.RTX_AGENT_TOKEN?.trim() ?? "",
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 3000,
    preferredModel: env.PREFERRED_LOCAL_MODEL?.trim() || undefined,
  };
}

export function isRtxAgentConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RTX_AGENT_URL?.trim());
}
