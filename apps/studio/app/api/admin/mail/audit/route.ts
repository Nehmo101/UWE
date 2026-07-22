import { NextResponse } from "next/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { requireAdminMailApi } from "@/src/lib/admin-mail-api";
import { brainPrisma } from "@uwe/database/brain-client";

export async function GET(request: Request) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "50");

  const service = createMailPortalService(brainPrisma);
  const entries = await service.listAuditLog(Number.isFinite(limit) ? limit : 50);
  return NextResponse.json({ entries });
}
