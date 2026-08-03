import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { resolveClientIp } from "@uwe/auth";
import {
  AiAccessDeniedError,
  AiPolicyViolationError,
  enforceAiAccessPolicy,
  enforceAiRequestLimits,
  EngineBoundaryError,
  SsrfBlockedError,
} from "@uwe/security";

import { requireStudioApiAuth } from "./studio-api-auth";

export function enforceStudioAiRoute(request: Request): Response | null {
  const authError = requireStudioApiAuth(request);
  if (authError) {
    return authError;
  }

  try {
    enforceAiAccessPolicy({
      studioAccess: true,
      studioTrusted: true,
      userKey: resolveClientIp(request.headers),
    });
  } catch (error) {
    return aiPolicyErrorResponse(error);
  }

  return null;
}

export function enforceStudioAiRequestLimits(input: {
  prompt?: string;
  contextChars?: number;
  maxTokens?: number;
  model?: string;
  workerUrl?: string | null;
  fetchUrl?: string | null;
}): NextResponse | null {
  try {
    enforceAiRequestLimits(input);
  } catch (error) {
    return aiPolicyErrorResponse(error);
  }

  return null;
}

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
