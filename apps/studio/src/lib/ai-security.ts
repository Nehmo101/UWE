import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { resolveClientIp } from "@uwe/auth";
import type { ApiAuthContext, StudioGuardOptions } from "@uwe/security";
import {
  AiAccessDeniedError,
  AiPolicyViolationError,
  enforceAiAccessPolicy,
  EngineBoundaryError,
  SsrfBlockedError,
} from "@uwe/security";

import { guardStudioApiRequestWithContext } from "./studio-admin-auth";

/**
 * Der eine Guard für KI-Routen: CSRF/Rollen-Gate (mit Kontext), Rate-Limit
 * („ai" als Default) und die KI-Zugriffs-Policy in einem Aufruf.
 *
 * Ihn zu umgehen heißt, seinen Rumpf zu kopieren — genau das stand einmal
 * inline in der Image-Studio-Route und lief der Policy davon. Neue KI-Routen
 * nehmen diesen Helfer, nicht seine Einzelteile.
 */
export async function enforceStudioAiRoute(
  request: Request,
  options: StudioGuardOptions = {},
): Promise<
  { error: Response; context: null } | { error: null; context: ApiAuthContext }
> {
  const { error, context } = await guardStudioApiRequestWithContext(request, {
    rateLimit: "ai",
    ...options,
  });
  if (error) {
    return { error, context: null };
  }

  try {
    enforceAiAccessPolicy({
      studioAccess: true,
      studioTrusted: true,
      userKey: resolveClientIp(request.headers),
    });
  } catch (policyError) {
    return { error: aiPolicyErrorResponse(policyError), context: null };
  }

  return { error: null, context };
}

// `enforceStudioAiRequestLimits` (Response-wrappender Zwilling von
// `enforceAiRequestLimits`) ist gelöscht: generator-handlers und
// ai-prompt-handlers rufen die werfende Variante aus @uwe/security direkt auf,
// und ihre Aufrufer übersetzen Fehler zentral. Zwei offene Wege für dieselbe
// Prüfung waren der Bug, nicht das Feature.

export function aiPolicyErrorResponse(error: unknown): NextResponse {
  if (error instanceof AiAccessDeniedError) {
    return jsonError(error.message, 403);
  }

  if (error instanceof AiPolicyViolationError) {
    return jsonError(error.message, 429);
  }

  if (error instanceof EngineBoundaryError || error instanceof SsrfBlockedError) {
    return jsonError(error.message, 403);
  }

  if (error instanceof Error) {
    return jsonError(error.message, 400);
  }

  return jsonError("KI-Anfrage blockiert.", 400);
}
