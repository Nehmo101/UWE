import { NextResponse } from "next/server";
import {
  createTagService,
  getAppRepository,
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

  const repo = getAppRepository();
  const worlds = await repo.listWorlds();

  return NextResponse.json({
    inventory,
    suggestions,
    unused,
    similar,
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
  };

  if (body.action !== "merge") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const toTag = String(body.toTag || "").trim();
  if (!toTag) {
    return NextResponse.json({ error: "toTag is required" }, { status: 400 });
  }

  const fromTags = Array.isArray(body.fromTags)
    ? body.fromTags.map((tag) => String(tag).trim()).filter(Boolean)
    : parseTagsInput(body.fromTags);

  if (fromTags.length === 0) {
    return NextResponse.json({ error: "fromTags is required" }, { status: 400 });
  }

  const tags = createTagService(prisma);
  const result = await tags.merge({
    worldId: body.worldId ?? undefined,
    fromTags,
    toTag,
  });

  return NextResponse.json({ ok: true, result });
}
