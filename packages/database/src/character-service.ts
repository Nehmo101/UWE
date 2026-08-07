import type { Character, DndRulesEdition, Prisma, PrismaClient } from "./generated/prisma/client";
import {
  computeSpellSlots,
  parseCharacterClasses,
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
  derived: CharacterDerivedStats;
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
  species?: Prisma.InputJsonValue;
  background?: Prisma.InputJsonValue;
  features?: Prisma.InputJsonValue;
  bio?: Prisma.InputJsonValue;
  skills?: CharacterSkillProfile;
  spellcasting?: SpellcastingConfig;
  notes?: string;
}

export interface UpsertCharacterSpellInput {
  characterId: string;
  spellKey: string;
  spellLevel?: number;
  prepared?: boolean;
  source?: string | null;
  displayName?: string | null;
  school?: string | null;
  description?: string;
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

// === Derived stats (D&D 2024 auto-calculation) ===

export interface SkillDefinition {
  key: SkillKey;
  ability: keyof AbilityScores;
  label: string;
}

export const SKILL_DEFINITIONS = [
  { key: "acrobatics", ability: "dexterity", label: "Akrobatik" },
  { key: "animal_handling", ability: "wisdom", label: "Mit Tieren umgehen" },
  { key: "arcana", ability: "intelligence", label: "Arkane Kunde" },
  { key: "athletics", ability: "strength", label: "Athletik" },
  { key: "deception", ability: "charisma", label: "Täuschen" },
  { key: "history", ability: "intelligence", label: "Geschichtskunde" },
  { key: "insight", ability: "wisdom", label: "Motiv erkennen" },
  { key: "intimidation", ability: "charisma", label: "Einschüchtern" },
  { key: "investigation", ability: "intelligence", label: "Nachforschungen" },
  { key: "medicine", ability: "wisdom", label: "Heilkunde" },
  { key: "nature", ability: "intelligence", label: "Naturkunde" },
  { key: "perception", ability: "wisdom", label: "Wahrnehmung" },
  { key: "performance", ability: "charisma", label: "Auftreten" },
  { key: "persuasion", ability: "charisma", label: "Überzeugen" },
  { key: "religion", ability: "intelligence", label: "Religionskunde" },
  { key: "sleight_of_hand", ability: "dexterity", label: "Fingerfertigkeit" },
  { key: "stealth", ability: "dexterity", label: "Heimlichkeit" },
  { key: "survival", ability: "wisdom", label: "Überlebenskunst" },
] as const satisfies ReadonlyArray<{
  key: string;
  ability: keyof AbilityScores;
  label: string;
}>;

export type SkillKey = (typeof SKILL_DEFINITIONS)[number]["key"];

const SKILL_KEY_SET = new Set<string>(SKILL_DEFINITIONS.map((skill) => skill.key));
const ABILITY_KEY_SET = new Set<string>(ABILITY_KEYS);

export type SkillProficiencyLevel = "none" | "proficient" | "expertise";

export type SpellcastingAbilitySetting = "auto" | "none" | keyof AbilityScores;

/** Canonical JSON shape stored in Character.skills. */
export interface CharacterSkillProfile {
  proficiencies: SkillKey[];
  expertise: SkillKey[];
  savingThrows: Array<keyof AbilityScores>;
}

/** Canonical JSON shape stored in Character.spellcasting. */
export interface SpellcastingConfig {
  ability: SpellcastingAbilitySetting;
}

function parseKeyList<T extends string>(raw: unknown, allowed: Set<string>): T[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: T[] = [];
  for (const entry of raw) {
    if (typeof entry === "string" && allowed.has(entry) && !result.includes(entry as T)) {
      result.push(entry as T);
    }
  }
  return result;
}

export function parseCharacterSkillProfile(raw: unknown): CharacterSkillProfile {
  if (!raw || typeof raw !== "object") {
    return { proficiencies: [], expertise: [], savingThrows: [] };
  }
  const source = raw as Record<string, unknown>;
  return {
    proficiencies: parseKeyList<SkillKey>(source.proficiencies, SKILL_KEY_SET),
    expertise: parseKeyList<SkillKey>(source.expertise, SKILL_KEY_SET),
    savingThrows: parseKeyList<keyof AbilityScores>(
      source.savingThrows ?? source.saving_throws,
      ABILITY_KEY_SET,
    ),
  };
}

export function parseSpellcastingConfig(raw: unknown): SpellcastingConfig {
  if (raw && typeof raw === "object") {
    const ability = (raw as Record<string, unknown>).ability;
    if (ability === "none") {
      return { ability: "none" };
    }
    if (typeof ability === "string" && ABILITY_KEY_SET.has(ability)) {
      return { ability: ability as keyof AbilityScores };
    }
  }
  return { ability: "auto" };
}

const SPELLCASTING_CLASS_ABILITIES: ReadonlyArray<[keyof AbilityScores, ReadonlySet<string>]> = [
  [
    "intelligence",
    new Set([
      "wizard",
      "zauberer",
      "magier",
      "artificer",
      "eldritch knight",
      "arkane ritter",
      "arkaner ritter",
      "arcane trickster",
      "arkane trickster",
    ]),
  ],
  [
    "wisdom",
    new Set(["cleric", "kleriker", "druid", "druide", "ranger", "waldläufer", "waldlaufer"]),
  ],
  [
    "charisma",
    new Set(["bard", "barde", "sorcerer", "hexenmeister", "warlock", "hexenpakt", "paladin"]),
  ],
];

/**
 * Infers the spellcasting ability from the class list (highest class level wins;
 * ties keep list order). Returns null when no known spellcasting class is present.
 */
export function inferSpellcastingAbility(classes: unknown): keyof AbilityScores | null {
  const parsed = parseCharacterClasses(classes);
  let best: { ability: keyof AbilityScores; level: number } | null = null;
  for (const entry of parsed) {
    const name = entry.name.trim().toLowerCase();
    for (const [ability, names] of SPELLCASTING_CLASS_ABILITIES) {
      if (names.has(name) && (!best || entry.level > best.level)) {
        best = { ability, level: entry.level };
      }
    }
  }
  return best?.ability ?? null;
}

export function resolveSpellcastingAbility(
  config: SpellcastingConfig,
  classes: unknown,
): keyof AbilityScores | null {
  if (config.ability === "none") {
    return null;
  }
  if (config.ability === "auto") {
    return inferSpellcastingAbility(classes);
  }
  return config.ability;
}

export function skillProficiencyLevel(
  profile: CharacterSkillProfile,
  key: SkillKey,
): SkillProficiencyLevel {
  if (profile.expertise.includes(key)) {
    return "expertise";
  }
  if (profile.proficiencies.includes(key)) {
    return "proficient";
  }
  return "none";
}

export function skillModifier(
  abilityMod: number,
  proficiency: SkillProficiencyLevel,
  proficiencyBonusValue: number,
): number {
  if (proficiency === "expertise") {
    return abilityMod + 2 * proficiencyBonusValue;
  }
  if (proficiency === "proficient") {
    return abilityMod + proficiencyBonusValue;
  }
  return abilityMod;
}

export function savingThrowModifier(
  abilityMod: number,
  proficient: boolean,
  proficiencyBonusValue: number,
): number {
  return proficient ? abilityMod + proficiencyBonusValue : abilityMod;
}

/** Passive score (2024): 10 + skill modifier. */
export function passiveScore(skillModifierValue: number): number {
  return 10 + skillModifierValue;
}

/** Spell save DC (2024): 8 + proficiency bonus + spellcasting ability modifier. */
export function spellSaveDc(abilityMod: number, proficiencyBonusValue: number): number {
  return 8 + proficiencyBonusValue + abilityMod;
}

/** Spell attack bonus (2024): proficiency bonus + spellcasting ability modifier. */
export function spellAttackBonus(abilityMod: number, proficiencyBonusValue: number): number {
  return proficiencyBonusValue + abilityMod;
}

export interface CharacterSavingThrowView {
  ability: keyof AbilityScores;
  modifier: number;
  proficient: boolean;
}

export interface CharacterSkillView {
  key: SkillKey;
  label: string;
  ability: keyof AbilityScores;
  proficiency: SkillProficiencyLevel;
  modifier: number;
  passive: number;
}

export interface CharacterDerivedStats {
  savingThrows: CharacterSavingThrowView[];
  skills: CharacterSkillView[];
  passivePerception: number;
  passiveInvestigation: number;
  passiveInsight: number;
  /** Raw setting from Character.spellcasting ("auto" resolves via classes). */
  spellcastingAbilitySetting: SpellcastingAbilitySetting;
  spellcastingAbility: keyof AbilityScores | null;
  spellSaveDc: number | null;
  spellAttackBonus: number | null;
}

export function computeCharacterDerivedStats(input: {
  abilities: AbilityScores;
  level: number;
  skills?: unknown;
  spellcasting?: unknown;
  classes?: unknown;
}): CharacterDerivedStats {
  const profBonus = proficiencyBonus(input.level);
  const profile = parseCharacterSkillProfile(input.skills);
  const spellcasting = parseSpellcastingConfig(input.spellcasting);

  const savingThrows: CharacterSavingThrowView[] = ABILITY_KEYS.map((ability) => {
    const proficient = profile.savingThrows.includes(ability);
    return {
      ability,
      proficient,
      modifier: savingThrowModifier(abilityModifier(input.abilities[ability]), proficient, profBonus),
    };
  });

  const skills: CharacterSkillView[] = SKILL_DEFINITIONS.map((definition) => {
    const proficiency = skillProficiencyLevel(profile, definition.key);
    const modifier = skillModifier(
      abilityModifier(input.abilities[definition.ability]),
      proficiency,
      profBonus,
    );
    return {
      key: definition.key,
      label: definition.label,
      ability: definition.ability,
      proficiency,
      modifier,
      passive: passiveScore(modifier),
    };
  });

  const passiveFor = (key: SkillKey): number =>
    skills.find((skill) => skill.key === key)?.passive ?? 10;

  const spellcastingAbility = resolveSpellcastingAbility(spellcasting, input.classes);
  const spellAbilityMod =
    spellcastingAbility !== null ? abilityModifier(input.abilities[spellcastingAbility]) : null;

  return {
    savingThrows,
    skills,
    passivePerception: passiveFor("perception"),
    passiveInvestigation: passiveFor("investigation"),
    passiveInsight: passiveFor("insight"),
    spellcastingAbilitySetting: spellcasting.ability,
    spellcastingAbility,
    spellSaveDc: spellAbilityMod !== null ? spellSaveDc(spellAbilityMod, profBonus) : null,
    spellAttackBonus: spellAbilityMod !== null ? spellAttackBonus(spellAbilityMod, profBonus) : null,
  };
}

const SKILL_FORM_PROFICIENCY_VALUES = new Set<SkillProficiencyLevel>([
  "none",
  "proficient",
  "expertise",
]);

/**
 * Reads proficiency/spellcasting form fields (skill_<key>, save_<ability>,
 * spellcastingAbility) from a parsed form payload. Returns only the parts that
 * were actually submitted so partial forms never wipe stored data.
 */
export function extractCharacterProficiencyFormInput(source: Record<string, unknown>): {
  skills?: CharacterSkillProfile;
  spellcasting?: SpellcastingConfig;
} {
  const profile: CharacterSkillProfile = { proficiencies: [], expertise: [], savingThrows: [] };
  let hasSkillInput = false;

  for (const definition of SKILL_DEFINITIONS) {
    const value = source[`skill_${definition.key}`];
    if (typeof value !== "string" || !SKILL_FORM_PROFICIENCY_VALUES.has(value as SkillProficiencyLevel)) {
      continue;
    }
    hasSkillInput = true;
    if (value === "expertise") {
      profile.expertise.push(definition.key);
      profile.proficiencies.push(definition.key);
    } else if (value === "proficient") {
      profile.proficiencies.push(definition.key);
    }
  }

  for (const ability of ABILITY_KEYS) {
    const value = source[`save_${ability}`];
    if (value !== "none" && value !== "proficient") {
      continue;
    }
    hasSkillInput = true;
    if (value === "proficient") {
      profile.savingThrows.push(ability);
    }
  }

  const abilityValue = source.spellcastingAbility;
  const spellcasting =
    abilityValue === "auto" ||
    abilityValue === "none" ||
    (typeof abilityValue === "string" && ABILITY_KEY_SET.has(abilityValue))
      ? parseSpellcastingConfig({ ability: abilityValue === "auto" ? undefined : abilityValue })
      : undefined;

  return {
    ...(hasSkillInput ? { skills: profile } : {}),
    ...(spellcasting ? { spellcasting } : {}),
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
  profile: {
    classes: unknown;
    species: unknown;
    background: unknown;
    features: unknown;
    bio: unknown;
  };
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
    | "species"
    | "background"
    | "features"
    | "bio"
    | "skills"
    | "spellcasting"
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
      displayName: string | null;
      school: string | null;
      description: string;
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
      displayName: spell.displayName,
      school: spell.school,
      description: spell.description,
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
    profile: {
      classes: character.classes,
      species: character.species,
      background: character.background,
      features: character.features,
      bio: character.bio,
    },
  };
}

export function buildCharacterSheetSnapshot(
  character: Pick<
    Character,
    "id" | "displayName" | "level" | "rulesEdition" | "abilities" | "combat" | "ownerUserId" | "pageId"
  > &
    Partial<Pick<Character, "skills" | "spellcasting" | "classes">>,
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
    derived: computeCharacterDerivedStats({
      abilities,
      level: character.level,
      skills: character.skills,
      spellcasting: character.spellcasting,
      classes: character.classes,
    }),
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
        species: input.species,
        background: input.background,
        features: input.features,
        bio: input.bio,
        skills: input.skills
          ? (parseCharacterSkillProfile(input.skills) as unknown as Prisma.InputJsonValue)
          : undefined,
        spellcasting: input.spellcasting
          ? (parseSpellcastingConfig(input.spellcasting) as unknown as Prisma.InputJsonValue)
          : undefined,
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
        displayName: input.displayName ?? null,
        school: input.school ?? null,
        description: input.description ?? "",
        notes: input.notes ?? "",
      },
      update: {
        spellLevel: input.spellLevel,
        prepared: input.prepared,
        source: input.source,
        displayName: input.displayName,
        school: input.school,
        description: input.description,
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
