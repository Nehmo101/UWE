"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createFactionStateService,
  createPrismaClient,
  getAppRepository,
  type Prisma,
} from "@uwe/database/server";
import {
  requireStudioActionAuth,
  requireStudioAiActionAuth,
} from "@/src/lib/studio-action-auth";
import { requireStudioContentEdit, requireStudioWorldEdit } from "@/src/lib/authz";
import { postGeneratorAction } from "@/src/lib/generator-handlers";

function editPath(worldSlug: string, category: string, pageSlug: string) {
  return `/worlds/${worldSlug}/${category}/${pageSlug}/edit`;
}

function parseOptionalJsonField(
  raw: string,
  label: string,
): Prisma.InputJsonValue | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as Prisma.InputJsonValue;
  } catch {
    throw new Error(`${label} muss gültiges JSON sein.`);
  }
}

export async function upsertFactionStateAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const pageId = String(formData.get("pageId"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));
  const agenda = String(formData.get("agenda") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const powerLevelRaw = String(formData.get("powerLevel") || "").trim();
  const powerLevel = powerLevelRaw ? Number(powerLevelRaw) : null;

  if (powerLevel !== null && (!Number.isFinite(powerLevel) || powerLevel < 0 || powerLevel > 10)) {
    throw new Error("Machtstufe muss zwischen 0 und 10 liegen.");
  }

  await requireStudioContentEdit(worldSlug, pageId);

  const db = createPrismaClient();
  try {
    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    const page = await repo.getPageById(pageId);
    if (!page || page.type !== "faction") {
      throw new Error("Fraktions-State ist nur für Fraktions-Seiten verfügbar.");
    }

    const factions = createFactionStateService(db);
    await factions.upsert({
      worldId: world.id,
      pageId,
      agenda,
      notes,
      powerLevel: powerLevel === null ? null : Math.floor(powerLevel),
      goals: parseOptionalJsonField(String(formData.get("goalsJson") || ""), "Ziele"),
      resources: parseOptionalJsonField(String(formData.get("resourcesJson") || ""), "Ressourcen"),
      relationships: parseOptionalJsonField(
        String(formData.get("relationshipsJson") || ""),
        "Beziehungen",
      ),
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?saved=1`);
}

/**
 * Zwischen-Session-Tick: startet simulate_faction für alle Fraktions-Seiten
 * der Welt. Ergebnisse landen als Review-pflichtige Vorschläge unter AI Runs
 * und werden erst nach Freigabe als WorldEvents in die Chronik übernommen.
 */
export async function simulateAllFactionsAction(formData: FormData) {
  await requireStudioAiActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const repo = getAppRepository();
  const pages = await repo.listPagesByWorld(worldSlug);
  const factionPages = pages.filter((page) => page.type === "faction");

  const useMock = process.env.AI_USE_MOCK === "true";
  let started = 0;

  for (const page of factionPages) {
    try {
      const response = await postGeneratorAction({
        actionId: "simulate_faction",
        worldSlug,
        pageSlug: page.slug,
        useMock,
      });
      if (response.ok || response.status === 202) {
        started += 1;
      }
    } catch {
      // Einzelne Fraktion überspringen — die restlichen weiter simulieren.
    }
  }

  revalidatePath(`/worlds/${worldSlug}/chronicle`);
  redirect(
    `/worlds/${worldSlug}/chronicle?factionTick=${started}&factionTotal=${factionPages.length}`,
  );
}
