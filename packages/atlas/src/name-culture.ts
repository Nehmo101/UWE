/**
 * Atlas culture-profile name generator ("Kulturprofile für Namen").
 *
 * Deterministic, offline place-name generator for regions, settlements,
 * rivers and mountains. Each `CultureProfile` is a small syllable grammar
 * (onsets/middles/per-kind endings) plus optional compound and prefix
 * flavour; `generatePlaceNames` composes names from a profile using the
 * shared `mulberry32` PRNG so the same inputs always produce the same list.
 *
 * Pure and framework-agnostic: no DOM, no Prisma, no AI calls. This module
 * only touches strings and the deterministic PRNG in `./prng`.
 */

import { hashStringToSeed, mulberry32 } from "./prng";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NameKind = "settlement" | "region" | "river" | "mountain";

export interface CultureProfile {
  /** Stable slug, e.g. "nordisch". Used as the lookup key and generation seed input. */
  key: string;
  /** German display name shown in UI pickers. */
  label: string;
  onsets: string[];
  middles: string[];
  endings: Record<NameKind, string[]>;
  /** Optional two-word/compound pattern chance 0..1 (e.g. "Kalt" + "wasser"). */
  compoundChance?: number;
  /** Optional standalone prefixes ("Alt-", "Ober-"), applied with a small fixed chance. */
  prefixes?: string[];
}

export interface GenerateNamesOptions {
  /** Culture profile key. Unknown keys fall back to `CULTURE_PROFILES[0]` (documented below). */
  culture: string;
  kind: NameKind;
  /** Number of names to generate. Default 8, clamped to [1, 24]. */
  count?: number;
  /** Explicit seed. Defaults to `hashStringToSeed(culture + kind)` for reproducibility without one. */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/** ≥6 German-flavored fantasy culture profiles. Order matters: index 0 is the fallback profile. */
export const CULTURE_PROFILES: readonly CultureProfile[] = [
  {
    key: "nordisch",
    label: "Nordisch",
    onsets: ["Thor", "Grim", "Ulf", "Bjor", "Stein", "Frost", "Vald", "Ragn", "Sig", "Ost", "Nord", "Hrafn"],
    middles: ["en", "ar", "ol", "or", "und", "in"],
    endings: {
      settlement: ["heim", "fjord", "gard", "borg", "vik", "holm"],
      region: ["mark", "land", "gau", "reik"],
      river: ["strom", "bach", "elv", "fluss"],
      mountain: ["fjell", "horn", "spitze", "klippe"],
    },
    compoundChance: 0.18,
    prefixes: ["Alt-", "Ober-", "Nieder-"],
  },
  {
    key: "elbisch",
    label: "Elbisch",
    onsets: ["Ael", "Sil", "Gal", "Lor", "Mith", "Eryn", "Cael", "Fael", "Ithil", "Nyra", "Elu", "Syl"],
    middles: ["ia", "ie", "ael", "il", "en", "or"],
    endings: {
      settlement: ["iel", "lond", "thil", "mir", "dor"],
      region: ["nor", "wen", "driel", "ath"],
      river: ["duin", "nen", "ril", "wen"],
      mountain: ["dor", "tir", "orod", "thal"],
    },
    compoundChance: 0.12,
    prefixes: ["Alt-", "Hoch-"],
  },
  {
    key: "zwergisch",
    label: "Zwergisch",
    onsets: ["Thrain", "Dur", "Grom", "Bal", "Karn", "Ug", "Thok", "Brom", "Krag", "Dor", "Nain", "Bofur"],
    middles: ["un", "or", "ak", "um", "ol", "in"],
    endings: {
      settlement: ["barak", "dun", "grimm", "hold", "feste"],
      region: ["reich", "mark", "hold"],
      river: ["bach", "quell", "strom"],
      mountain: ["berg", "klamm", "schacht", "horn"],
    },
    compoundChance: 0.2,
    prefixes: ["Unter-", "Ober-"],
  },
  {
    key: "wuestenland",
    label: "Wüstenländisch",
    onsets: ["Al", "Sar", "Kaz", "Zahir", "Bas", "Nadir", "Qasr", "Ras", "Tamir", "Zan", "Amir", "Yusar"],
    middles: ["a", "i", "u", "ar", "an", "ir"],
    endings: {
      settlement: ["abad", "iyya", "sar", "kand"],
      region: ["sahra", "stan", "iyya"],
      river: ["wadi", "nahr", "oase"],
      mountain: ["kamm", "dar", "jabal", "riff"],
    },
    compoundChance: 0.1,
    prefixes: ["Al-", "Bir-"],
  },
  {
    key: "imperial",
    label: "Imperial / Altweltlich",
    onsets: ["Val", "Cor", "Aur", "Sever", "Max", "Octa", "Luc", "Traja", "Domin", "Fla", "Ner", "Aug"],
    middles: ["an", "or", "in", "ur", "es", "ia"],
    endings: {
      settlement: ["ia", "polis", "anum", "opolis", "ium"],
      region: ["ien", "anien", "ia"],
      river: ["us", "fluvium", "onus"],
      mountain: ["mons", "us", "anum"],
    },
    compoundChance: 0.08,
    prefixes: ["Neu-", "Alt-"],
  },
  {
    key: "sumpfland",
    label: "Sumpfländisch",
    onsets: ["Schlick", "Moor", "Nebel", "Faul", "Ried", "Sump", "Kroet", "Morast", "Duster", "Trueb", "Moder", "Fenn"],
    middles: ["en", "el", "ig", "um", "ach", "or"],
    endings: {
      settlement: ["moor", "bruch", "fenn", "ried", "sumpf"],
      region: ["moor", "marsch", "bruch"],
      river: ["ried", "lache", "tuempel"],
      mountain: ["kuppe", "horst", "damm"],
    },
    compoundChance: 0.15,
    prefixes: ["Nieder-", "Hinter-"],
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Returns a mutable copy of all registered culture profiles. */
export function listCultureProfiles(): CultureProfile[] {
  return [...CULTURE_PROFILES];
}

/**
 * Looks up a culture profile by key. Returns `undefined` for a null/undefined
 * or unrecognised key — callers that need a guaranteed profile (like
 * {@link generatePlaceNames}) fall back to `CULTURE_PROFILES[0]` themselves.
 */
export function getCultureProfile(key: string | null | undefined): CultureProfile | undefined {
  if (!key) return undefined;
  return CULTURE_PROFILES.find((profile) => profile.key === key);
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const DEFAULT_COUNT = 8;
const MIN_COUNT = 1;
const MAX_COUNT = 24;
const MIDDLE_CHANCE = 0.55;
const PREFIX_CHANCE = 0.15;
/** Random-draw attempts per name slot before falling back to extended middles. */
const MAX_ATTEMPTS_PER_NAME = 60;
/** Extra middle-syllable rounds tried once plain random draws keep colliding. */
const MAX_EXTENDED_ROUNDS = 16;

function pick<T>(items: readonly T[], rng: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index] as T;
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Composes one candidate name: onset + (0-1, or `middleCount` when given)
 * middles + a kind-specific ending, then optionally fuses on a compound
 * modifier and/or a standalone prefix.
 */
function buildName(
  profile: CultureProfile,
  kind: NameKind,
  rng: () => number,
  middleCount?: number,
): string {
  const onset = pick(profile.onsets, rng).toLowerCase();
  const count = middleCount ?? (rng() < MIDDLE_CHANCE ? 1 : 0);
  let middles = "";
  for (let i = 0; i < count; i++) middles += pick(profile.middles, rng).toLowerCase();
  const ending = pick(profile.endings[kind], rng).toLowerCase();

  let core = onset + middles + ending;
  if (profile.compoundChance && rng() < profile.compoundChance) {
    core = pick(profile.onsets, rng).toLowerCase() + core;
  }

  let name = capitalize(core);
  if (profile.prefixes && profile.prefixes.length > 0 && rng() < PREFIX_CHANCE) {
    name = pick(profile.prefixes, rng) + name;
  }
  return name;
}

/**
 * Draws names until one is not already in `used`. First retries plain random
 * draws, then extends the middle-syllable count round by round (never a
 * numbered "Name 2" suffix) to widen the combinatorial space.
 */
function buildUniqueName(
  profile: CultureProfile,
  kind: NameKind,
  rng: () => number,
  used: Set<string>,
): string {
  for (let i = 0; i < MAX_ATTEMPTS_PER_NAME; i++) {
    const candidate = buildName(profile, kind, rng);
    if (!used.has(candidate)) return candidate;
  }
  for (let extra = 2; extra <= MAX_EXTENDED_ROUNDS; extra++) {
    for (let i = 0; i < MAX_ATTEMPTS_PER_NAME; i++) {
      const candidate = buildName(profile, kind, rng, extra);
      if (!used.has(candidate)) return candidate;
    }
  }
  // Practically unreachable given profile pool sizes vs. MAX_COUNT, but keep
  // generation total in the extreme case rather than looping forever.
  return buildName(profile, kind, rng, MAX_EXTENDED_ROUNDS);
}

function clampCount(count: number | undefined): number {
  const raw = Number.isFinite(count) ? (count as number) : DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(raw)));
}

/**
 * Generates a deterministic list of place names for a culture profile and
 * {@link NameKind}. Same `opts` always yields the same list (same order, same
 * strings); an unknown `culture` key falls back to `CULTURE_PROFILES[0]`.
 *
 * @param opts.culture - Culture profile key; see {@link CULTURE_PROFILES}.
 * @param opts.kind    - Which kind of place to name.
 * @param opts.count   - How many names to return (default 8, clamped 1..24).
 * @param opts.seed    - Explicit PRNG seed; defaults to `hashStringToSeed(culture + kind)`.
 */
export function generatePlaceNames(opts: GenerateNamesOptions): string[] {
  const profile = getCultureProfile(opts.culture) ?? CULTURE_PROFILES[0];
  if (!profile) return [];

  const count = clampCount(opts.count);
  const seed = opts.seed ?? hashStringToSeed(opts.culture + opts.kind);
  const rng = mulberry32(seed);

  const used = new Set<string>();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = buildUniqueName(profile, opts.kind, rng, used);
    used.add(name);
    names.push(name);
  }
  return names;
}
