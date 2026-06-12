import { NextResponse } from "next/server";
import {
  createPrismaClient,
  createShareLinkService,
  isShareLinkActive,
} from "@uwe/database/server";
import { shareAuthCookieOptions } from "@/src/lib/share-auth";
import { checkRateLimit, clientIpFromHeaders } from "@/src/lib/rate-limit";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;

  const ip = clientIpFromHeaders(request.headers);
  const rate = checkRateLimit(`share-verify:${ip}`, { maxAttempts: 10, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = (await request.json()) as { password?: string };
  const db = createPrismaClient();
  const shareService = createShareLinkService(db);

  try {
    const link = await shareService.getShareLinkByToken(token);
    if (!link || !isShareLinkActive(link)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!shareService.verifySharePassword(link, body.password ?? null)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(shareAuthCookieOptions(token));
    return response;
  } finally {
    await db.$disconnect();
  }
}
