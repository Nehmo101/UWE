/**
 * Performance budgets for CI smoke tests and local profiling.
 * Values are wall-clock milliseconds on a typical dev/CI machine with SQLite.
 * Adjust when hardware or schema changes materially.
 */

/** Small stress world used in perf-smoke.test.ts */
export const PERF_SMOKE_SCALE = {
  pages: 60,
  links: 120,
  assets: 25,
  captures: 40,
  sessions: 8,
  handouts: 12,
  workshopProjects: 10,
  personalBrainDocs: 15,
  tagVariants: 30,
} as const;

/** Full manual stress seed (scripts/seed-stress-world.ts) */
export const PERF_STRESS_SCALE = {
  pages: 500,
  links: 2000,
  assets: 200,
  captures: 150,
  sessions: 25,
  handouts: 40,
  workshopProjects: 30,
  personalBrainDocs: 50,
  tagVariants: 80,
} as const;

export const PERF_BUDGETS_MS = {
  /** Global search over smoke world */
  searchQuery: 800,
  /** Building the in-memory search index */
  searchIndexBuild: 1200,
  /** Today dashboard aggregation (life-admin getTodaySummary) */
  todaySummary: 1500,
  /** Tag inventory scan across entities */
  tagInventory: 1000,
  /** Personal brain text search */
  personalBrainSearch: 500,
  /** Bulk page list for a world */
  listPages: 600,
} as const;

export function assertWithinBudget(
  label: string,
  elapsedMs: number,
  budgetMs: number,
): void {
  if (elapsedMs > budgetMs) {
    throw new Error(
      `Performance budget exceeded for ${label}: ${elapsedMs.toFixed(1)}ms > ${budgetMs}ms`,
    );
  }
}
