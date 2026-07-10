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
  canAccessStudio,
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
    surface: "studio",
    serverErrorLogLabel: "studio login",
    createDb: createPrismaClient,
    createAuthService,
    createTwoFactorService,
    findExistingUser: (db, normalizedEmail) =>
      db.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, status: true },
      }),
    hasAccess: canAccessStudio,
    clientIpFromHeaders,
    loginRateKey: (ip, normalizedEmail) => `studio-login:${ip}:${normalizedEmail}`,
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
