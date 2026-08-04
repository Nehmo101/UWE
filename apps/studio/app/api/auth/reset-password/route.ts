import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { completePasswordReset, createPrismaClient } from "@uwe/database/server";
import { parseBody, resetPasswordBodySchema } from "@uwe/security";
import { checkRateLimitAsync, clientIpFromHeaders, RATE_LIMIT_PRESETS } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const parsed = await parseBody(request, resetPasswordBodySchema);
  if (!parsed.success) return parsed.response;

  const { email, resetToken, newPassword } = parsed.data;

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `studio-reset-password:${ip}:${email.toLowerCase()}`;
  const rate = await checkRateLimitAsync(rateKey, RATE_LIMIT_PRESETS.passwordReset);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const db = createPrismaClient();

  try {
    const result = await completePasswordReset({
      db,
      email,
      resetToken,
      newPassword,
      request,
      surface: "studio",
    });

    if (!result.ok) {
      return jsonError(result.error, result.status);
    }

    return NextResponse.json({
      ok: true,
      message: "Passwort wurde zurückgesetzt. Du kannst dich jetzt anmelden.",
    });
  } finally {
    await db.$disconnect();
  }
}
