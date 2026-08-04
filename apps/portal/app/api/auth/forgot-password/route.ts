import { NextResponse } from "next/server";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { requestPasswordReset } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { checkRateLimitAsync, clientIpFromHeaders, RATE_LIMIT_PRESETS } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim();

  if (!email) {
    return NextResponse.json({ error: "E-Mail ist erforderlich." }, { status: 400 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `portal-forgot-password:${ip}:${email.toLowerCase()}`;
  const rate = await checkRateLimitAsync(rateKey, RATE_LIMIT_PRESETS.passwordReset);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const db = getSharedPrismaClient();

  try {
    const result = await requestPasswordReset({
      db,
      email,
      request,
      surface: "portal",
    });

    return NextResponse.json(result);
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
}
