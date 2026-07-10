import { jsonError } from "@/src/lib/api-response";
import { cookies } from "next/headers";
import {
  createAuthService,
  createPrismaClient,
  createTwoFactorService,
} from "@uwe/database/server";
import {
  canAccessStudio,
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
  const body = (await request.json()) as { challengeToken?: string; code?: string };
  const challengeToken = body.challengeToken?.trim();
  const code = body.code?.trim();

  if (!challengeToken || !code) {
    return jsonError("Challenge-Token und Code sind erforderlich.", 400);
  }

  return completeTwoFactorLogin({
    request,
    challengeToken,
    code,
    rateKeyPrefix: "studio-2fa",
    createDb: createPrismaClient,
    createAuthService,
    createTwoFactorService,
    findUserById: (db, userId) => db.user.findUnique({ where: { id: userId } }),
    hasAccess: canAccessStudio,
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
  });
}
