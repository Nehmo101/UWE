import { NextResponse } from "next/server";
import {
  createPrismaClient,
  createShareLinkService,
} from "@uwe/database/server";
import { shareAuthCookieOptions } from "@/src/lib/share-auth";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const body = (await request.json()) as { password?: string };
  const db = createPrismaClient();
  const shareService = createShareLinkService(db);

  try {
    const link = await shareService.getShareLinkByToken(token);
    if (!link) {
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
