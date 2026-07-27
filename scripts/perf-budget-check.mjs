/**
 * Runtime (LCP / Web Vitals) budget check — CI gate.
 *
 * Reads a perf-results JSON produced by the Playwright perf specs
 * (`e2e/studio-perf.spec.ts`, `e2e/portal-perf.spec.ts`) and fails when a
 * measured metric exceeds its budget. Mirrors `bundle-budget-check.mjs`.
 *
 * Results file shape:
 *   [{ "route": "studio:/worlds", "lcp": 1234, "fcp": 800, "load": 1900 }, ...]
 *
 * Usage:
 *   node scripts/perf-budget-check.mjs [--results <path>] [--require]
 *   PERF_RESULTS=<path> PERF_REQUIRE=1 node scripts/perf-budget-check.mjs
 *
 * Without a results file the check is a soft no-op (exit 0) unless `--require`
 * / PERF_REQUIRE=1 is set, so the gate can be wired everywhere while only the
 * CI e2e job (which produces the file) actually enforces it.
 *
 * Budgets are kept in sync with `RUNTIME_BUDGETS_MS` in
 * `packages/database/src/perf-budgets.ts`; document changes in
 * `docs/engineering/performance.md`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Milliseconds. Keep in sync with perf-budgets.ts RUNTIME_BUDGETS_MS. */
export const RUNTIME_BUDGETS_MS = {
  "studio:/worlds": { lcp: 3000, fcp: 2000, load: 4000 },
  "portal:/worlds": { lcp: 2800, fcp: 1900, load: 3800 },
};

/**
 * Pure check: validate measured results against budgets.
 * @returns {{ ok: boolean, failures: string[], checked: number }}
 */
export function checkPerfBudgets(results, budgets = RUNTIME_BUDGETS_MS) {
  const failures = [];
  let checked = 0;

  if (!Array.isArray(results)) {
    return { ok: false, failures: ["perf results must be an array"], checked: 0 };
  }

  for (const entry of results) {
    const budget = budgets[entry.route];
    if (!budget) continue; // unbudgeted route — ignore
    for (const metric of Object.keys(budget)) {
      const value = entry[metric];
      if (typeof value !== "number" || Number.isNaN(value)) continue;
      checked++;
      if (value > budget[metric]) {
        failures.push(
          `${entry.route} ${metric}: ${value.toFixed(0)}ms > ${budget[metric]}ms budget`,
        );
      }
    }
  }

  return { ok: failures.length === 0, failures, checked };
}

function parseArgs(argv) {
  const args = { results: process.env.PERF_RESULTS, require: process.env.PERF_REQUIRE === "1" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--results") args.results = argv[++i];
    else if (argv[i] === "--require") args.require = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const resultsPath = path.resolve(root, args.results ?? "perf-results.json");

  if (!fs.existsSync(resultsPath)) {
    const msg = `perf-budget-check: no results at ${path.relative(root, resultsPath)}`;
    if (args.require) {
      console.error(`${msg} (--require set)`);
      process.exit(1);
    }
    console.warn(`${msg} — skipping (run the perf specs to produce it).`);
    process.exit(0);
  }

  let results;
  try {
    results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  } catch (error) {
    console.error(`perf-budget-check: cannot parse ${resultsPath}: ${error.message}`);
    process.exit(1);
  }

  const { ok, failures, checked } = checkPerfBudgets(results);
  if (!ok) {
    console.error(`perf-budget-check: ${failures.length} budget breach(es):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`perf-budget-check: OK (${checked} metric(s) within budget).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
