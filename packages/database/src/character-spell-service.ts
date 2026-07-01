import type { CharacterSpell, PrismaClient } from "./generated/prisma/client";
import { slugifyKey } from "@uwe/shared-utils";

export interface CharacterClassEntry {
  name: string;
  level: number;
}

export interface CharacterSpellView {
  id: string;
  spellKey: string;
  displayName: string;
  spellLevel: number;
  prepared: boolean;
  source: string | null;
  notes: string;
}

export interface ParsedHomebrewSpell {
  spellKey: string;
  displayName: string;
  spellLevel: number;
  prepared: boolean;
  source: "homebrew";
  notes: string;
}

export interface SpellSlotSummary {
  /** Spell level (1–9) → available slots */
  byLevel: Record<number, number>;
  /** Effective caster level used for the table */
  casterLevel: number;
}

const FULL_CASTER_SLOT_TABLE: ReadonlyArray<readonly [number, number, number, number, number, number, number, number, number]> = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const FULL_CASTER_CLASS_NAMES = new Set([
  "wizard",
  "zauberer",
  "cleric",
  "kleriker",
  "druid",
  "druide",
  "sorcerer",
  "hexenmeister",
  "bard",
  "barde",
]);

const HALF_CASTER_CLASS_NAMES = new Set([
  "paladin",
  "paladin",
  "ranger",
  "waldlaufer",
  "warlock",
  "hexenpakt",
]);

const THIRD_CASTER_CLASS_NAMES = new Set([
  "eldritch knight",
  "arkane ritter",
  "arcane trickster",
  "arkane trickster",
]);

function normalizeClassName(name: string): string {
  return name.trim().toLowerCase();
}

export function parseCharacterClasses(raw: unknown): CharacterClassEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const classes: CharacterClassEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const source = entry as Record<string, unknown>;
    const name = typeof source.name === "string" ? source.name.trim() : "";
    const level =
      typeof source.level === "number" && Number.isFinite(source.level)
        ? Math.max(0, Math.floor(source.level))
        : 0;
    if (name && level > 0) {
      classes.push({ name, level });
    }
  }
  return classes;
}

export function effectiveCasterLevel(level: number, classes: unknown): number {
  const parsed = parseCharacterClasses(classes);
  if (parsed.length === 0) {
    return Math.max(0, Math.min(20, Math.floor(level)));
  }

  let total = 0;
  for (const entry of parsed) {
    const key = normalizeClassName(entry.name);
    if (FULL_CASTER_CLASS_NAMES.has(key)) {
      total += entry.level;
    } else if (HALF_CASTER_CLASS_NAMES.has(key)) {
      total += Math.floor(entry.level / 2);
    } else if (THIRD_CASTER_CLASS_NAMES.has(key)) {
      total += Math.floor(entry.level / 3);
    }
  }

  return Math.max(0, Math.min(20, total));
}

export function computeSpellSlots(level: number, classes: unknown): SpellSlotSummary {
  const casterLevel = effectiveCasterLevel(level, classes);
  const row = FULL_CASTER_SLOT_TABLE[casterLevel] ?? FULL_CASTER_SLOT_TABLE[0];
  const byLevel: Record<number, number> = {};

  row.forEach((slots, index) => {
    if (slots > 0) {
      byLevel[index + 1] = slots;
    }
  });

  return { byLevel, casterLevel };
}

export function formatSpellDisplayName(spellKey: string, notes?: string, source?: string | null): string {
  if (source === "homebrew" && notes?.trim()) {
    return notes.trim();
  }
  if (spellKey.startsWith("homebrew:")) {
    return spellKey.slice("homebrew:".length).replace(/-/g, " ");
  }
  return spellKey.replace(/-/g, " ");
}

export function toCharacterSpellView(spell: CharacterSpell): CharacterSpellView {
  return {
    id: spell.id,
    spellKey: spell.spellKey,
    displayName: formatSpellDisplayName(spell.spellKey, spell.notes, spell.source),
    spellLevel: spell.spellLevel,
    prepared: spell.prepared,
    source: spell.source,
    notes: spell.notes,
  };
}

export function extractOpen5eSpellLevel(raw: unknown): number {
  if (!raw || typeof raw !== "object") {
    return 0;
  }
  const source = raw as Record<string, unknown>;
  const level = source.level ?? source.spell_level;
  if (typeof level === "number" && Number.isFinite(level)) {
    return Math.max(0, Math.min(9, Math.floor(level)));
  }
  if (typeof level === "string") {
    const match = level.match(/(\d+)/);
    if (match) {
      return Math.max(0, Math.min(9, Number.parseInt(match[1] ?? "0", 10)));
    }
    if (level.toLowerCase().includes("cantrip")) {
      return 0;
    }
  }
  return 0;
}

export function buildHomebrewSpellKey(name: string): string {
  return `homebrew:${slugifyKey(name, "spell")}`;
}

export function parseHomebrewSpellInput(input: {
  name?: string;
  spellLevel?: unknown;
  prepared?: unknown;
}): ParsedHomebrewSpell | null {
  const name = input.name?.trim() ?? "";
  if (!name) {
    return null;
  }

  const levelRaw = input.spellLevel;
  let spellLevel = 0;
  if (typeof levelRaw === "number" && Number.isFinite(levelRaw)) {
    spellLevel = Math.max(0, Math.min(9, Math.floor(levelRaw)));
  } else if (typeof levelRaw === "string" && levelRaw.trim()) {
    const parsed = Number.parseInt(levelRaw, 10);
    if (Number.isFinite(parsed)) {
      spellLevel = Math.max(0, Math.min(9, parsed));
    }
  }

  const prepared =
    input.prepared === true ||
    input.prepared === "true" ||
    input.prepared === "on" ||
    input.prepared === "1";

  return {
    spellKey: buildHomebrewSpellKey(name),
    displayName: name,
    spellLevel,
    prepared,
    source: "homebrew",
    notes: name,
  };
}

export class CharacterSpellService {
  constructor(private readonly db: PrismaClient) {}

  async listSpells(characterId: string): Promise<CharacterSpellView[]> {
    const spells = await this.db.characterSpell.findMany({
      where: { characterId },
      orderBy: [{ spellLevel: "asc" }, { spellKey: "asc" }],
    });
    return spells.map(toCharacterSpellView);
  }

  async removeSpell(characterId: string, spellKey: string): Promise<boolean> {
    const result = await this.db.characterSpell.deleteMany({
      where: { characterId, spellKey },
    });
    return result.count > 0;
  }

  async setPrepared(characterId: string, spellKey: string, prepared: boolean) {
    return this.db.characterSpell.update({
      where: {
        characterId_spellKey: { characterId, spellKey },
      },
      data: { prepared },
    });
  }
}

export function createCharacterSpellService(db: PrismaClient): CharacterSpellService {
  return new CharacterSpellService(db);
}
