import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createDndApiService,
  DndApiError,
  getAppRepository,
  prisma,
  resolveDndApiConfig,
} from "@uwe/database/server";
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

// Handler = Guard + Zod + Dispatch. Cache-Schlüssel, dndbeyond-Regel und
// Encounter-Logik leben im DndApiService (packages/database).

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
    const { data, cached } = await dndApi.getMonsterWithCache(slug, config);
    return NextResponse.json({ data, cached });
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
    return NextResponse.json({ results: [], beyondReferences, config });
  }

  const { results, cached } = await dndApi.searchWithCache(query, config);
  return NextResponse.json({ results, beyondReferences, cached, config });
}

export async function POST(request: Request) {
  // Rate-Limit „search": jeder POST-Zweig kann externe Open5e-Calls auslösen.
  const authError = await guardStudioApiRequest(request, { rateLimit: "search" });
  if (authError) return authError;

  const parsed = await parseBody(request, dndApiPostSchema);
  if (!parsed.success) return parsed.response;

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(parsed.data.worldSlug);
  if (!world) {
    return jsonError("Welt nicht gefunden.", 404);
  }

  const config = resolveDndApiConfig();
  const dndApi = createDndApiService(prisma);

  try {
    switch (parsed.data.action) {
      case "add_beyond_reference": {
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
      case "import_statblock": {
        const result = await dndApi.importStatblock(
          repo,
          {
            worldId: world.id,
            worldSlug: world.slug,
            slug: parsed.data.slug,
            title: parsed.data.title,
          },
          config,
        );
        return NextResponse.json(result, { status: 201 });
      }
      case "generate_encounter": {
        const composition = await dndApi.generateEncounter(parsed.data, config);
        return NextResponse.json({ composition });
      }
      case "create_encounter": {
        const result = await dndApi.createEncounter(repo, {
          worldId: world.id,
          worldSlug: world.slug,
          title: parsed.data.title,
          partyLevel: parsed.data.partyLevel,
          partySize: parsed.data.partySize,
          monsters: parsed.data.monsters,
        });
        return NextResponse.json(result, { status: 201 });
      }
    }
  } catch (error) {
    if (error instanceof DndApiError) {
      return jsonError(error.message, 400);
    }
    throw error;
  }

  // Unerreichbar — das discriminatedUnion-Schema kennt genau die vier Aktionen.
  return jsonError("Unbekannte Aktion.", 400);
}
