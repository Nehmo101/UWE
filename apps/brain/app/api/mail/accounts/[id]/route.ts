import { NextResponse } from "next/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailMutation, mailApiError } from "@/src/lib/mail-api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireBrainMailMutation(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const service = createMailPortalService(brainPrisma);

  try {
    await service.deleteAccount(id, auth.user?.id);
    return NextResponse.json({ ok: true });
  } catch {
    return mailApiError("Konto konnte nicht gelöscht werden.", 404);
  }
}
