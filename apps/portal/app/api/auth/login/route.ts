import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { cookies } from "next/headers";
import {
  auditRequestFromHeaders,
  createAuthService,
  createPrismaClient,
  createTwoFactorService,
  logLoginAttempt,
  resolveLoginFailureReason,
} from "@uwe/database/server";
import {
  canAccessPortal,
  getSessionCookieOptionsForRequest,
  performLoginFlow,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
  verifyTurnstileToken,
} from "@uwe/auth";
import {
  checkRateLimitAsync,
  clientIpFromHeaders,
  RATE_LIMIT_PRESETS,
  resetRateLimitAsync,
} from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    turnstileToken?: string;
  };

  return performLoginFlow({
    request,
    email: body.email?.trim(),
    password: body.password,
    turnstileToken: body.turnstileToken,
    surface: "portal",
    serverErrorLogLabel: "portal login",
    createDb: createPrismaClient,
    createAuthService,
    createTwoFactorService,
    findExistingUser: (db, normalizedEmail) =>
      db.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, status: true },
      }),
    // Only addresses with the Portal checkbox get in — there is no anonymous
    // and no „any active account" path left (Notiz Lasse, 2026-07-26).
    hasAccess: canAccessPortal,
    clientIpFromHeaders,
    loginRateKey: (ip, normalizedEmail) => `login:${ip}:${normalizedEmail}`,
    rateLimitOptions: RATE_LIMIT_PRESETS.login,
    checkRateLimitAsync,
    resetRateLimitAsync,
    verifyTurnstile: verifyTurnstileToken,
    setSessionCookie: async (token) => {
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, token, {
        ...getSessionCookieOptionsForRequest(request),
        expires: sessionExpiresAt(),
      });
    },
    auditRequestFromHeaders,
    logLoginAttempt,
    resolveLoginFailureReason,
  });
}
