import { NextResponse } from "next/server";
import {
  CONTENT_REVIEW_SOURCE_LABELS,
  CONTENT_REVIEW_STATUS_LABELS,
  createReviewService,
  prisma,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

function parseStatus(value: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  return value.trim();
}

function parseSourceType(value: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  return value.trim();
}

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const worldId = searchParams.get("worldId") ?? undefined;
  const status = parseStatus(searchParams.get("status")) ?? "pending";
  const sourceType = parseSourceType(searchParams.get("sourceType"));
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  const reviews = createReviewService(prisma);
  const [entries, pendingCount] = await Promise.all([
    reviews.list({
      worldId,
      status: status as "pending" | "approved" | "rejected" | "superseded",
      sourceType: sourceType as "ai_proposal" | "co_dm_change" | "player_note" | "portal_unlock" | undefined,
      limit,
      offset,
    }),
    reviews.countPending(worldId),
  ]);

  return NextResponse.json({
    entries,
    pendingCount,
    statusLabels: CONTENT_REVIEW_STATUS_LABELS,
    sourceLabels: CONTENT_REVIEW_SOURCE_LABELS,
  });
}
