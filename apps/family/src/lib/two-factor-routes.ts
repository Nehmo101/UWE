import { NextResponse } from "next/server";
import {
  auditRequestFromHeaders,
  createPrismaClient,
  createTwoFactorService,
  logAuditEvent,
} from "@uwe/database/server";
import { createTwoFactorRouteHandlers } from "@uwe/auth";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";
import { checkRateLimitAsync, clientIpFromHeaders } from "@/src/lib/rate-limit";

/**
 * Family 2FA route handlers. Der gemeinsame Ablauf (setup/activate/verify/
 * disable) liegt in `@uwe/auth` (`createTwoFactorRouteHandlers`); diese Datei
 * reicht nur die Family-Teile hinein: den Häkchen-Guard, die Fehlerform und den
 * Präfix für die Rate-Limit-Schlüssel.
 *
 * Wichtig für den Alltag: wer ausschliesslich Family nutzt, richtet seine
 * Zwei-Faktor-Anmeldung damit hier ein — ohne je Portal oder Studio zu öffnen.
 */
function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

const handlers = createTwoFactorRouteHandlers({
  guard: (request) => requireFamilyApiAuth(request),
  requireAuthedUser: (request) => getUserFromRequestCookieHeader(request.headers.get("cookie")),
  errorResponse: jsonError,
  rateKeyPrefix: "family-2fa",
  clientIpFromHeaders,
  checkRateLimitAsync,
  createPrismaClient,
  createTwoFactorService,
  logAuditEvent,
  auditRequestFromHeaders,
});

export const {
  handleTwoFactorStatus,
  handleTwoFactorSetup,
  handleTwoFactorActivate,
  handleTwoFactorDisable,
} = handlers;
