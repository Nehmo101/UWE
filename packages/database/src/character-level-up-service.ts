import {
  abilityModifier,
  parseAbilityScores,
  parseCharacterCombat,
  proficiencyBonus,
} from "./character-service";
import {
  computeSpellSlots,
  parseCharacterClasses,
  type CharacterClassEntry,
} from "./character-spell-service";

export const PICKABLE_CLASSES = [
  "Barbar",
  "Barde",
  "Kleriker",
  "Druide",
  "Kämpfer",
  "Mönch",
  "Paladin",
  "Waldläufer",
  "Schurke",
  "Hexenmeister",
  "Hexenpakt-Magier",
  "Zauberer",
] as const;

export type PickableClassName = (typeof PICKABLE_CLASSES)[number];

export type LevelUpFieldKey =
  | "level"
  | "maxHp"
  | "currentHp"
  | "classes"
  | "proficiencyBonus"
  | "spellSlots";

export interface LevelUpFieldSuggestion {
  key: LevelUpFieldKey;
  label: string;
  hint: string;
  currentDisplay: string;
  suggestedDisplay: string;
  /** Whether the user can opt in to apply this change */
  applyable: boolean;
  /** Suggested numeric value for HP fields */
  suggestedValue?: number;
}

export interface LevelUpSuggestions {
  fromLevel: number;
  toLevel: number;
  needsClassPicker: boolean;
  classOptions: readonly string[];
  primaryClass: string | null;
  hitDie: number;
  hpRollHint: string;
  suggestedHpIncrease: number;
  fields: LevelUpFieldSuggestion[];
}

export interface LevelUpCharacterInput {
  level: number;
  classes: unknown;
  abilities: unknown;
  combat: unknown;
}

export interface ApplyLevelUpOptions {
  pickedClass?: string;
  hpIncrease?: number;
  applyLevel?: boolean;
  applyMaxHp?: boolean;
  applyCurrentHp?: boolean;
  applyClasses?: boolean;
}

export interface LevelUpApplyPayload {
  level?: number;
  classes?: CharacterClassEntry[];
  combat?: {
    maxHp?: number | null;
    currentHp?: number | null;
  };
}

const CLASS_HIT_DIE: Record<string, number> = {
  barbarian: 12,
  barbar: 12,
  bard: 8,
  barde: 8,
  cleric: 8,
  kleriker: 8,
  druid: 8,
  druide: 8,
  fighter: 10,
  kämpfer: 10,
  kampfer: 10,
  monk: 8,
  mönch: 8,
  monch: 8,
  paladin: 10,
  ranger: 10,
  waldlaufer: 10,
  "waldläufer": 10,
  rogue: 8,
  schurke: 8,
  sorcerer: 6,
  hexenmeister: 6,
  warlock: 8,
  "hexenpakt-magier": 8,
  hexenpakt: 8,
  wizard: 6,
  zauberer: 6,
};

function normalizeClassName(name: string): string {
  return name.trim().toLowerCase();
}

export function getClassHitDie(className: string): number {
  return CLASS_HIT_DIE[normalizeClassName(className)] ?? 8;
}

function averageHitDieRoll(hitDie: number): number {
  return Math.floor(hitDie / 2) + 1;
}

function resolvePrimaryClass(
  classes: CharacterClassEntry[],
  pickedClass?: string,
): string {
  if (pickedClass?.trim()) {
    return pickedClass.trim();
  }
  if (classes.length > 0) {
    return classes[0]?.name ?? PICKABLE_CLASSES[4];
  }
  return PICKABLE_CLASSES[4];
}

function bumpClasses(
  classes: CharacterClassEntry[],
  className: string,
  toLevel: number,
): CharacterClassEntry[] {
  if (classes.length === 0) {
    return [{ name: className, level: toLevel }];
  }

  const normalized = normalizeClassName(className);
  const matchIndex = classes.findIndex(
    (entry) => normalizeClassName(entry.name) === normalized,
  );

  if (matchIndex >= 0) {
    return classes.map((entry, index) =>
      index === matchIndex ? { ...entry, level: entry.level + 1 } : entry,
    );
  }

  return [...classes, { name: className, level: 1 }];
}

function formatSpellSlotMap(slots: Record<number, number>): string {
  const levels = Object.keys(slots)
    .map(Number)
    .sort((a, b) => a - b);
  if (levels.length === 0) {
    return "Keine";
  }
  return levels.map((level) => `Grad ${level}: ${slots[level]}`).join(", ");
}

function describeSpellSlotDelta(
  before: Record<number, number>,
  after: Record<number, number>,
): string {
  const levels = new Set([...Object.keys(before), ...Object.keys(after)].map(Number));
  const changes: string[] = [];

  for (const level of [...levels].sort((a, b) => a - b)) {
    const prev = before[level] ?? 0;
    const next = after[level] ?? 0;
    if (next > prev) {
      changes.push(`Grad ${level}: ${prev} → ${next}`);
    } else if (next < prev) {
      changes.push(`Grad ${level}: ${prev} → ${next}`);
    }
  }

  if (changes.length === 0) {
    return "Keine Änderung";
  }
  return changes.join("; ");
}

export function buildLevelUpSuggestions(
  input: LevelUpCharacterInput,
  options?: { pickedClass?: string },
): LevelUpSuggestions | null {
  const fromLevel = Math.floor(input.level);
  if (fromLevel >= 20) {
    return null;
  }

  const toLevel = fromLevel + 1;
  const parsedClasses = parseCharacterClasses(input.classes);
  const abilities = parseAbilityScores(input.abilities);
  const combat = parseCharacterCombat(input.combat);
  const conMod = abilityModifier(abilities.constitution);

  const primaryClass = resolvePrimaryClass(parsedClasses, options?.pickedClass);
  const hitDie = getClassHitDie(primaryClass);
  const suggestedHpIncrease = Math.max(1, averageHitDieRoll(hitDie) + conMod);
  const hpRollHint = `Würfle 1W${hitDie}${conMod >= 0 ? "+" : ""}${conMod} (Durchschnitt: ${suggestedHpIncrease})`;

  const currentMaxHp = combat.maxHp ?? null;
  const currentHp = combat.currentHp ?? null;
  const suggestedMaxHp =
    currentMaxHp !== null ? currentMaxHp + suggestedHpIncrease : suggestedHpIncrease;
  const suggestedCurrentHp =
    currentHp !== null ? currentHp + suggestedHpIncrease : suggestedMaxHp;

  const nextClasses = bumpClasses(parsedClasses, primaryClass, toLevel);
  const slotsBefore = computeSpellSlots(fromLevel, parsedClasses.length > 0 ? parsedClasses : input.classes);
  const slotsAfter = computeSpellSlots(toLevel, nextClasses);

  const profBefore = proficiencyBonus(fromLevel);
  const profAfter = proficiencyBonus(toLevel);

  const fields: LevelUpFieldSuggestion[] = [
    {
      key: "level",
      label: "Stufe",
      hint: "Charakterstufe erhöhen",
      currentDisplay: String(fromLevel),
      suggestedDisplay: String(toLevel),
      applyable: true,
    },
    {
      key: "maxHp",
      label: "Max. Trefferpunkte",
      hint: hpRollHint,
      currentDisplay: currentMaxHp !== null ? String(currentMaxHp) : "—",
      suggestedDisplay: String(suggestedMaxHp),
      applyable: true,
      suggestedValue: suggestedHpIncrease,
    },
    {
      key: "currentHp",
      label: "Aktuelle Trefferpunkte",
      hint: "Optional: gleiche HP-Erhöhung auf aktuelle TP anwenden",
      currentDisplay: currentHp !== null ? String(currentHp) : "—",
      suggestedDisplay: String(suggestedCurrentHp),
      applyable: currentHp !== null,
      suggestedValue: suggestedHpIncrease,
    },
    {
      key: "classes",
      label: "Klassen",
      hint: parsedClasses.length === 0 ? "Primärklasse speichern" : "Klassenstufe erhöhen",
      currentDisplay:
        parsedClasses.length === 0
          ? "—"
          : parsedClasses.map((entry) => `${entry.name} ${entry.level}`).join(", "),
      suggestedDisplay: nextClasses.map((entry) => `${entry.name} ${entry.level}`).join(", "),
      applyable: true,
    },
    {
      key: "proficiencyBonus",
      label: "Übungsbonus",
      hint: "Wird automatisch aus der Stufe berechnet",
      currentDisplay: profBefore >= 0 ? `+${profBefore}` : String(profBefore),
      suggestedDisplay: profAfter >= 0 ? `+${profAfter}` : String(profAfter),
      applyable: false,
    },
    {
      key: "spellSlots",
      label: "Zauberplätze",
      hint: describeSpellSlotDelta(slotsBefore.byLevel, slotsAfter.byLevel),
      currentDisplay: formatSpellSlotMap(slotsBefore.byLevel),
      suggestedDisplay: formatSpellSlotMap(slotsAfter.byLevel),
      applyable: false,
    },
  ];

  return {
    fromLevel,
    toLevel,
    needsClassPicker: parsedClasses.length === 0,
    classOptions: PICKABLE_CLASSES,
    primaryClass: parsedClasses.length === 0 ? primaryClass : parsedClasses[0]?.name ?? primaryClass,
    hitDie,
    hpRollHint,
    suggestedHpIncrease,
    fields,
  };
}

export function buildLevelUpApplyPayload(
  input: LevelUpCharacterInput,
  options: ApplyLevelUpOptions,
): LevelUpApplyPayload | null {
  const suggestions = buildLevelUpSuggestions(input, {
    pickedClass: options.pickedClass,
  });
  if (!suggestions) {
    return null;
  }

  const parsedClasses = parseCharacterClasses(input.classes);
  const combat = parseCharacterCombat(input.combat);
  const hpIncrease = options.hpIncrease ?? suggestions.suggestedHpIncrease;
  const primaryClass = resolvePrimaryClass(parsedClasses, options.pickedClass);

  const payload: LevelUpApplyPayload = {};

  if (options.applyLevel) {
    payload.level = suggestions.toLevel;
  }

  if (options.applyClasses) {
    payload.classes = bumpClasses(parsedClasses, primaryClass, suggestions.toLevel);
  }

  const combatUpdate: NonNullable<LevelUpApplyPayload["combat"]> = {};

  if (options.applyMaxHp) {
    const currentMaxHp = combat.maxHp ?? 0;
    combatUpdate.maxHp = currentMaxHp + hpIncrease;
  }

  if (options.applyCurrentHp && combat.currentHp !== null && combat.currentHp !== undefined) {
    combatUpdate.currentHp = combat.currentHp + hpIncrease;
  }

  if (Object.keys(combatUpdate).length > 0) {
    payload.combat = combatUpdate;
  }

  if (
    !payload.level &&
    !payload.classes &&
    !payload.combat
  ) {
    return null;
  }

  return payload;
}
