"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ABILITY_KEYS,
  createAuthService,
  createPrismaClient,
  DEFAULT_ABILITY_SCORES,
  type UpdateCharacterInput,
} from "@uwe/database/server";
import { characterSheetUpdateSchema, parseFormDataOrThrow } from "@uwe/security";
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

export async function updateCharacterSheetAction(formData: FormData) {
  const parsed = parseFormDataOrThrow(formData, characterSheetUpdateSchema);
  const path =
    parsed.returnPath ??
    (parsed.pageSlug
      ? `/auth/worlds/${parsed.worldSlug}/${parsed.pageSlug}`
      : `/auth/worlds/${parsed.worldSlug}/characters`);

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

  revalidatePath(path);
  revalidatePath(`/auth/worlds/${parsed.worldSlug}`);
  revalidatePath(`/auth/worlds/${parsed.worldSlug}/characters`);
}
