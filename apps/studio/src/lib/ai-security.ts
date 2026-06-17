import { NextResponse } from "next/server";
import { resolveClientIp } from "@uwe/auth";
import {
  AiAccessDeniedError,
  AiPolicyViolationError,
  enforceAiAccessPolicy,
  enforceAiRequestLimits,
  RtxBoundaryError,
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
      role: "owner",
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
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof AiPolicyViolationError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }

  if (error instanceof RtxBoundaryError || error instanceof SsrfBlockedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "KI-Anfrage blockiert." }, { status: 400 });
}
