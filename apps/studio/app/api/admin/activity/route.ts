import { NextResponse } from "next/server";
import {
  listUnifiedActivity,
  prisma,
  type UnifiedActivitySource,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") as UnifiedActivitySource | null;
  const worldId = searchParams.get("worldId") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");
  const from = searchParams.get("from");

  const result = await listUnifiedActivity(prisma, {
    source: source ?? undefined,
    worldId,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
    since: from ? new Date(from) : undefined,
  });

  return NextResponse.json({
    entries: result.entries.map((entry) => ({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    })),
    total: result.total,
  });
}
