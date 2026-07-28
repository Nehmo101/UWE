import { NextResponse } from "next/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailApi } from "@/src/lib/mail-api";

export async function GET(request: Request) {
  const auth = await requireBrainMailApi();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "50");

  const service = createMailPortalService(brainPrisma);
  const entries = await service.listAuditLog(Number.isFinite(limit) ? limit : 50);
  return NextResponse.json({ entries });
}
