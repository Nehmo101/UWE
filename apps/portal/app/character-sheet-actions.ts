"use server";

import { requirePortalActionAuth } from "@/src/lib/portal-action-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ABILITY_KEYS,
  buildLevelUpApplyPayload,
  createAuthService,
  createCharacterService,
  createCharacterSpellService,
  prisma,
  DEFAULT_ABILITY_SCORES,
  extractCharacterProficiencyFormInput,
  extractOpen5eSpellDescription,
  extractOpen5eSpellLevel,
  extractOpen5eSpellSchool,
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
    ...extractCharacterProficiencyFormInput(parsed),
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

  // Geteilter Client (main) + Häkchenmodell (unsere Seite): Besitz zeigt die
  // Welt-Zuordnung, nicht mehr eine Rolle.
  const auth = createAuthService(prisma);
  const world = await prisma.world.findUnique({
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
    ctx.worldMembership === null ||
    ctx.previewAsUserId
  ) {
    throw new Error("Keine Berechtigung");
  }

  return { auth, character, ctx };
}

function revalidateCharacterPaths(worldSlug: string, path: string) {
  revalidatePath(path);
  revalidatePath(`/auth/worlds/${worldSlug}`);
  revalidatePath(`/auth/worlds/${worldSlug}/characters`);
}

export async function updateCharacterSheetAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, characterSheetUpdateSchema);
  const path = resolveReturnPath(parsed);

  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(parsed.worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const auth = createAuthService(prisma);

  const world = await prisma.world.findUnique({
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

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function applyPortalLevelUpAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, characterLevelUpApplySchema);
  const path = resolveReturnPath(parsed);
  const { auth, ctx } = await assertPortalCharacterOwner(parsed.worldSlug, parsed.characterId);

  const characters = createCharacterService(prisma);
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

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function addSpellAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, characterSpellAddSchema);
  const path = resolveReturnPath(parsed);
  const { character } = await assertPortalCharacterOwner(parsed.worldSlug, parsed.characterId);

  const characters = createCharacterService(prisma);
  await characters.upsertSpell({
    characterId: character.id,
    spellKey: parsed.spellKey,
    spellLevel: parsed.spellLevel ?? 0,
    prepared: parsePreparedFlag(parsed.prepared ?? true),
    source: parsed.source ?? "open5e",
    displayName: parsed.displayName ?? null,
    school: parsed.school ?? null,
    description: parsed.description ?? "",
    notes: parsed.notes ?? "",
  });

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function removeSpellAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, characterSpellRemoveSchema);
  const path = resolveReturnPath(parsed);
  const { character } = await assertPortalCharacterOwner(parsed.worldSlug, parsed.characterId);

  const spells = createCharacterSpellService(prisma);
  await spells.removeSpell(character.id, parsed.spellKey);

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function togglePreparedAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, characterSpellTogglePreparedSchema);
  const path = resolveReturnPath(parsed);
  const { character } = await assertPortalCharacterOwner(parsed.worldSlug, parsed.characterId);

  const characters = createCharacterService(prisma);
  await characters.upsertSpell({
    characterId: character.id,
    spellKey: parsed.spellKey,
    prepared: parsePreparedFlag(parsed.prepared ?? true),
  });

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function addHomebrewSpellAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, characterSpellHomebrewAddSchema);
  const path = resolveReturnPath(parsed);
  const homebrew = parseHomebrewSpellInput({
    name: parsed.name,
    spellLevel: parsed.spellLevel,
    prepared: parsed.prepared,
    school: parsed.school,
    description: parsed.description,
  });
  if (!homebrew) {
    throw new Error("Homebrew-Zauber unvollständig.");
  }

  const { character } = await assertPortalCharacterOwner(parsed.worldSlug, parsed.characterId);
  const characters = createCharacterService(prisma);
  await characters.upsertSpell({
    characterId: character.id,
    spellKey: homebrew.spellKey,
    spellLevel: homebrew.spellLevel,
    prepared: homebrew.prepared,
    source: homebrew.source,
    displayName: homebrew.displayName,
    school: homebrew.school,
    description: homebrew.description,
    notes: homebrew.notes,
  });

  revalidateCharacterPaths(parsed.worldSlug, path);
}

export async function searchOpen5eSpellsAction(query: string) {
  await requirePortalActionAuth();
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
    school: extractOpen5eSpellSchool(item.raw),
    description: extractOpen5eSpellDescription(item.raw),
  }));
}
