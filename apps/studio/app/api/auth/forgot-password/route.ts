import { NextResponse } from "next/server";
import { createPrismaClient, requestPasswordReset } from "@uwe/database/server";
import { checkRateLimit, clientIpFromHeaders, RATE_LIMIT_PRESETS } from "@/src/lib/rate-limit";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim();

  if (!email) {
    return NextResponse.json({ error: "E-Mail ist erforderlich." }, { status: 400 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const rateKey = `studio-forgot-password:${ip}:${email.toLowerCase()}`;
  const rate = checkRateLimit(rateKey, RATE_LIMIT_PRESETS.passwordReset);
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
