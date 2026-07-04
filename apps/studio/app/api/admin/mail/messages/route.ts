import { NextResponse } from "next/server";
import { createMailPortalService, getSystemSettings, prisma } from "@uwe/database/server";
import type { MailPriorityCategory } from "@uwe/mail/portal-types";
import { requireAdminMailApi } from "@/src/lib/admin-mail-api";

export async function GET(request: Request) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") as MailPriorityCategory | null;
  const settings = await getSystemSettings(prisma);
  const requestedLimit = searchParams.get("limit");
  const limit = requestedLimit !== null ? Number(requestedLimit) : settings.mail.inboxLimit;

  const service = createMailPortalService(prisma);
  const messages = await service.searchMessages(
    {
      accountId,
      q,
      category: category ?? undefined,
      limit: Number.isFinite(limit) ? limit : settings.mail.inboxLimit,
    },
    auth.user?.id,
  );

  return NextResponse.json({ messages });
}
