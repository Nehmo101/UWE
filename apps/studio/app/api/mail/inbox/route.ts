import { NextResponse } from "next/server";
import { createMailAccountService, getSystemSettings, prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const settings = await getSystemSettings(prisma);
  const requestedLimit = searchParams.get("limit");
  const limit = requestedLimit !== null ? Number(requestedLimit) : settings.mail.inboxLimit;

  const service = createMailAccountService(prisma);
  const messages = await service.listInbox(
    accountId,
    Number.isFinite(limit) ? limit : settings.mail.inboxLimit,
  );
  return NextResponse.json({ messages });
}
