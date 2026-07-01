import { NextResponse } from "next/server";
import {
  getAppRepository,
  listUnifiedActivity,
  prisma,
  type UnifiedActivitySeverity,
  type UnifiedActivitySource,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

function parseSinceDays(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const days = Number.parseInt(raw, 10);
  if (!Number.isFinite(days) || days <= 0) return undefined;
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  return since;
}

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
  const worldSlug = searchParams.get("worldSlug") ?? undefined;
  const severity = searchParams.get("severity") as UnifiedActivitySeverity | null;
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");
  const from = searchParams.get("from");
  const sinceDays = searchParams.get("sinceDays");

  const result = await listUnifiedActivity(prisma, {
    source: source ?? undefined,
    worldId,
    worldSlug,
    severity: severity ?? undefined,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
    since: from ? new Date(from) : parseSinceDays(sinceDays),
  });

  const repo = getAppRepository();
  const worlds = await repo.listWorlds();

  return NextResponse.json({
    entries: result.entries.map((entry) => ({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    })),
    total: result.total,
    worlds: worlds.map((world) => ({
      id: world.id,
      name: world.name,
      slug: world.slug,
    })),
  });
}
