/**
 * Typisiertes Editor-Modell über dem StructuredStatblock.data-JSON.
 *
 * `statblockDraftFromData` normalisiert lose JSON-Daten (inkl. Open5e-Aliase wie
 * `armor_class`, `hit_points`, `strength`…) in ein Formular-freundliches Draft;
 * unbekannte Felder werden als `extras` erhalten und beim Serialisieren
 * (`statblockDraftToData`) unverändert zurückgeschrieben.
 */

export const STATBLOCK_ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export type StatblockAbilityKey = (typeof STATBLOCK_ABILITY_KEYS)[number];

export type StatblockAbilityScores = Record<StatblockAbilityKey, number>;

export interface StatblockEntryDraft {
  name: string;
  desc: string;
}

export const STATBLOCK_ENTRY_SECTIONS = [
  "traits",
  "actions",
  "reactions",
  "legendaryActions",
] as const;

export type StatblockEntrySection = (typeof STATBLOCK_ENTRY_SECTIONS)[number];

export interface StructuredStatblockDraft {
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: string;
  hp: string;
  hitDice: string;
  speed: string;
  cr: string;
  abilities: StatblockAbilityScores;
  saves: string;
  skills: string;
  senses: string;
  languages: string;
  traits: StatblockEntryDraft[];
  actions: StatblockEntryDraft[];
  reactions: StatblockEntryDraft[];
  legendaryActions: StatblockEntryDraft[];
}

export interface StructuredStatblockDraftResult {
  draft: StructuredStatblockDraft;
  /** Nicht vom Editor abgedeckte Felder — bleiben beim Speichern erhalten. */
  extras: Record<string, unknown>;
}

const ABILITY_ALIASES: Record<StatblockAbilityKey, string> = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asScalarText(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatAbilityModifier(score: number): string {
  const mod = abilityModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function createEmptyStatblockDraft(): StructuredStatblockDraft {
  return {
    name: "",
    size: "",
    type: "",
    alignment: "",
    ac: "",
    hp: "",
    hitDice: "",
    speed: "",
    cr: "",
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saves: "",
    skills: "",
    senses: "",
    languages: "",
    traits: [],
    actions: [],
    reactions: [],
    legendaryActions: [],
  };
}

function formatSpeedValue(speed: unknown): string {
  const text = asScalarText(speed);
  if (text) {
    return text;
  }
  const record = asRecord(speed);
  if (!record) {
    return "";
  }
  const parts = Object.entries(record)
    .map(([key, value]) => {
      if (value == null || value === false) return null;
      if (value === true) return key;
      const amount = asScalarText(value);
      return amount ? `${key} ${amount} ft.` : null;
    })
    .filter((part): part is string => Boolean(part));
  return parts.join(", ");
}

function formatKeyValuePairs(value: unknown): string {
  const text = asScalarText(value);
  if (text) {
    return text;
  }
  const record = asRecord(value);
  if (!record) {
    return "";
  }
  const parts = Object.entries(record)
    .map(([key, entry]) => {
      const amount = asScalarText(entry);
      if (amount == null) return null;
      const numeric = Number(amount);
      const label = Number.isFinite(numeric) && numeric >= 0 && !amount.startsWith("+")
        ? `+${numeric}`
        : amount;
      return `${capitalize(key)} ${label}`;
    })
    .filter((part): part is string => Boolean(part));
  return parts.join(", ");
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function parseEntries(value: unknown): StatblockEntryDraft[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: StatblockEntryDraft[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const name = asScalarText(record.name) ?? "";
    const desc = asScalarText(record.desc) ?? asScalarText(record.description) ?? "";
    if (!name && !desc) continue;
    entries.push({ name, desc });
  }
  return entries;
}

function parseAbilities(record: Record<string, unknown>): StatblockAbilityScores {
  const abilities = createEmptyStatblockDraft().abilities;
  const nested = asRecord(record.abilities);
  for (const key of STATBLOCK_ABILITY_KEYS) {
    const raw = nested?.[key] ?? record[ABILITY_ALIASES[key]];
    const score = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(asScalarText(raw));
    if (Number.isFinite(score)) {
      abilities[key] = score;
    }
  }
  return abilities;
}

function collectSaves(record: Record<string, unknown>): string {
  const direct = asScalarText(record.saves) ?? asScalarText(record.saving_throws);
  if (direct) {
    return direct;
  }
  const parts: string[] = [];
  for (const key of STATBLOCK_ABILITY_KEYS) {
    const raw = record[`${ABILITY_ALIASES[key]}_save`];
    const value = asScalarText(raw);
    if (value == null) continue;
    const numeric = Number(value);
    const label = Number.isFinite(numeric) && numeric >= 0 && !value.startsWith("+")
      ? `+${numeric}`
      : value;
    parts.push(`${capitalize(key)} ${label}`);
  }
  return parts.join(", ");
}

/** Vom Editor abgedeckte Felder inkl. Aliase — landen nicht in `extras`. */
const CONSUMED_KEYS = new Set<string>([
  "name",
  "size",
  "type",
  "alignment",
  "ac",
  "armor_class",
  "armorClass",
  "hp",
  "hit_points",
  "hitPoints",
  "hit_dice",
  "hitDice",
  "speed",
  "cr",
  "challenge_rating",
  "challengeRating",
  "abilities",
  ...Object.values(ABILITY_ALIASES),
  "saves",
  "saving_throws",
  ...STATBLOCK_ABILITY_KEYS.map((key) => `${ABILITY_ALIASES[key]}_save`),
  "skills",
  "senses",
  "languages",
  "traits",
  "special_abilities",
  "specialAbilities",
  "actions",
  "reactions",
  "legendary_actions",
  "legendaryActions",
]);

export function statblockDraftFromData(data: unknown): StructuredStatblockDraftResult {
  const record = asRecord(data);
  const draft = createEmptyStatblockDraft();
  if (!record) {
    return { draft, extras: {} };
  }

  draft.name = asScalarText(record.name) ?? "";
  draft.size = asScalarText(record.size) ?? "";
  draft.type = asScalarText(record.type) ?? "";
  draft.alignment = asScalarText(record.alignment) ?? "";
  draft.ac = asScalarText(record.ac ?? record.armor_class ?? record.armorClass) ?? "";
  draft.hp = asScalarText(record.hp ?? record.hit_points ?? record.hitPoints) ?? "";
  draft.hitDice = asScalarText(record.hit_dice ?? record.hitDice) ?? "";
  draft.speed = formatSpeedValue(record.speed);
  draft.cr = asScalarText(record.cr ?? record.challenge_rating ?? record.challengeRating) ?? "";
  draft.abilities = parseAbilities(record);
  draft.saves = collectSaves(record);
  draft.skills = formatKeyValuePairs(record.skills);
  draft.senses = asScalarText(record.senses) ?? "";
  draft.languages = asScalarText(record.languages) ?? "";
  draft.traits = parseEntries(record.traits ?? record.special_abilities ?? record.specialAbilities);
  draft.actions = parseEntries(record.actions);
  draft.reactions = parseEntries(record.reactions);
  draft.legendaryActions = parseEntries(record.legendary_actions ?? record.legendaryActions);

  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!CONSUMED_KEYS.has(key)) {
      extras[key] = value;
    }
  }

  return { draft, extras };
}

function numericOrText(value: string): number | string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed) ? numeric : trimmed;
}

function serializedEntries(entries: StatblockEntryDraft[]): Array<{ name: string; desc: string }> {
  return entries
    .filter((entry) => entry.name.trim() || entry.desc.trim())
    .map((entry) => ({ name: entry.name.trim(), desc: entry.desc.trim() }));
}

export function statblockDraftToData(
  draft: StructuredStatblockDraft,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...extras };

  const setText = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      data[key] = trimmed;
    }
  };

  setText("name", draft.name);
  setText("size", draft.size);
  setText("type", draft.type);
  setText("alignment", draft.alignment);

  const ac = numericOrText(draft.ac);
  if (ac !== "") data.ac = ac;
  const hp = numericOrText(draft.hp);
  if (hp !== "") data.hp = hp;

  setText("hit_dice", draft.hitDice);
  setText("speed", draft.speed);
  setText("cr", draft.cr);

  data.abilities = { ...draft.abilities };

  setText("saves", draft.saves);
  setText("skills", draft.skills);
  setText("senses", draft.senses);
  setText("languages", draft.languages);

  const sections: Array<[string, StatblockEntryDraft[]]> = [
    ["traits", draft.traits],
    ["actions", draft.actions],
    ["reactions", draft.reactions],
    ["legendary_actions", draft.legendaryActions],
  ];
  for (const [key, entries] of sections) {
    const serialized = serializedEntries(entries);
    if (serialized.length > 0) {
      data[key] = serialized;
    }
  }

  return data;
}

export function validateStatblockDraft(draft: StructuredStatblockDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) {
    errors.push("Name ist erforderlich.");
  }
  for (const key of STATBLOCK_ABILITY_KEYS) {
    const score = draft.abilities[key];
    if (!Number.isInteger(score) || score < 0 || score > 40) {
      errors.push(`Attributswert ${key.toUpperCase()} muss eine ganze Zahl zwischen 0 und 40 sein.`);
    }
  }
  return errors;
}
