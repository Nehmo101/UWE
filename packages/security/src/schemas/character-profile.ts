import { z } from "zod";

const profileText = (max: number) => z.string().trim().max(max).optional().default("");

export const characterProfileUpdateSchema = z.object({
  worldSlug: z.string().trim().min(1).max(160),
  characterId: z.string().trim().min(1).max(200),
  returnPath: z.string().trim().min(1).max(500),
  alignmentKey: profileText(80),
  languageKeys: z.preprocess(
    (value) => value === undefined ? [] : Array.isArray(value) ? value : [value],
    z.array(z.string().trim().min(1).max(80)).max(20),
  ),
  pronouns: profileText(100),
  age: profileText(100),
  height: profileText(100),
  weight: profileText(100),
  eyes: profileText(100),
  hair: profileText(100),
  skin: profileText(100),
  appearance: profileText(2_000),
  personality: profileText(2_000),
  ideals: profileText(2_000),
  bonds: profileText(2_000),
  flaws: profileText(2_000),
  backstory: profileText(20_000),
});

export const ownedCharacterMutationSchema = z.object({
  worldSlug: z.string().trim().min(1).max(160),
  characterId: z.string().trim().min(1).max(200),
});

export const deleteOwnedCharacterSchema = ownedCharacterMutationSchema.extend({
  confirmation: z.literal("CHARAKTER LOESCHEN"),
});