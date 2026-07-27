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

/** Optional mega scale — set UWE_STRESS_SCALE=mega for local profiling */
export const PERF_MEGA_SCALE = {
  pages: 10_000,
  links: 40_000,
  assets: 2_000,
  captures: 1_000,
  sessions: 100,
  handouts: 200,
  workshopProjects: 150,
  personalBrainDocs: 300,
  tagVariants: 120,
} as const;

export type StressScaleName = "smoke" | "stress" | "mega";

export function resolveStressScale(
  env: NodeJS.ProcessEnv = process.env,
): typeof PERF_SMOKE_SCALE | typeof PERF_STRESS_SCALE | typeof PERF_MEGA_SCALE {
  const scale = env.UWE_STRESS_SCALE?.trim().toLowerCase();
  if (scale === "mega" || scale === "10k") {
    return PERF_MEGA_SCALE;
  }
  if (scale === "smoke") {
    return PERF_SMOKE_SCALE;
  }
  return PERF_STRESS_SCALE;
}

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
  /** Asset list for a world */
  listAssets: 800,
} as const;

/**
 * Browser runtime budgets (milliseconds) per key route, enforced in CI by
 * `scripts/perf-budget-check.mjs` against measured Web Vitals from the
 * Playwright perf specs. Keys are `<project>:<path>`; metrics are LCP (Largest
 * Contentful Paint), FCP (First Contentful Paint) and a coarse load/TTI proxy.
 * Adjust with justification in `docs/engineering/performance.md`.
 */
export const RUNTIME_BUDGETS_MS = {
  "studio:/worlds": { lcp: 3000, fcp: 2000, load: 4000 },
  "portal:/worlds": { lcp: 2800, fcp: 1900, load: 3800 },
} as const;

export type RuntimeMetricName = "lcp" | "fcp" | "load";

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
