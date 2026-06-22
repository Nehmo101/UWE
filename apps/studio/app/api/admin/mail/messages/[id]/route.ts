import { NextResponse } from "next/server";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailApi, mailApiError } from "@/src/lib/admin-mail-api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const service = createMailPortalService(prisma);
  const message = await service.getMessage(id, auth.user?.id);
  if (!message) return mailApiError("Nachricht nicht gefunden.", 404);

  return NextResponse.json({ message });
}
