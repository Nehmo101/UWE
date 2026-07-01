"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ABILITY_KEYS,
  createCharacterService,
  createPrismaClient,
  DEFAULT_ABILITY_SCORES,
  getAppRepository,
  type UpdateCharacterInput,
} from "@uwe/database/server";
import { parseFormDataOrThrow, studioCharacterSheetUpdateSchema } from "@uwe/security";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioContentEdit } from "@/src/lib/authz";

function editPath(worldSlug: string, category: string, pageSlug: string) {
  return `/worlds/${worldSlug}/${category}/${pageSlug}/edit`;
}

type StudioCharacterSheetForm = z.infer<typeof studioCharacterSheetUpdateSchema>;

function buildUpdateInput(parsed: StudioCharacterSheetForm): UpdateCharacterInput {
  const abilities: NonNullable<UpdateCharacterInput["abilities"]> = {
    strength: parsed.strength ?? DEFAULT_ABILITY_SCORES.strength,
    dexterity: parsed.dexterity ?? DEFAULT_ABILITY_SCORES.dexterity,
    constitution: parsed.constitution ?? DEFAULT_ABILITY_SCORES.constitution,
    intelligence: parsed.intelligence ?? DEFAULT_ABILITY_SCORES.intelligence,
    wisdom: parsed.wisdom ?? DEFAULT_ABILITY_SCORES.wisdom,
    charisma: parsed.charisma ?? DEFAULT_ABILITY_SCORES.charisma,
  };

  const hasAbilityInput = ABILITY_KEYS.some((key) => parsed[key] !== undefined);

  const combat =
    parsed.armorClass !== undefined || parsed.initiativeBonus !== undefined
      ? {
          ...(parsed.armorClass !== undefined ? { armorClass: parsed.armorClass } : {}),
          ...(parsed.initiativeBonus !== undefined
            ? { initiativeBonus: parsed.initiativeBonus }
            : {}),
        }
      : undefined;

  return {
    ...(parsed.displayName !== undefined ? { displayName: parsed.displayName } : {}),
    ...(parsed.level !== undefined ? { level: parsed.level } : {}),
    ...(hasAbilityInput ? { abilities } : {}),
    ...(combat ? { combat } : {}),
    ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
  };
}

export async function updateStudioCharacterSheetAction(formData: FormData) {
  await requireStudioActionAuth();

  const parsed = parseFormDataOrThrow(formData, studioCharacterSheetUpdateSchema);
  const { worldSlug, pageId, pageSlug, category, characterId } = parsed;

  await requireStudioContentEdit(worldSlug, pageId);

  const db = createPrismaClient();
  try {
    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    const page = await repo.getPageById(pageId);
    if (!page || page.type !== "player_character") {
      throw new Error("Charakterbogen ist nur für Spielercharakter-Seiten verfügbar.");
    }

    const characters = createCharacterService(db);
    const character = await characters.getById(characterId);
    if (!character || character.worldId !== world.id || character.pageId !== pageId) {
      throw new Error("Charakter nicht gefunden.");
    }

    const updated = await characters.update(characterId, buildUpdateInput(parsed));
    if (!updated) {
      throw new Error("Charakter konnte nicht gespeichert werden.");
    }
  } finally {
    await db.$disconnect();
  }

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?saved=1`);
}
