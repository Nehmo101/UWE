import { NextResponse } from "next/server";
import { createMailAccountService, prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "50");

  const service = createMailAccountService(prisma);
  const messages = await service.listInbox(accountId, Number.isFinite(limit) ? limit : 50);
  return NextResponse.json({ messages });
}
