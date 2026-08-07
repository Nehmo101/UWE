"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { findAlignment, findLanguage } from "@uwe/character-creator";
import { createAuthService, prisma, type Prisma } from "@uwe/database/server";
import { characterProfileUpdateSchema, parseFormDataOrThrow } from "@uwe/security";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { requirePortalActionAuth } from "@/src/lib/portal-action-auth";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function updateCharacterProfileAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, characterProfileUpdateSchema);
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(parsed.worldSlug);
  if (!user || !ctx) throw new Error("Nicht angemeldet");

  const auth = createAuthService(prisma);
  const existing = await auth.getCharacterForViewer(parsed.worldSlug, parsed.characterId, ctx);
  if (!existing || existing.ownerUserId !== user.id) throw new Error("Keine Berechtigung");

  const alignment = parsed.alignmentKey ? findAlignment(parsed.alignmentKey) : null;
  if (parsed.alignmentKey && !alignment) throw new Error("Unbekannte Gesinnung");
  const languages = parsed.languageKeys.map((key) => findLanguage(key));
  if (languages.some((language) => !language)) throw new Error("Unbekannte Sprache");

  const previousFeatures = record(existing.profile.features);
  const previousBio = record(existing.profile.bio);
  const updated = await auth.updateCharacterForOwner(
    parsed.worldSlug,
    parsed.characterId,
    {
      features: asJson({
        ...previousFeatures,
        schemaVersion: typeof previousFeatures.schemaVersion === "number" ? previousFeatures.schemaVersion : 1,
        languages: languages.map((language) => ({ key: language!.key, name: language!.name })),
      }),
      bio: asJson({
        ...previousBio,
        schemaVersion: typeof previousBio.schemaVersion === "number" ? previousBio.schemaVersion : 1,
        alignment: alignment ? { key: alignment.key, name: alignment.name } : null,
        pronouns: parsed.pronouns,
        age: parsed.age,
        height: parsed.height,
        weight: parsed.weight,
        eyes: parsed.eyes,
        hair: parsed.hair,
        skin: parsed.skin,
        appearance: parsed.appearance,
        personality: parsed.personality,
        ideals: parsed.ideals,
        bonds: parsed.bonds,
        flaws: parsed.flaws,
        backstory: parsed.backstory,
      }),
    },
    ctx,
  );
  if (!updated) throw new Error("Charakterprofil konnte nicht gespeichert werden.");

  revalidatePath(parsed.returnPath);
  revalidatePath(`/auth/worlds/${parsed.worldSlug}/characters`);
  redirect(`${parsed.returnPath}?profileSaved=1`);
}