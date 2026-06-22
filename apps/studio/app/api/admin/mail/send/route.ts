import { NextResponse } from "next/server";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: { draftId?: string; confirm?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  if (!body.draftId) return mailApiError("draftId erforderlich.");
  if (body.confirm !== true) {
    return mailApiError("Versand erfordert confirm=true.", 400);
  }

  const service = createMailPortalService(prisma);
  try {
    const result = await service.sendDraft(body.draftId, true, auth.user?.id);
    return NextResponse.json(
      { ok: result.ok, logId: result.log.id, error: result.error ?? null },
      { status: result.ok ? 200 : 502 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Versand fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
