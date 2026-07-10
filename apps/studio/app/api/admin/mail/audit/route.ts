import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { requireAdminMailApi } from "@/src/lib/admin-mail-api";

export async function GET(request: Request) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "50");

  const service = createMailPortalService(prisma);
  const entries = await service.listAuditLog(Number.isFinite(limit) ? limit : 50);
  return NextResponse.json({ entries });
}
