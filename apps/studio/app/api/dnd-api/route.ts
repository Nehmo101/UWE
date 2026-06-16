import { NextResponse } from "next/server";
import {
  createDndApiService,
  getAppRepository,
  prisma,
  resolveDndApiConfig,
} from "@uwe/database/server";
import { getOpen5eMonster, searchAllDndApis } from "@uwe/dnd-api";
import {
  guardStudioMutation,
  idSchema,
  nonEmptyString,
  optionalString,
  parseBody,
  parseQuery,
  requireStudioApiAuth,
  slugSchema,
} from "@uwe/security";
import { z } from "zod";

const dndApiQuerySchema = z.object({
  worldSlug: slugSchema.optional(),
  q: optionalString,
  provider: optionalString,
  slug: optionalString,
});

const dndBeyondReferenceSchema = z.object({
  action: z.literal("add_beyond_reference"),
  worldSlug: slugSchema,
  title: nonEmptyString.max(500),
  url: nonEmptyString.max(2000),
  entityType: optionalString,
  notes: optionalString,
  pageId: idSchema.optional().nullable(),
});

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const parsed = parseQuery(request.url, dndApiQuerySchema);
  if (!parsed.success) return parsed.response;

  const { worldSlug, q, provider, slug } = parsed.data;
  const query = q ?? "";

  const config = resolveDndApiConfig();
  const dndApi = createDndApiService(prisma);

  if (slug && provider === "open5e") {
    const cacheKey = `monster:${slug}`;
    const cached = await dndApi.getCached("open5e", cacheKey);
    if (cached) return NextResponse.json({ data: cached, cached: true });

    const data = await getOpen5eMonster(slug, {
      open5eEnabled: config.open5eEnabled,
      dnd5eSrdEnabled: config.dnd5eSrdEnabled,
    });
    await dndApi.setCached("open5e", cacheKey, data, config.cacheTtlSeconds);
    return NextResponse.json({ data, cached: false });
  }

  let beyondReferences: unknown[] = [];
  if (worldSlug) {
    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (world) {
      beyondReferences = await dndApi.listBeyondReferences(world.id);
    }
  }

  if (!query.trim()) {
    return NextResponse.json({
      results: [],
      beyondReferences,
      config,
    });
  }

  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = await dndApi.getCached("open5e", cacheKey);
  if (cached && Array.isArray(cached)) {
    return NextResponse.json({ results: cached, beyondReferences, cached: true, config });
  }

  const results = await searchAllDndApis(query, {
    open5eEnabled: config.open5eEnabled,
    dnd5eSrdEnabled: config.dnd5eSrdEnabled,
  });

  await dndApi.setCached("open5e", cacheKey, results, config.cacheTtlSeconds);

  return NextResponse.json({ results, beyondReferences, cached: false, config });
}

export async function POST(request: Request) {
  const authError = guardStudioMutation(request);
  if (authError) return authError;

  const parsed = await parseBody(request, dndBeyondReferenceSchema);
  if (!parsed.success) return parsed.response;

  if (!parsed.data.url.includes("dndbeyond.com")) {
    return NextResponse.json(
      { error: "Nur D&D Beyond Links erlaubt — kein Scraping, nur manuelle Referenz." },
      { status: 400 },
    );
  }

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(parsed.data.worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
  }

  const dndApi = createDndApiService(prisma);
  const reference = await dndApi.createBeyondReference({
    worldId: world.id,
    pageId: parsed.data.pageId ?? null,
    title: parsed.data.title,
    url: parsed.data.url,
    entityType: parsed.data.entityType ?? null,
    notes: parsed.data.notes ?? null,
  });

  return NextResponse.json({ reference }, { status: 201 });
}
