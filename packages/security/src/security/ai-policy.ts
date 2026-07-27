import type { UweRole } from "@uwe/auth";

import { AiAccessDeniedError, AiPolicyViolationError } from "./errors";
import {
} from "./inference/privacy";
import type {} from "./inference/ai-context-types";
import { rejectClientWorkerUrl } from "./rtx-boundary";

export type AiAuthorizedRole = "owner" | "admin" | "dm";

const AI_AUTHORIZED_ROLES: ReadonlySet<string> = new Set(["owner", "admin", "dm"]);

const DEFAULT_MAX_PROMPT_LENGTH = 32_000;
const DEFAULT_MAX_CONTEXT_CHARS = 24_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 8_192;
const DEFAULT_RATE_LIMIT_MAX = 30;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitEntry {
  attempts: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_TRACKED_USERS = 10_000;

export interface AiAccessContext {
  /** Effective UWE role or extended admin alias. */
  role: UweRole | "admin" | "guest";
  /** Stable user identifier for rate limiting (IP, session id, or user id). */
  userKey?: string;
  /** Studio same-origin / API-token authenticated request — treated as DM-level. */
  studioTrusted?: boolean;
}

export interface AiRequestLimitsInput {
  prompt?: string;
  contextChars?: number;
  maxTokens?: number;
  model?: string;
  workerUrl?: string | null;
  fetchUrl?: string | null;
}


export function canUseAi(role: UweRole | "admin" | "guest"): boolean {
  return AI_AUTHORIZED_ROLES.has(role);
}

export function requireAiRole(ctx: AiAccessContext): void {
  const effectiveRole = resolveEffectiveAiRole(ctx);

  if (!canUseAi(effectiveRole)) {
    throw new AiAccessDeniedError(
      "KI-Funktionen sind nur für Owner, Admin und DM verfügbar.",
    );
  }
}

export function resolveEffectiveAiRole(ctx: AiAccessContext): UweRole | "admin" | "guest" {
  if (ctx.studioTrusted) {
    return "owner";
  }
  return ctx.role;
}

export function resolveAiPolicyLimits(env: NodeJS.ProcessEnv = process.env) {
  return {
    maxPromptLength: readPositiveInt(env.AI_MAX_PROMPT_LENGTH, DEFAULT_MAX_PROMPT_LENGTH),
    maxContextChars: readPositiveInt(
      env.AI_MAX_CONTEXT_CHARS ?? env.BRAIN_MAX_CONTEXT_CHARS,
      DEFAULT_MAX_CONTEXT_CHARS,
    ),
    maxOutputTokens: readPositiveInt(env.AI_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS),
    rateLimitMax: readPositiveInt(env.AI_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
    rateLimitWindowMs: readPositiveInt(env.AI_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
    allowedModels: parseAllowedModels(env.AI_ALLOWED_MODELS),
  };
}

export function checkAiRateLimit(
  userKey: string,
  env: NodeJS.ProcessEnv = process.env,
): { allowed: boolean; retryAfterSeconds: number } {
  const limits = resolveAiPolicyLimits(env);
  const now = Date.now();
  const windowStart = now - limits.rateLimitWindowMs;

  const entry = rateLimitStore.get(userKey) ?? { attempts: [] };
  const attempts = entry.attempts.filter((timestamp) => timestamp > windowStart);

  if (attempts.length >= limits.rateLimitMax) {
    const oldest = attempts[0]!;
    rateLimitStore.set(userKey, { attempts });
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + limits.rateLimitWindowMs - now) / 1000)),
    };
  }

  attempts.push(now);
  rateLimitStore.set(userKey, { attempts });

  if (rateLimitStore.size > MAX_TRACKED_USERS) {
    pruneRateLimitStore(windowStart);
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetAiRateLimit(userKey: string): void {
  rateLimitStore.delete(userKey);
}

export function validatePromptLength(prompt: string, env: NodeJS.ProcessEnv = process.env): void {
  const { maxPromptLength } = resolveAiPolicyLimits(env);
  if (prompt.length > maxPromptLength) {
    throw new AiPolicyViolationError(
      `Prompt überschreitet das Maximum von ${maxPromptLength} Zeichen (${prompt.length}).`,
    );
  }
}

export function validateContextSize(contextChars: number, env: NodeJS.ProcessEnv = process.env): void {
  const { maxContextChars } = resolveAiPolicyLimits(env);
  if (contextChars > maxContextChars) {
    throw new AiPolicyViolationError(
      `Kontext überschreitet das Maximum von ${maxContextChars} Zeichen (${contextChars}).`,
    );
  }
}

export function validateMaxOutputTokens(
  maxTokens: number | undefined,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (maxTokens === undefined) {
    return;
  }

  const { maxOutputTokens } = resolveAiPolicyLimits(env);
  if (maxTokens > maxOutputTokens) {
    throw new AiPolicyViolationError(
      `maxTokens überschreitet das Maximum von ${maxOutputTokens} (${maxTokens}).`,
    );
  }
}

export function assertModelAllowed(model: string | undefined, env: NodeJS.ProcessEnv = process.env): void {
  if (!model?.trim()) {
    return;
  }

  const { allowedModels } = resolveAiPolicyLimits(env);
  if (allowedModels.length === 0) {
    return;
  }

  const normalized = model.trim().toLowerCase();
  const allowed = allowedModels.some((entry) => entry.toLowerCase() === normalized);

  if (!allowed) {
    throw new AiPolicyViolationError(
      `Modell „${model}" ist nicht erlaubt. Erlaubte Modelle: ${allowedModels.join(", ")}`,
    );
  }
}

export function enforceAiRequestLimits(
  input: AiRequestLimitsInput,
  env: NodeJS.ProcessEnv = process.env,
): void {
  rejectClientWorkerUrl(input.workerUrl, env);

  if (input.prompt !== undefined) {
    validatePromptLength(input.prompt, env);
  }

  if (input.contextChars !== undefined) {
    validateContextSize(input.contextChars, env);
  }

  if (input.maxTokens !== undefined) {
    validateMaxOutputTokens(input.maxTokens, env);
  }

  if (input.model !== undefined) {
    assertModelAllowed(input.model, env);
  }
}

export function enforceAiAccessPolicy(ctx: AiAccessContext, env: NodeJS.ProcessEnv = process.env): void {
  requireAiRole(ctx);

  const userKey = ctx.userKey?.trim() || "anonymous";
  const rate = checkAiRateLimit(userKey, env);

  if (!rate.allowed) {
    throw new AiPolicyViolationError(
      `KI-Rate-Limit erreicht. Erneut versuchen in ${rate.retryAfterSeconds}s.`,
    );
  }
}

export function sanitizeAiResponseForClient<T extends Record<string, unknown>>(payload: T): T {
  const sanitized: Record<string, unknown> = { ...payload };

  delete sanitized.systemPrompt;
  delete sanitized.apiKey;
  delete sanitized.token;
  delete sanitized.RTX_AGENT_TOKEN;
  delete sanitized.workerUrl;
  delete sanitized.baseUrl;

  if (typeof sanitized.promptContext === "string") {
    sanitized.promptContext = "[redacted]";
  }

  return sanitized as T;
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAllowedModels(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function pruneRateLimitStore(windowStart: number): void {
  for (const [key, entry] of rateLimitStore) {
    if (entry.attempts.every((timestamp) => timestamp <= windowStart)) {
      rateLimitStore.delete(key);
    }
  }
}

export { AiAccessDeniedError, AiPolicyViolationError } from "./errors";
