import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";
import { brainPrisma } from "@uwe/database/brain-client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const service = createMailPortalService(brainPrisma, prisma);

  try {
    await service.deleteAccount(id, auth.user?.id);
    return NextResponse.json({ ok: true });
  } catch {
    return mailApiError("Konto konnte nicht gelöscht werden.", 404);
  }
}
