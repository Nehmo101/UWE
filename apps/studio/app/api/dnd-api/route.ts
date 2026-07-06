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
  analyzeEncounterXp,
  buildEncounterMarkdown,
  formatOpen5eMonsterAsMarkdown,
  getOpen5eMonster,
  listOpen5eMonstersByChallengeRating,
  searchAllDndApis,
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

async function resolveUniquePageSlug(worldSlug: string, title: string, suffix?: string) {
  const repo = getAppRepository();
  const base = slugifyPageTitle(suffix ? `${title}-${suffix}` : title);
  let candidate = base;
  let counter = 2;
  while (await repo.getPageBySlug(worldSlug, candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

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
    const monsterRecord = monster as Record<string, unknown>;
    const title =
      parsed.data.title?.trim() ||
      (typeof monsterRecord.name === "string" ? monsterRecord.name : parsed.data.slug);
    const markdown = formatOpen5eMonsterAsMarkdown(monster);
    const pageSlug = await resolveUniquePageSlug(world.slug, title, parsed.data.slug);

    const page = await repo.createPage({
      worldId: world.id,
      title,
      slug: pageSlug,
      type: "monster",
      visibility: "dm_only",
      publishStatus: "draft",
      summary: `Open5e Statblock (${parsed.data.slug})`,
      contentBlocks: [
        {
          type: "statblock",
          sortOrder: 0,
          content: markdown,
          visibility: "dm_only",
        },
      ],
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

    const candidates: EncounterCandidate[] = (
      await Promise.all(
        crBuckets.map(async (cr) => {
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
        }),
      )
    ).flat();

    const composition = suggestEncounterComposition({
      partyLevel,
      partySize,
      difficulty,
      style,
      candidates,
    });

    return NextResponse.json({
      composition: {
        style: composition.style,
        targetXp: composition.targetXp,
        capXp: composition.capXp,
        analysis: composition.analysis,
        monsters: composition.entries.map((entry) => ({
          name: entry.monster.name,
          slug: entry.monster.slug,
          cr: entry.monster.cr,
          count: entry.count,
        })),
      },
    });
  }

  const title = parsed.data.title?.trim() || "Encounter";
  const analysis =
    parsed.data.partyLevel && parsed.data.partySize
      ? analyzeEncounterXp({
          partyLevel: parsed.data.partyLevel,
          partySize: parsed.data.partySize,
          monsters: parsed.data.monsters.map((monster) => ({
            cr: monster.cr,
            count: monster.count ?? 1,
          })),
        })
      : undefined;
  const markdown = buildEncounterMarkdown(parsed.data.monsters, analysis);
  const pageSlug = await resolveUniquePageSlug(world.slug, title, "encounter");

  const page = await repo.createPage({
    worldId: world.id,
    title,
    slug: pageSlug,
    type: "encounter",
    visibility: "dm_only",
    publishStatus: "draft",
    summary: `${parsed.data.monsters.reduce((sum, monster) => sum + (monster.count ?? 1), 0)} Monster`,
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content: markdown,
        visibility: "dm_only",
      },
    ],
  });

  return NextResponse.json(
    { page, editHref: `${buildPageUrl(world.slug, page.type, page.slug)}/edit` },
    { status: 201 },
  );
}
