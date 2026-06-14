import { NextResponse } from "next/server";
import {
  createDndApiService,
  getAppRepository,
  prisma,
  resolveDndApiConfig,
} from "@uwe/database/server";
import { getOpen5eMonster, searchAllDndApis } from "@uwe/dnd-api";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const worldSlug = url.searchParams.get("worldSlug");
  const query = url.searchParams.get("q") ?? "";
  const provider = url.searchParams.get("provider");
  const slug = url.searchParams.get("slug");

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
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    action?: "add_beyond_reference";
    worldSlug?: string;
    title?: string;
    url?: string;
    entityType?: string;
    notes?: string;
    pageId?: string;
  };

  if (body.action !== "add_beyond_reference") {
    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  }

  if (!body.worldSlug || !body.title?.trim() || !body.url?.trim()) {
    return NextResponse.json({ error: "worldSlug, title und url sind erforderlich." }, { status: 400 });
  }

  if (!body.url.includes("dndbeyond.com")) {
    return NextResponse.json(
      { error: "Nur D&D Beyond Links erlaubt — kein Scraping, nur manuelle Referenz." },
      { status: 400 },
    );
  }

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(body.worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Welt nicht gefunden." }, { status: 404 });
  }

  const dndApi = createDndApiService(prisma);
  const reference = await dndApi.createBeyondReference({
    worldId: world.id,
    pageId: body.pageId ?? null,
    title: body.title,
    url: body.url,
    entityType: body.entityType ?? null,
    notes: body.notes ?? null,
  });

  return NextResponse.json({ reference }, { status: 201 });
}
