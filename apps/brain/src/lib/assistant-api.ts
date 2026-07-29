import { NextResponse } from "next/server";
import { requireSameOriginMutation } from "@uwe/security";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  getSystemSettings,
  prisma,
  resolveEffectiveUploadsPath,
  type PrismaClient,
} from "@uwe/database/server";
import { createBrainAssistantService, type AssistantRunnerDeps } from "@uwe/brain-assistant";
import { createApiKeyStoreFromEnv } from "@uwe/ai-brain";
import { requireBrainOwnerAuth } from "./owner-auth";
import { checkRateLimit, clientIpFromHeaders, RATE_LIMIT_PRESETS } from "./rate-limit";

/**
 * Shared preamble for every KI-Chat API route.
 *
 * Brain has no `guardStudioApiMutation` equivalent, so the same-origin check
 * that Studio gets for free has to be spelled out here — without it these
 * routes would be CSRF-open to any site the owner visits while logged in.
 */
export async function guardAssistantApi(
  request: Request,
  preset: keyof typeof RATE_LIMIT_PRESETS = "ai",
): Promise<Response | null> {
  // Jede Assistenz-Route beschäftigt den RTX-Host — Chat, Transkription,
  // Anhang-Auswertung gleichermassen. Deshalb hier pauschal `requireAi`.
  const authError = await requireBrainOwnerAuth({ requireAi: true });
  if (authError) return authError;

  const csrfError = requireSameOriginMutation(request);
  if (csrfError) return csrfError;

  const ip = clientIpFromHeaders(request.headers);
  const limit = checkRateLimit(`brain-assistant:${preset}:${ip}`, RATE_LIMIT_PRESETS[preset]);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  return null;
}

export function assistantError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function assistantService() {
  return createBrainAssistantService(brainPrisma);
}

export async function resolveUploadsRootForAssistant(): Promise<string> {
  return resolveEffectiveUploadsPath(await getSystemSettings());
}

/** Runner dependencies wired to the shared host + brain clients. */
export function assistantRunnerDeps(db: PrismaClient = prisma): AssistantRunnerDeps {
  return {
    db,
    brainDb: brainPrisma,
    createApiKeyStore: async () => createApiKeyStoreFromEnv(),
  };
}
