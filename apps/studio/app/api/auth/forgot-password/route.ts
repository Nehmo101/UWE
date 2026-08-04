import { NextResponse } from "next/server";
import { createPrismaClient, requestPasswordReset } from "@uwe/database/server";
import { forgotPasswordBodySchema, parseBody } from "@uwe/security";
import { checkRateLimitAsync, clientIpFromHeaders, RATE_LIMIT_PRESETS } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const parsed = await parseBody(request, forgotPasswordBodySchema);
  if (!parsed.success) return parsed.response;

  const { email } = parsed.data;

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `studio-forgot-password:${ip}:${email.toLowerCase()}`;
  const rate = await checkRateLimitAsync(rateKey, RATE_LIMIT_PRESETS.passwordReset);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const db = createPrismaClient();

  try {
    const result = await requestPasswordReset({
      db,
      email,
      request,
      surface: "studio",
    });

    return NextResponse.json(result);
  } finally {
    await db.$disconnect();
  }
}
