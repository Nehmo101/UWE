import { createHmac, timingSafeEqual } from "node:crypto";

import {
  assertInferenceUrlAllowed,
  classifyInferenceUrl,
} from "@uwe/ai-brain/inference-url-guard";
import {
  resolveRtxWorkerConfig,
  type RtxWorkerConfig,
} from "@uwe/ai-brain/rtx-worker-config";

export class RtxBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RtxBoundaryError";
  }
}

export interface RtxWorkerRequestOptions {
  path: string;
  method?: string;
  body?: string;
  signal?: AbortSignal;
}

export interface RtxWorkerBoundaryConfig {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  maxRetries: number;
  hmacSecret?: string;
}

const DEFAULT_MAX_RETRIES = 2;

export function resolveRtxBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  rejectClientWorkerUrl(undefined, env);
  const config = resolveRtxWorkerConfig(env);
  return config?.url ?? null;
}

export function rejectClientWorkerUrl(
  clientProvidedUrl?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (clientProvidedUrl?.trim()) {
    throw new RtxBoundaryError(
      "Worker-URLs dürfen nicht vom Client übergeben werden — RTX_BASE_URL kommt ausschließlich aus der Umgebung.",
    );
  }

  const rawUrl = env.RTX_BASE_URL?.trim() ?? env.RTX_AGENT_URL?.trim();
  if (!rawUrl) {
    return;
  }

  const allowPublicUrl = env.AI_INFERENCE_ALLOW_PUBLIC_URL === "true";
  assertInferenceUrlAllowed(rawUrl, allowPublicUrl);
}

export function resolveRtxWorkerBoundary(
  env: NodeJS.ProcessEnv = process.env,
): RtxWorkerBoundaryConfig | null {
  rejectClientWorkerUrl(undefined, env);

  const config = resolveRtxWorkerConfig(env);
  if (!config) {
    return null;
  }

  if (!config.token.trim()) {
    throw new RtxBoundaryError(
      "RTX_SERVICE_TOKEN fehlt — Service-Token zwischen UWE und RTX-Worker ist erforderlich (Legacy-Alias: RTX_AGENT_TOKEN).",
    );
  }

  const maxRetriesRaw = env.RTX_MAX_RETRIES?.trim();
  const maxRetriesParsed = maxRetriesRaw ? Number.parseInt(maxRetriesRaw, 10) : DEFAULT_MAX_RETRIES;
  const maxRetries =
    Number.isFinite(maxRetriesParsed) && maxRetriesParsed >= 0
      ? Math.min(maxRetriesParsed, 5)
      : DEFAULT_MAX_RETRIES;

  return {
    baseUrl: config.url,
    token: config.token,
    timeoutMs: config.timeoutMs,
    maxRetries,
    hmacSecret: env.RTX_HMAC_SECRET?.trim() || undefined,
  };
}

export function buildRtxWorkerAuthHeaders(
  boundary: RtxWorkerBoundaryConfig,
  body?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${boundary.token}`,
    "X-Agent-Token": boundary.token,
  };

  if (boundary.hmacSecret && body) {
    const signature = createHmac("sha256", boundary.hmacSecret).update(body).digest("hex");
    headers["X-UWE-Signature"] = signature;
  }

  return headers;
}

export function verifyRtxHmacSignature(
  body: string,
  providedSignature: string | undefined,
  secret: string,
): boolean {
  if (!providedSignature?.trim()) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const provided = providedSignature.trim();

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function fetchRtxWorker(
  boundary: RtxWorkerBoundaryConfig,
  options: RtxWorkerRequestOptions,
): Promise<Response> {
  const method = options.method ?? "GET";
  const url = `${boundary.baseUrl.replace(/\/$/, "")}${options.path}`;
  const body = options.body;

  let lastError: unknown;

  for (let attempt = 0; attempt <= boundary.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), boundary.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...buildRtxWorkerAuthHeaders(boundary, body),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        signal: options.signal ?? controller.signal,
      });

      clearTimeout(timeout);

      if (response.status >= 500 && attempt < boundary.maxRetries) {
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (attempt >= boundary.maxRetries) {
        break;
      }
    }
  }

  const kind = classifyInferenceUrl(boundary.baseUrl);
  throw new RtxBoundaryError(
    `RTX-Worker unter ${boundary.baseUrl} (${kind}) nicht erreichbar nach ${boundary.maxRetries + 1} Versuchen.` +
      (lastError instanceof Error ? ` ${lastError.message}` : ""),
  );
}

export function toRtxWorkerConfig(boundary: RtxWorkerBoundaryConfig): RtxWorkerConfig {
  return {
    url: boundary.baseUrl,
    token: boundary.token,
    timeoutMs: boundary.timeoutMs,
  };
}

/** @deprecated Use {@link toRtxWorkerConfig}. */
export const toRtxAgentConfig = toRtxWorkerConfig;
