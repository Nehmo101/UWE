import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createTagService,
  ENTITY_TAG_ENTITY_TYPE_LABELS,
  getAppRepository,
  getTagCoverageStats,
  backfillEntityTagsFromJson,
  prisma,
  suggestTagMerges,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

function parseTagsInput(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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

  const tags = createTagService(prisma);
  const inventory = await tags.collectInventory(worldId ? { worldId } : {});
  const suggestions = suggestTagMerges(inventory);
  const unused = tags.findUnused(inventory);
  const similar = tags.findSimilarGroups(inventory);
  const coverage = await getTagCoverageStats(prisma, worldId ? { worldId } : {});

  const repo = getAppRepository();
  const worlds = await repo.listWorlds();

  return NextResponse.json({
    inventory,
    suggestions,
    unused,
    similar,
    coverage,
    entityTypeLabels: ENTITY_TAG_ENTITY_TYPE_LABELS,
    worlds: worlds.map((world) => ({
      id: world.id,
      name: world.name,
      slug: world.slug,
    })),
  });
}

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_write"],
  });
  if (authError) return authError;

  const body = (await request.json()) as {
    action?: string;
    worldId?: string | null;
    fromTags?: string[] | string;
    toTag?: string;
    dryRun?: boolean;
  };

  if (body.action !== "merge" && body.action !== "backfill") {
    return jsonError("Unsupported action", 400);
  }

  if (body.action === "backfill") {
    const result = await backfillEntityTagsFromJson(prisma, {
      worldId: body.worldId ?? undefined,
      dryRun: body.dryRun === true,
    });
    return NextResponse.json({ ok: true, result });
  }

  const toTag = String(body.toTag || "").trim();
  if (!toTag) {
    return jsonError("toTag is required", 400);
  }

  const fromTags = Array.isArray(body.fromTags)
    ? body.fromTags.map((tag) => String(tag).trim()).filter(Boolean)
    : parseTagsInput(body.fromTags);

  if (fromTags.length === 0) {
    return jsonError("fromTags is required", 400);
  }

  const tags = createTagService(prisma);
  const result = await tags.merge({
    worldId: body.worldId ?? undefined,
    fromTags,
    toTag,
  });

  return NextResponse.json({ ok: true, result });
}
