import { NextResponse } from "next/server";
import { createMailPortalService, prisma } from "@uwe/database/server";
import type { MailPriorityCategory } from "@uwe/mail/portal-types";
import { requireAdminMailApi } from "@/src/lib/admin-mail-api";

export async function GET(request: Request) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") as MailPriorityCategory | null;
  const limit = Number(searchParams.get("limit") ?? "50");

  const service = createMailPortalService(prisma);
  const messages = await service.searchMessages(
    {
      accountId,
      q,
      category: category ?? undefined,
      limit: Number.isFinite(limit) ? limit : 50,
    },
    auth.user?.id,
  );

  return NextResponse.json({ messages });
}
