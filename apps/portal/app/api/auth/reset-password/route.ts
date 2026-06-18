import { NextResponse } from "next/server";
import { requirePortalApiAuth } from "@/src/lib/portal-api-auth";
import { completePasswordReset, createPrismaClient } from "@uwe/database/server";
import { checkRateLimit, clientIpFromHeaders, RATE_LIMIT_PRESETS } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const authError = await requirePortalApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    email?: string;
    resetToken?: string;
    newPassword?: string;
  };

  const email = body.email?.trim();
  const resetToken = body.resetToken?.trim();
  const newPassword = body.newPassword;

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `portal-reset-password:${ip}:${email?.toLowerCase() ?? "unknown"}`;
  const rate = checkRateLimit(rateKey, RATE_LIMIT_PRESETS.passwordReset);
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
      email: email ?? "",
      resetToken: resetToken ?? "",
      newPassword: newPassword ?? "",
      request,
      surface: "portal",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      message: "Passwort wurde zurückgesetzt. Du kannst dich jetzt anmelden.",
    });
  } finally {
    await db.$disconnect();
  }
}
