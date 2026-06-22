import { NextResponse } from "next/server";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const service = createMailPortalService(prisma);

  try {
    await service.deleteAccount(id, auth.user?.id);
    return NextResponse.json({ ok: true });
  } catch {
    return mailApiError("Konto konnte nicht gelöscht werden.", 404);
  }
}
