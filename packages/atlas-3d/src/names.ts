/**
 * Deterministic place-name generator — syllable compositor per culture.
 * Hash-based (no Math.random/Date): same (culture, seed, index) → same name.
 */

export const NAME_CULTURES = [
  { key: "nordisch", label: "Nordisch" },
  { key: "romanisch", label: "Romanisch" },
  { key: "wuesten", label: "Wüsten" },
  { key: "sylvan", label: "Sylvan" },
] as const;

export type NameCulture = (typeof NAME_CULTURES)[number];
export type NameCultureKey = NameCulture["key"];

function hash01(a: number, b: number, seed: number): number {
  let n = Math.imul(Math.round(a * 8191) + Math.round(b * 131071) + seed * 7919, 2654435761);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

interface SyllableSet {
  starts: readonly string[];
  middles: readonly string[];
  ends: readonly string[];
  /** Culture-appropriate prefixes ("Burg …"), applied with ~20 % hash chance. */
  prefixes: readonly string[];
}

const SYLLABLES: Record<NameCultureKey, SyllableSet> = {
  nordisch: {
    starts: [
      "skjal", "thor", "bjor", "grim", "hal", "ulf", "rag", "sig",
      "frost", "jar", "sten", "vald", "knud", "hrim", "eir", "brand",
    ],
    middles: [
      "dur", "gar", "vik", "hei", "mun", "fjor", "grim", "bran",
      "ska", "run", "vald", "sten", "ing", "ald",
    ],
    ends: [
      "heim", "gard", "fjell", "vik", "borg", "stad", "ness", "dal",
      "fors", "holm", "und", "berg", "lund", "voll",
    ],
    prefixes: ["Burg", "Kap", "Alt"],
  },
  romanisch: {
    starts: [
      "val", "mar", "cor", "lus", "ter", "auren", "bel", "cas",
      "flor", "sol", "vero", "pal", "ros", "luc", "monta", "seren",
    ],
    middles: [
      "en", "ara", "ino", "ella", "ori", "ave", "ent", "ura",
      "ali", "esta", "ome", "ivo", "ana", "eri",
    ],
    ends: [
      "cia", "na", "to", "ria", "lia", "mo", "sca", "dora",
      "via", "netta", "ro", "sina", "gio", "ta",
    ],
    prefixes: ["San", "Val", "Porta"],
  },
  wuesten: {
    starts: [
      "al", "qas", "zah", "mir", "sah", "kha", "dun", "raq",
      "azi", "bahr", "jam", "nur", "tar", "wad", "fay", "sul",
    ],
    middles: [
      "qas", "rah", "mad", "shir", "ala", "zir", "bat", "har",
      "ise", "dai", "mun", "sab", "ori", "kal",
    ],
    ends: [
      "rah", "im", "dar", "oun", "esh", "ara", "uk", "eya",
      "ain", "as", "ir", "um", "ada", "an",
    ],
    prefixes: ["Oase", "Wadi", "Ksar"],
  },
  sylvan: {
    starts: [
      "el", "syl", "thal", "lor", "ael", "fae", "ily", "nym",
      "ere", "cael", "myr", "ola", "quel", "sere", "ithi", "yva",
    ],
    middles: [
      "ora", "iel", "an", "wyn", "ala", "eth", "ion", "ara",
      "il", "ene", "ova", "yri", "ael", "isse",
    ],
    ends: [
      "thil", "lorn", "wen", "dis", "riel", "las", "mira", "neth",
      "sylv", "iel", "dor", "wyn", "nis", "rae",
    ],
    prefixes: ["Tal", "Hain", "Alt"],
  },
};

function pick(list: readonly string[], slot: number, index: number, seed: number): string {
  return list[Math.floor(hash01(index, slot, seed) * list.length) % list.length];
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const MAX_NAME_LENGTH = 20;

/**
 * Deterministic place name for a culture: 2-3 syllables, capitalized, with a
 * ~20 % chance of a culture-appropriate prefix ("Burg …").
 */
export function generatePlaceName(culture: NameCultureKey, seed: number, index = 0): string {
  const set = SYLLABLES[culture];
  const cultureSalt = NAME_CULTURES.findIndex((c) => c.key === culture) * 5077 + 101;
  const localSeed = seed * 31 + cultureSalt;

  const useMiddle = hash01(index, 1, localSeed) < 0.55;
  let core = pick(set.starts, 2, index, localSeed);
  if (useMiddle) core += pick(set.middles, 3, index, localSeed);
  core += pick(set.ends, 4, index, localSeed);
  let name = capitalize(core);

  if (hash01(index, 5, localSeed) < 0.2) {
    const prefix = pick(set.prefixes, 6, index, localSeed);
    const prefixed = `${prefix} ${name}`;
    if (prefixed.length <= MAX_NAME_LENGTH) name = prefixed;
  }
  if (name.length > MAX_NAME_LENGTH) {
    name = capitalize(pick(set.starts, 2, index, localSeed) + pick(set.ends, 4, index, localSeed));
  }
  return name;
}

/**
 * `count` unique name suggestions; on a collision the index keeps counting so
 * the list stays deterministic and free of duplicates.
 */
export function generateNameSuggestions(culture: NameCultureKey, seed: number, count: number): string[] {
  const wanted = Math.max(0, Math.floor(count));
  const names: string[] = [];
  const seen = new Set<string>();
  const maxAttempts = Math.max(64, wanted * 50);
  for (let index = 0; names.length < wanted && index < maxAttempts; index++) {
    const name = generatePlaceName(culture, seed, index);
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}
