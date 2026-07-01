"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ABILITY_KEYS,
  buildLevelUpApplyPayload,
  createAuthService,
  createCharacterService,
  createCharacterSpellService,
  createPrismaClient,
  DEFAULT_ABILITY_SCORES,
  extractOpen5eSpellLevel,
  parseHomebrewSpellInput,
  resolveDndApiConfig,
  type Prisma,
  type UpdateCharacterInput,
} from "@uwe/database/server";
import { searchOpen5eSpells, type DndApiSearchResult } from "@uwe/dnd-api";
import {
  characterLevelUpApplySchema,
  characterSheetUpdateSchema,
  characterSpellAddSchema,
  characterSpellHomebrewAddSchema,
  characterSpellRemoveSchema,
  characterSpellTogglePreparedSchema,
  parseFormDataOrThrow,
} from "@uwe/security";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";

type CharacterSheetForm = z.infer<typeof characterSheetUpdateSchema>;

function buildUpdateInput(parsed: CharacterSheetForm): UpdateCharacterInput {
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
  parsed: z.infer<typeof characterLevelUpApplySchema>,
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

function resolveReturnPath(parsed: { returnPath?: string; pageSlug?: string; worldSlug: string }) {
  return (
    parsed.returnPath ??
    (parsed.pageSlug
      ? `/auth/worlds/${parsed.worldSlug}/${parsed.pageSlug}`
      : `/auth/worlds/${parsed.worldSlug}/characters`)
  );
}

async function assertPortalCharacterOwner(worldSlug: string, characterId: string) {
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      throw new Error("Welt nicht gefunden");
    }
    assertPortalCanReadWorld(ctx, world.id);

    const character = await auth.getCharacterForViewer(worldSlug, characterId, ctx);
    if (
      !character ||
      character.ownerUserId !== ctx.user?.id ||
      ctx.effectiveRole !== "player" ||
      ctx.previewAsUserId
    ) {
      throw new Error("Keine Berechtigung");
    }

    return { db, auth, character, ctx };
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
}

function revalidateCharacterPaths(worldSlug: string, path: string) {
  revalidatePath(path);
  revalidatePath(`/auth/worlds/${worldSlug}`);
  revalidatePath(`/auth/worlds/${worldSlug}/characters`);
}

export async function updateCharacterSheetAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, characterSheetUpdateSchema);
  const path = resolveReturnPath(parsed);

  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(parsed.worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    const world = await db.world.findUnique({
      where: { slug: parsed.worldSlug },
      select: { id: true },
    });
    if (!world) {
      throw new Error("Welt nicht gefunden");
    }
    assertPortalCanReadWorld(ctx, world.id);

    const updated = await auth.updateCharacterForOwner(
      parsed.worldSlug,
      parsed.characterId,
      buildUpdateInput(parsed),
      ctx,
    );
    if (!updated) {
      throw new Error("Keine Berechtigung");
    }
  } finally {
    await db.$disconnect();
  }

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function applyPortalLevelUpAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, characterLevelUpApplySchema);
  const path = resolveReturnPath(parsed);
  const { db, auth, ctx } = await assertPortalCharacterOwner(parsed.worldSlug, parsed.characterId);

  try {
    const characters = createCharacterService(db);
    const record = await characters.getById(parsed.characterId);
    if (!record) {
      throw new Error("Charakter nicht gefunden");
    }

    const updated = await auth.updateCharacterForOwner(
      parsed.worldSlug,
      parsed.characterId,
      buildLevelUpUpdateInput(record, parsed),
      ctx,
    );
    if (!updated) {
      throw new Error("Keine Berechtigung");
    }
  } finally {
    await db.$disconnect();
  }

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function addSpellAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, characterSpellAddSchema);
  const path = resolveReturnPath(parsed);
  const { db, character } = await assertPortalCharacterOwner(parsed.worldSlug, parsed.characterId);

  try {
    const characters = createCharacterService(db);
    await characters.upsertSpell({
      characterId: character.id,
      spellKey: parsed.spellKey,
      spellLevel: parsed.spellLevel ?? 0,
      prepared: parsePreparedFlag(parsed.prepared ?? true),
      source: parsed.source ?? "open5e",
      notes: parsed.notes ?? "",
    });
  } finally {
    await db.$disconnect();
  }

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function removeSpellAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, characterSpellRemoveSchema);
  const path = resolveReturnPath(parsed);
  const { db, character } = await assertPortalCharacterOwner(parsed.worldSlug, parsed.characterId);

  try {
    const spells = createCharacterSpellService(db);
    await spells.removeSpell(character.id, parsed.spellKey);
  } finally {
    await db.$disconnect();
  }

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function togglePreparedAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, characterSpellTogglePreparedSchema);
  const path = resolveReturnPath(parsed);
  const { db, character } = await assertPortalCharacterOwner(parsed.worldSlug, parsed.characterId);

  try {
    const characters = createCharacterService(db);
    await characters.upsertSpell({
      characterId: character.id,
      spellKey: parsed.spellKey,
      prepared: parsePreparedFlag(parsed.prepared ?? true),
    });
  } finally {
    await db.$disconnect();
  }

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function addHomebrewSpellAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, characterSpellHomebrewAddSchema);
  const path = resolveReturnPath(parsed);
  const homebrew = parseHomebrewSpellInput({
    name: parsed.name,
    spellLevel: parsed.spellLevel,
    prepared: parsed.prepared,
  });
  if (!homebrew) {
    throw new Error("Homebrew-Zauber unvollständig.");
  }

  const { db, character } = await assertPortalCharacterOwner(parsed.worldSlug, parsed.characterId);
  try {
    const characters = createCharacterService(db);
    await characters.upsertSpell({
      characterId: character.id,
      spellKey: homebrew.spellKey,
      spellLevel: homebrew.spellLevel,
      prepared: homebrew.prepared,
      source: homebrew.source,
      notes: homebrew.notes,
    });
  } finally {
    await db.$disconnect();
  }

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function searchOpen5eSpellsAction(query: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Nicht angemeldet");
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const config = resolveDndApiConfig();
  const results = await searchOpen5eSpells(trimmed, {
    open5eEnabled: config.open5eEnabled,
    dnd5eSrdEnabled: config.dnd5eSrdEnabled,
  });

  return results.map((item: DndApiSearchResult) => ({
    id: item.id,
    name: item.name,
    url: item.url,
    spellLevel: extractOpen5eSpellLevel(item.raw),
  }));
}
