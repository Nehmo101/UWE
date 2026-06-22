import { NextResponse } from "next/server";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: { accountId?: string; limit?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  if (!body.accountId) return mailApiError("accountId erforderlich.");

  const service = createMailPortalService(prisma);
  try {
    const result = await service.syncAccount(body.accountId, auth.user?.id, body.limit ?? 50);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
