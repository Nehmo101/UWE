import type { DndRulesEdition, Prisma, PrismaClient } from "./generated/prisma/client";

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export const DEFAULT_ABILITY_SCORES: AbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

export interface CreateCharacterInput {
  worldId: string;
  ownerUserId: string;
  displayName: string;
  pageId?: string | null;
  campaignId?: string | null;
  rulesEdition?: DndRulesEdition;
  level?: number;
  abilities?: AbilityScores;
  skills?: Prisma.InputJsonValue;
  combat?: Prisma.InputJsonValue;
  spellcasting?: Prisma.InputJsonValue;
  classes?: Prisma.InputJsonValue;
  species?: Prisma.InputJsonValue;
  background?: Prisma.InputJsonValue;
  features?: Prisma.InputJsonValue;
  bio?: Prisma.InputJsonValue;
  notes?: string;
}

export interface UpsertCharacterSpellInput {
  characterId: string;
  spellKey: string;
  spellLevel?: number;
  prepared?: boolean;
  source?: string | null;
  notes?: string;
}

export class CharacterService {
  constructor(private readonly db: PrismaClient) {}

  async getById(characterId: string) {
    return this.db.character.findUnique({
      where: { id: characterId },
      include: { spells: { orderBy: [{ spellLevel: "asc" }, { spellKey: "asc" }] } },
    });
  }

  async listForOwner(worldId: string, ownerUserId: string) {
    return this.db.character.findMany({
      where: { worldId, ownerUserId },
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  async listForWorld(worldId: string) {
    return this.db.character.findMany({
      where: { worldId },
      orderBy: [{ displayName: "asc" }],
    });
  }

  async create(input: CreateCharacterInput) {
    const abilities = input.abilities ?? DEFAULT_ABILITY_SCORES;
    return this.db.character.create({
      data: {
        worldId: input.worldId,
        ownerUserId: input.ownerUserId,
        displayName: input.displayName,
        pageId: input.pageId ?? null,
        campaignId: input.campaignId ?? null,
        rulesEdition: input.rulesEdition ?? "dnd5e_2024",
        level: input.level ?? 1,
        abilities: abilities as unknown as Prisma.InputJsonValue,
        skills: input.skills,
        combat: input.combat,
        spellcasting: input.spellcasting,
        classes: input.classes,
        species: input.species,
        background: input.background,
        features: input.features,
        bio: input.bio,
        notes: input.notes ?? "",
      },
    });
  }

  async upsertSpell(input: UpsertCharacterSpellInput) {
    return this.db.characterSpell.upsert({
      where: {
        characterId_spellKey: {
          characterId: input.characterId,
          spellKey: input.spellKey,
        },
      },
      create: {
        characterId: input.characterId,
        spellKey: input.spellKey,
        spellLevel: input.spellLevel ?? 0,
        prepared: input.prepared ?? false,
        source: input.source ?? null,
        notes: input.notes ?? "",
      },
      update: {
        spellLevel: input.spellLevel,
        prepared: input.prepared,
        source: input.source,
        notes: input.notes,
      },
    });
  }
}

export function createCharacterService(db: PrismaClient): CharacterService {
  return new CharacterService(db);
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}
