import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createDndApiService,
  getAppRepository,
  prisma,
  resolveDndApiConfig,
  slugifyPageTitle,
  buildPageUrl,
} from "@uwe/database/server";
import {
  createEncounterPage,
  gatherEncounterCandidates,
  getOpen5eMonster,
  importOpen5eStatblockPage,
  listOpen5eMonstersByChallengeRating,
  searchAllDndApis,
  serializeEncounterComposition,
  suggestCandidateChallengeRatings,
  suggestEncounterComposition,
  type EncounterCandidate,
} from "@uwe/dnd-api";
import { idSchema, nonEmptyString, optionalString, parseBody, parseQuery, slugSchema } from "@uwe/security";
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

const importStatblockSchema = z.object({
  action: z.literal("import_statblock"),
  worldSlug: slugSchema,
  slug: slugSchema,
  title: optionalString,
  provider: z.literal("open5e").optional(),
});

const createEncounterSchema = z.object({
  action: z.literal("create_encounter"),
  worldSlug: slugSchema,
  title: optionalString,
  partyLevel: z.number().int().min(1).max(20).optional(),
  partySize: z.number().int().min(1).max(10).optional(),
  monsters: z
    .array(
      z.object({
        name: nonEmptyString.max(200),
        cr: optionalString,
        slug: slugSchema,
        count: z.number().int().min(1).max(24).optional(),
      }),
    )
    .min(1)
    .max(24),
});

const generateEncounterSchema = z.object({
  action: z.literal("generate_encounter"),
  worldSlug: slugSchema,
  partyLevel: z.number().int().min(1).max(20),
  partySize: z.number().int().min(1).max(10),
  difficulty: z.enum(["easy", "medium", "hard", "deadly"]),
  style: z.enum(["boss", "horde", "mixed"]).optional(),
});

const dndApiPostSchema = z.discriminatedUnion("action", [
  dndBeyondReferenceSchema,
  importStatblockSchema,
  createEncounterSchema,
  generateEncounterSchema,
]);

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
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
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const parsed = await parseBody(request, dndApiPostSchema);
  if (!parsed.success) return parsed.response;

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(parsed.data.worldSlug);
  if (!world) {
    return jsonError("Welt nicht gefunden.", 404);
  }

  if (parsed.data.action === "add_beyond_reference") {
    if (!parsed.data.url.includes("dndbeyond.com")) {
      return NextResponse.json(
        { error: "Nur D&D Beyond Links erlaubt — kein Scraping, nur manuelle Referenz." },
        { status: 400 },
      );
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

  if (parsed.data.action === "import_statblock") {
    const config = resolveDndApiConfig();
    const monster = await getOpen5eMonster(parsed.data.slug, {
      open5eEnabled: config.open5eEnabled,
      dnd5eSrdEnabled: config.dnd5eSrdEnabled,
    });

    const page = await importOpen5eStatblockPage(repo, {
      worldId: world.id,
      worldSlug: world.slug,
      open5eSlug: parsed.data.slug,
      title: parsed.data.title,
      monster,
      slugify: slugifyPageTitle,
    });

    return NextResponse.json(
      { page, editHref: `${buildPageUrl(world.slug, page.type, page.slug)}/edit` },
      { status: 201 },
    );
  }

  if (parsed.data.action === "generate_encounter") {
    const config = resolveDndApiConfig();
    if (!config.open5eEnabled) {
      return NextResponse.json(
        { error: "Open5e ist deaktiviert — Generator nicht verfügbar." },
        { status: 400 },
      );
    }

    const { partyLevel, partySize, difficulty, style } = parsed.data;
    const crBuckets = suggestCandidateChallengeRatings(partyLevel, partySize, difficulty);
    const dndApi = createDndApiService(prisma);

    const candidates = await gatherEncounterCandidates(crBuckets, async (cr) => {
      const cacheKey = `monsters-cr:${cr}`;
      const cached = await dndApi.getCached("open5e", cacheKey);
      if (Array.isArray(cached)) {
        return cached as unknown as EncounterCandidate[];
      }
      const monsters = await listOpen5eMonstersByChallengeRating(cr, {
        open5eEnabled: config.open5eEnabled,
      });
      await dndApi.setCached("open5e", cacheKey, monsters, config.cacheTtlSeconds);
      return monsters;
    });

    const composition = suggestEncounterComposition({
      partyLevel,
      partySize,
      difficulty,
      style,
      candidates,
    });

    return NextResponse.json({ composition: serializeEncounterComposition(composition) });
  }

  const page = await createEncounterPage(repo, {
    worldId: world.id,
    worldSlug: world.slug,
    title: parsed.data.title,
    partyLevel: parsed.data.partyLevel,
    partySize: parsed.data.partySize,
    monsters: parsed.data.monsters,
    slugify: slugifyPageTitle,
  });

  return NextResponse.json(
    { page, editHref: `${buildPageUrl(world.slug, page.type, page.slug)}/edit` },
    { status: 201 },
  );
}
