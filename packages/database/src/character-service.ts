import type { Character, DndRulesEdition, Prisma, PrismaClient } from "./generated/prisma/client";
import {
  computeSpellSlots,
  toCharacterSpellView,
  type CharacterSpellView,
  type SpellSlotSummary,
} from "./character-spell-service";

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export const ABILITY_KEYS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const satisfies ReadonlyArray<keyof AbilityScores>;

export const DEFAULT_ABILITY_SCORES: AbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

export interface CharacterCombat {
  armorClass?: number | null;
  initiativeBonus?: number | null;
  maxHp?: number | null;
  currentHp?: number | null;
  speed?: number | null;
}

export interface CharacterSheetSnapshot {
  id: string;
  displayName: string;
  level: number;
  rulesEdition: DndRulesEdition;
  abilities: AbilityScores;
  modifiers: AbilityScores;
  proficiencyBonus: number;
  combat: CharacterCombat;
  armorClass: number | null;
  initiative: number;
  ownerUserId: string;
  pageId: string | null;
}

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

export interface UpdateCharacterInput {
  displayName?: string;
  level?: number;
  abilities?: AbilityScores;
  combat?: CharacterCombat;
  classes?: Prisma.InputJsonValue;
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

function clampAbilityScore(value: number): number {
  return Math.max(1, Math.min(30, Math.floor(value)));
}

function parseOptionalInt(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  if (value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.floor(parsed);
}

export function parseAbilityScores(raw: unknown): AbilityScores {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_ABILITY_SCORES };
  }

  const source = raw as Record<string, unknown>;
  const abilities = { ...DEFAULT_ABILITY_SCORES };

  for (const key of ABILITY_KEYS) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      abilities[key] = clampAbilityScore(value);
    }
  }

  return abilities;
}

export function parseCharacterCombat(raw: unknown): CharacterCombat {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const source = raw as Record<string, unknown>;
  return {
    armorClass: parseOptionalInt(source.armorClass ?? source.armor_class),
    initiativeBonus: parseOptionalInt(source.initiativeBonus ?? source.initiative_bonus),
    maxHp: parseOptionalInt(source.maxHp ?? source.max_hp),
    currentHp: parseOptionalInt(source.currentHp ?? source.current_hp),
    speed: parseOptionalInt(source.speed),
  };
}

export interface PortalCharacterView {
  id: string;
  displayName: string;
  level: number;
  rulesEdition: DndRulesEdition;
  ownerUserId: string;
  pageId: string | null;
  pageSlug: string | null;
  pageTitle: string | null;
  notes: string;
  sheet: CharacterSheetSnapshot;
  spells: CharacterSpellView[];
  spellSlots: SpellSlotSummary;
}

export function toPortalCharacterView(
  character: Pick<
    Character,
    | "id"
    | "displayName"
    | "level"
    | "rulesEdition"
    | "abilities"
    | "combat"
    | "classes"
    | "ownerUserId"
    | "pageId"
    | "notes"
  > & {
    page?: { slug: string; title: string } | null;
    spells?: Array<{
      id: string;
      spellKey: string;
      spellLevel: number;
      prepared: boolean;
      source: string | null;
      notes: string;
    }>;
  },
): PortalCharacterView {
  const spells = (character.spells ?? []).map((spell) =>
    toCharacterSpellView({
      id: spell.id,
      characterId: character.id,
      spellKey: spell.spellKey,
      spellLevel: spell.spellLevel,
      prepared: spell.prepared,
      source: spell.source,
      notes: spell.notes,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }),
  );

  return {
    id: character.id,
    displayName: character.displayName,
    level: character.level,
    rulesEdition: character.rulesEdition,
    ownerUserId: character.ownerUserId,
    pageId: character.pageId,
    pageSlug: character.page?.slug ?? null,
    pageTitle: character.page?.title ?? null,
    notes: character.notes,
    sheet: buildCharacterSheetSnapshot(character),
    spells,
    spellSlots: computeSpellSlots(character.level, character.classes),
  };
}

export function buildCharacterSheetSnapshot(
  character: Pick<
    Character,
    "id" | "displayName" | "level" | "rulesEdition" | "abilities" | "combat" | "ownerUserId" | "pageId"
  >,
): CharacterSheetSnapshot {
  const abilities = parseAbilityScores(character.abilities);
  const modifiers = {
    strength: abilityModifier(abilities.strength),
    dexterity: abilityModifier(abilities.dexterity),
    constitution: abilityModifier(abilities.constitution),
    intelligence: abilityModifier(abilities.intelligence),
    wisdom: abilityModifier(abilities.wisdom),
    charisma: abilityModifier(abilities.charisma),
  };
  const combat = parseCharacterCombat(character.combat);
  const initiativeBonus = combat.initiativeBonus ?? 0;

  return {
    id: character.id,
    displayName: character.displayName,
    level: character.level,
    rulesEdition: character.rulesEdition,
    abilities,
    modifiers,
    proficiencyBonus: proficiencyBonus(character.level),
    combat,
    armorClass: combat.armorClass ?? null,
    initiative: modifiers.dexterity + initiativeBonus,
    ownerUserId: character.ownerUserId,
    pageId: character.pageId,
  };
}

export class CharacterService {
  constructor(private readonly db: PrismaClient) {}

  async getById(characterId: string) {
    return this.db.character.findUnique({
      where: { id: characterId },
      include: { spells: { orderBy: [{ spellLevel: "asc" }, { spellKey: "asc" }] } },
    });
  }

  async getByPageId(pageId: string) {
    return this.db.character.findUnique({
      where: { pageId },
      include: { spells: { orderBy: [{ spellLevel: "asc" }, { spellKey: "asc" }] } },
    });
  }

  async listForOwner(worldId: string, ownerUserId: string) {
    return this.db.character.findMany({
      where: { worldId, ownerUserId },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        page: { select: { id: true, title: true, slug: true, type: true } },
      },
    });
  }

  async listForWorld(worldId: string) {
    return this.db.character.findMany({
      where: { worldId },
      orderBy: [{ displayName: "asc" }],
      include: {
        page: { select: { id: true, title: true, slug: true, type: true } },
        owner: { select: { id: true, displayName: true } },
      },
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

  async update(characterId: string, input: UpdateCharacterInput) {
    const existing = await this.db.character.findUnique({ where: { id: characterId } });
    if (!existing) {
      return null;
    }

    const abilities = input.abilities
      ? parseAbilityScores(input.abilities)
      : parseAbilityScores(existing.abilities);
    const combat = input.combat
      ? {
          ...parseCharacterCombat(existing.combat),
          ...input.combat,
        }
      : parseCharacterCombat(existing.combat);

    return this.db.character.update({
      where: { id: characterId },
      data: {
        displayName: input.displayName?.trim() || undefined,
        level: input.level,
        abilities: abilities as unknown as Prisma.InputJsonValue,
        combat: combat as unknown as Prisma.InputJsonValue,
        classes: input.classes,
        notes: input.notes,
      },
      include: {
        page: { select: { id: true, title: true, slug: true, type: true } },
        spells: { orderBy: [{ spellLevel: "asc" }, { spellKey: "asc" }] },
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
