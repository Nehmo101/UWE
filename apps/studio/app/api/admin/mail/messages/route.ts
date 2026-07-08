import { NextResponse } from "next/server";
import { createMailPortalService, getSystemSettings, prisma } from "@uwe/database/server";
import type { MailPriorityCategory } from "@uwe/mail/portal-types";
import type { MailFolderKey, MailSearchCursor } from "@uwe/mail/portal";
import { requireAdminMailApi } from "@/src/lib/admin-mail-api";

export async function GET(request: Request) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") as MailPriorityCategory | null;
  const folder = (searchParams.get("folder") as MailFolderKey | null) ?? undefined;
  const settings = await getSystemSettings(prisma);
  const requestedLimit = searchParams.get("limit");
  const limit = requestedLimit !== null ? Number(requestedLimit) : settings.mail.inboxLimit;

  let cursor: MailSearchCursor | null = null;
  const cursorRaw = searchParams.get("cursor");
  if (cursorRaw) {
    try {
      const parsed = JSON.parse(cursorRaw) as MailSearchCursor;
      if (parsed?.receivedAt && parsed?.id) cursor = parsed;
    } catch {
      cursor = null;
    }
  }

  const service = createMailPortalService(prisma);
  const { items, nextCursor } = await service.searchMessages(
    {
      accountId,
      q,
      category: category ?? undefined,
      folder,
      cursor,
      limit: Number.isFinite(limit) ? limit : settings.mail.inboxLimit,
    },
    auth.user?.id,
  );

  return NextResponse.json({ messages: items, nextCursor });
}
