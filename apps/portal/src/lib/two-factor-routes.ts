import { NextResponse } from "next/server";
import {
  auditRequestFromHeaders,
  createPrismaClient,
  createTwoFactorService,
  logAuditEvent,
} from "@uwe/database/server";
import { createTwoFactorRouteHandlers } from "@uwe/auth";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { checkRateLimitAsync, clientIpFromHeaders } from "@/src/lib/rate-limit";

/**
 * Portal 2FA route handlers. The shared setup/activate/verify/disable flow lives
 * in `@uwe/auth` (`createTwoFactorRouteHandlers`); this file only injects the
 * Portal-specific auth guard (`requirePortalApiAuth`), the Portal error shape,
 * and the Portal rate-limit key prefix. The exported handler names are consumed
 * unchanged by the route files.
 */
function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

const handlers = createTwoFactorRouteHandlers({
  guard: (request) => requirePortalApiAuth(request),
  requireAuthedUser: (request) => getUserFromRequestCookieHeader(request.headers.get("cookie")),
  errorResponse: jsonError,
  rateKeyPrefix: "portal-2fa",
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
