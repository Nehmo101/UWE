import {
  analyzeEncounterXp,
  getEncounterBudgetThresholds,
  xpForChallengeRating,
  type EncounterBudgetThresholds,
  type EncounterXpAnalysis,
} from "./encounter-xp-budget";

export interface EncounterCandidate {
  name: string;
  slug: string;
  cr: string;
}

export type EncounterStyle = "boss" | "horde" | "mixed";
export type EncounterTargetDifficulty = "easy" | "medium" | "hard" | "deadly";

export interface EncounterCompositionEntry {
  monster: EncounterCandidate;
  count: number;
}

export interface EncounterComposition {
  entries: EncounterCompositionEntry[];
  analysis: EncounterXpAnalysis;
  targetXp: number;
  capXp: number;
  style: EncounterStyle;
}

export interface EncounterCompositionInput {
  partyLevel: number;
  partySize: number;
  difficulty: EncounterTargetDifficulty;
  style?: EncounterStyle;
  candidates: EncounterCandidate[];
  maxMonsters?: number;
  /** Injectable RNG for reproducible tests; defaults to Math.random. */
  random?: () => number;
}

/** Challenge ratings ordered by XP, for choosing sensible candidate buckets. */
export const ORDERED_CHALLENGE_RATINGS = [
  "0",
  "1/8",
  "1/4",
  "1/2",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
] as const;

/** Largest CR whose single-monster XP fits within the given XP amount. */
export function challengeRatingForXp(xp: number): string {
  let best: string = ORDERED_CHALLENGE_RATINGS[0];
  for (const cr of ORDERED_CHALLENGE_RATINGS) {
    if (xpForChallengeRating(cr) <= xp) {
      best = cr;
    } else {
      break;
    }
  }
  return best;
}

/**
 * CR buckets worth fetching as candidates for a party/difficulty combination:
 * boss CR (fills the budget alone), a mid CR (~half budget) and two minion
 * CR buckets (~1/8 budget). Deduplicated, ordered high→low.
 */
export function suggestCandidateChallengeRatings(
  partyLevel: number,
  partySize: number,
  difficulty: EncounterTargetDifficulty,
): string[] {
  const thresholds = getEncounterBudgetThresholds(partyLevel, partySize);
  const target = thresholds[difficulty];

  const bossCr = challengeRatingForXp(target);
  const midCr = challengeRatingForXp(Math.max(10, Math.floor(target / 2)));
  const minionCr = challengeRatingForXp(Math.max(10, Math.floor(target / 8)));
  const chaffCr = challengeRatingForXp(Math.max(10, Math.floor(target / 16)));

  const unique = [...new Set([bossCr, midCr, minionCr, chaffCr])];
  return unique.sort((a, b) => xpForChallengeRating(b) - xpForChallengeRating(a));
}

interface ScoredCandidate extends EncounterCandidate {
  xp: number;
}

function resolveCap(
  difficulty: EncounterTargetDifficulty,
  thresholds: EncounterBudgetThresholds,
): number {
  switch (difficulty) {
    case "easy":
      return thresholds.medium;
    case "medium":
      return thresholds.hard;
    case "hard":
      return thresholds.deadly;
    case "deadly":
      return Math.floor(thresholds.deadly * 1.3);
  }
}

function pick<T>(pool: T[], random: () => number): T | null {
  if (pool.length === 0) return null;
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index] ?? null;
}

function adjustedXp(entries: EncounterCompositionEntry[], partyLevel: number, partySize: number) {
  return analyzeEncounterXp({
    partyLevel,
    partySize,
    monsters: entries.map((entry) => ({ cr: entry.monster.cr, count: entry.count })),
  });
}

function addToEntries(
  entries: EncounterCompositionEntry[],
  monster: EncounterCandidate,
): EncounterCompositionEntry[] {
  const existing = entries.find((entry) => entry.monster.slug === monster.slug);
  if (existing) {
    return entries.map((entry) =>
      entry.monster.slug === monster.slug ? { ...entry, count: entry.count + 1 } : entry,
    );
  }
  return [...entries, { monster, count: 1 }];
}

function totalCount(entries: EncounterCompositionEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0);
}

/**
 * Greedy budget-filling composer: picks monsters from the candidate pool so
 * the adjusted XP lands between the target difficulty threshold and the next
 * band (cap). Deterministic when a seeded RNG is injected.
 */
export function suggestEncounterComposition(
  input: EncounterCompositionInput,
): EncounterComposition {
  const random = input.random ?? Math.random;
  const style = input.style ?? "mixed";
  const maxMonsters = Math.max(1, input.maxMonsters ?? 10);

  const thresholds = getEncounterBudgetThresholds(input.partyLevel, input.partySize);
  const target = thresholds[input.difficulty];
  const cap = resolveCap(input.difficulty, thresholds);

  const pool: ScoredCandidate[] = input.candidates
    .map((candidate) => ({ ...candidate, xp: xpForChallengeRating(candidate.cr) }))
    .filter((candidate) => candidate.xp > 0 && candidate.xp <= cap)
    .sort((a, b) => b.xp - a.xp);

  let entries: EncounterCompositionEntry[] = [];

  if (pool.length > 0) {
    const minionPool = pool.filter((candidate) => candidate.xp <= Math.max(10, target / 6));
    const fillPool = minionPool.length > 0 ? minionPool : [pool[pool.length - 1]!];

    if (style === "boss") {
      const bossPool = pool.filter((c) => c.xp >= target * 0.45);
      const boss = pick(bossPool.slice(0, 4), random) ?? pool[0]!;
      entries = [{ monster: boss, count: 1 }];
    } else if (style === "horde") {
      const first = pick(fillPool, random)!;
      entries = [{ monster: first, count: 1 }];
    } else {
      const midPool = pool.filter((c) => c.xp >= target * 0.2 && c.xp <= target * 0.6);
      const lead = pick(midPool.slice(0, 6), random) ?? pick(fillPool, random)!;
      entries = [{ monster: lead, count: 1 }];
    }

    // Fill up towards the target without crossing the cap.
    let guard = 0;
    while (
      adjustedXp(entries, input.partyLevel, input.partySize).adjustedXp < target &&
      totalCount(entries) < maxMonsters &&
      guard < 50
    ) {
      guard += 1;
      const fillCandidate =
        style === "horde"
          ? entries[0]!.monster
          : (pick(fillPool, random) ?? fillPool[0]!);
      const next = addToEntries(entries, fillCandidate);
      if (adjustedXp(next, input.partyLevel, input.partySize).adjustedXp > cap) {
        break;
      }
      entries = next;
    }
  }

  return {
    entries,
    analysis: adjustedXp(entries, input.partyLevel, input.partySize),
    targetXp: target,
    capXp: cap,
    style,
  };
}
