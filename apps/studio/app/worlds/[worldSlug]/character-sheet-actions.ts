"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ABILITY_KEYS,
  buildLevelUpApplyPayload,
  createCharacterService,
  createCharacterSpellService,
  createPrismaClient,
  DEFAULT_ABILITY_SCORES,
  extractOpen5eSpellLevel,
  getAppRepository,
  parseHomebrewSpellInput,
  resolveDndApiConfig,
  type Prisma,
  type UpdateCharacterInput,
} from "@uwe/database/server";
import { searchOpen5eSpells } from "@uwe/dnd-api";
import {
  parseFormDataOrThrow,
  studioCharacterSheetUpdateSchema,
  studioCharacterLevelUpApplySchema,
  studioCharacterSpellAddSchema,
  studioCharacterSpellHomebrewAddSchema,
  studioCharacterSpellRemoveSchema,
  studioCharacterSpellTogglePreparedSchema,
} from "@uwe/security";
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

function parsePreparedFlag(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

function parseApplyFlag(value: unknown): boolean {
  return parsePreparedFlag(value);
}

function buildLevelUpUpdateInput(
  character: {
    level: number;
    classes: unknown;
    abilities: unknown;
    combat: unknown;
  },
  parsed: z.infer<typeof studioCharacterLevelUpApplySchema>,
): UpdateCharacterInput {
  const payload = buildLevelUpApplyPayload(
    {
      level: character.level,
      classes: character.classes,
      abilities: character.abilities,
      combat: character.combat,
    },
    {
      pickedClass: parsed.pickedClass,
      hpIncrease: parsed.hpIncrease,
      applyLevel: parseApplyFlag(parsed.applyLevel),
      applyMaxHp: parseApplyFlag(parsed.applyMaxHp),
      applyCurrentHp: parseApplyFlag(parsed.applyCurrentHp),
      applyClasses: parseApplyFlag(parsed.applyClasses),
    },
  );

  if (!payload) {
    throw new Error("Keine Level-Up-Felder ausgewählt.");
  }

  return {
    ...(payload.level !== undefined ? { level: payload.level } : {}),
    ...(payload.classes
      ? { classes: payload.classes as unknown as Prisma.InputJsonValue }
      : {}),
    ...(payload.combat ? { combat: payload.combat } : {}),
  };
}

export async function applyStudioLevelUpAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, studioCharacterLevelUpApplySchema);
  const { worldSlug, pageId, pageSlug, category, characterId } = parsed;
  const { db, characters, character } = await assertStudioCharacterAccess(
    worldSlug,
    pageId,
    characterId,
  );

  try {
    const updated = await characters.update(
      characterId,
      buildLevelUpUpdateInput(character, parsed),
    );
    if (!updated) {
      throw new Error("Level-Up konnte nicht gespeichert werden.");
    }
  } finally {
    await db.$disconnect();
  }

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?levelUpSaved=1`);
}

async function assertStudioCharacterAccess(
  worldSlug: string,
  pageId: string,
  characterId: string,
) {
  await requireStudioActionAuth();
  await requireStudioContentEdit(worldSlug, pageId);

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error("Welt nicht gefunden.");
  }

  const page = await repo.getPageById(pageId);
  if (!page || page.type !== "player_character") {
    throw new Error("Charakterbogen ist nur für Spielercharakter-Seiten verfügbar.");
  }

  const db = createPrismaClient();
  try {
    const characters = createCharacterService(db);
    const character = await characters.getById(characterId);
    if (!character || character.worldId !== world.id || character.pageId !== pageId) {
      throw new Error("Charakter nicht gefunden.");
    }
    return { db, characters, character };
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
}

export async function addSpellAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, studioCharacterSpellAddSchema);
  const { worldSlug, pageId, pageSlug, category, characterId } = parsed;
  const { db, characters } = await assertStudioCharacterAccess(worldSlug, pageId, characterId);

  try {
    await characters.upsertSpell({
      characterId,
      spellKey: parsed.spellKey,
      spellLevel: parsed.spellLevel ?? 0,
      prepared: parsePreparedFlag(parsed.prepared ?? true),
      source: parsed.source ?? "open5e",
      notes: parsed.notes ?? "",
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?spellSaved=1`);
}

export async function removeSpellAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, studioCharacterSpellRemoveSchema);
  const { worldSlug, pageId, pageSlug, category, characterId, spellKey } = parsed;
  const { db } = await assertStudioCharacterAccess(worldSlug, pageId, characterId);

  try {
    const spells = createCharacterSpellService(db);
    await spells.removeSpell(characterId, spellKey);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?spellSaved=1`);
}

export async function togglePreparedAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, studioCharacterSpellTogglePreparedSchema);
  const { worldSlug, pageId, pageSlug, category, characterId, spellKey } = parsed;
  const { db, characters } = await assertStudioCharacterAccess(worldSlug, pageId, characterId);

  try {
    await characters.upsertSpell({
      characterId,
      spellKey,
      prepared: parsePreparedFlag(parsed.prepared ?? true),
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?spellSaved=1`);
}

export async function addHomebrewSpellAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, studioCharacterSpellHomebrewAddSchema);
  const { worldSlug, pageId, pageSlug, category, characterId } = parsed;
  const homebrew = parseHomebrewSpellInput({
    name: parsed.name,
    spellLevel: parsed.spellLevel,
    prepared: parsed.prepared,
  });
  if (!homebrew) {
    throw new Error("Homebrew-Zauber unvollständig.");
  }

  const { db, characters } = await assertStudioCharacterAccess(worldSlug, pageId, characterId);
  try {
    await characters.upsertSpell({
      characterId,
      spellKey: homebrew.spellKey,
      spellLevel: homebrew.spellLevel,
      prepared: homebrew.prepared,
      source: homebrew.source,
      notes: homebrew.notes,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?spellSaved=1`);
}

export async function searchOpen5eSpellsAction(query: string) {
  await requireStudioActionAuth();
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const config = resolveDndApiConfig();
  const results = await searchOpen5eSpells(trimmed, {
    open5eEnabled: config.open5eEnabled,
    dnd5eSrdEnabled: config.dnd5eSrdEnabled,
  });

  return results.map((item) => ({
    id: item.id,
    name: item.name,
    url: item.url,
    spellLevel: extractOpen5eSpellLevel(item.raw),
  }));
}
