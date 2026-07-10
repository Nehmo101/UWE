import {
  auditRequestFromHeaders,
  createPrismaClient,
  createTwoFactorService,
  logAuditEvent,
} from "@uwe/database/server";
import { createTwoFactorRouteHandlers } from "@uwe/auth";
import { guardStudioMutation } from "@uwe/security";
import { jsonError } from "@/src/lib/api-response";
import { getUserFromRequestCookieHeader } from "@/src/lib/auth-session";
import { checkRateLimitAsync, clientIpFromHeaders } from "@/src/lib/rate-limit";

/**
 * Studio 2FA route handlers. The shared setup/activate/verify/disable flow lives
 * in `@uwe/auth` (`createTwoFactorRouteHandlers`); this file only injects the
 * Studio-specific auth guard (`guardStudioMutation` + `login` rate limit), the
 * Studio error shape (`jsonError`), and the Studio rate-limit key prefix. The
 * exported handler names are consumed unchanged by the route files.
 */
const handlers = createTwoFactorRouteHandlers({
  guard: (request) => guardStudioMutation(request, { rateLimit: "login" }),
  requireAuthedUser: (request) => getUserFromRequestCookieHeader(request.headers.get("cookie")),
  errorResponse: jsonError,
  rateKeyPrefix: "2fa",
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
