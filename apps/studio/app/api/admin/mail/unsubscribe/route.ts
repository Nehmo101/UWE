import { NextResponse } from "next/server";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: { messageId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  if (!body.messageId) return mailApiError("messageId erforderlich.");

  const service = createMailPortalService(prisma);
  try {
    const outcome = await service.unsubscribeFromMessage(body.messageId, auth.user?.id);
    return NextResponse.json({ outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Abmeldung fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
