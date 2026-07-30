import { NextResponse } from "next/server";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";
import { cookies } from "next/headers";
import {
  auditRequestFromHeaders,
  createAuthService,
  createPrismaClient,
  createTwoFactorService,
  logAuditEvent,
} from "@uwe/database/server";
import {
  completeTwoFactorLogin,
  getSessionCookieOptionsForRequest,
  SESSION_COOKIE_NAME,
  sessionExpiresAt,
} from "@uwe/auth";
import {
  checkRateLimitAsync,
  clientIpFromHeaders,
  RATE_LIMIT_PRESETS,
} from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const authError = await requireFamilyApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as { challengeToken?: string; code?: string };
  const challengeToken = body.challengeToken?.trim();
  const code = body.code?.trim();

  if (!challengeToken || !code) {
    return NextResponse.json({ error: "Challenge-Token und Code sind erforderlich." }, { status: 400 });
  }

  const auditRequest = auditRequestFromHeaders(request.headers);

  return completeTwoFactorLogin({
    request,
    challengeToken,
    code,
    rateKeyPrefix: "portal-2fa",
    createDb: createPrismaClient,
    createAuthService,
    createTwoFactorService,
    findUserById: (db, userId) => db.user.findUnique({ where: { id: userId } }),
    // Portal 2FA login accepts any active user; access is not role-gated.
    clientIpFromHeaders,
    rateLimitOptions: RATE_LIMIT_PRESETS.login,
    checkRateLimitAsync,
    setSessionCookie: async (token) => {
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, token, {
        ...getSessionCookieOptionsForRequest(request),
        expires: sessionExpiresAt(),
      });
    },
    onSuccessAudit: async ({ db, user, session }) => {
      await logAuditEvent(db, {
        actorUserId: user.id,
        action: "login_success",
        targetType: "session",
        targetId: session.id,
        request: auditRequest,
        metadata: { email: user.email, twoFactor: true },
      });
    },
  });
}
