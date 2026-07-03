/**
 * File size budget check — anti-monolith guard.
 *
 * Policy (see CLAUDE.md § Modul-Disziplin and AGENTS.md § File size budget):
 * - New production files (apps/, packages/, tools/) must stay under
 *   NEW_FILE_MAX_LINES. Split into modules or a feature package instead.
 * - Pre-existing oversized files are frozen in scripts/file-size-baseline.json
 *   and may only grow within a small headroom. Never raise a baseline value
 *   and never add new entries to make a failure pass — fix the file instead.
 * - `node scripts/file-size-budget-check.mjs --ratchet` lowers/removes baseline
 *   entries after files shrink (it never raises values or adds entries, except
 *   for the one-time bootstrap when the baseline file does not exist yet).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const NEW_FILE_MAX_LINES = 700;
/** Baseline files may grow by this factor before failing. */
const DEFAULT_HEADROOM = 1.1;
/**
 * Tighter budgets for known coupling hotspots. The server barrel must shrink
 * over time — new domain services belong in feature packages / subpath
 * exports, not in the barrel.
 */
const HEADROOM_OVERRIDES = {
  "packages/database/src/server.ts": 1.03,
};

const SCAN_DIRS = ["apps", "packages", "tools"];
const BASELINE_PATH = path.join(root, "scripts", "file-size-baseline.json");
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "generated",
  "src-tauri",
]);

function isProductionSource(fileName) {
  if (!/\.(ts|tsx)$/.test(fileName)) return false;
  return !/\.(test|spec)\.(ts|tsx)$|\.d\.ts$/.test(fileName);
}

function collectFiles(dir, results) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) collectFiles(absolute, results);
    } else if (entry.isFile() && isProductionSource(entry.name)) {
      results.push(absolute);
    }
  }
}

function countLines(absolutePath) {
  return fs.readFileSync(absolutePath, "utf8").split("\n").length;
}

export function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return {};
  return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
}

export function allowedLinesFor(relativePath, baseline) {
  const frozen = baseline[relativePath];
  if (frozen === undefined) return NEW_FILE_MAX_LINES;
  const headroom = HEADROOM_OVERRIDES[relativePath] ?? DEFAULT_HEADROOM;
  return Math.max(NEW_FILE_MAX_LINES, Math.ceil(frozen * headroom));
}

export function checkFileSizeBudget() {
  const baseline = readBaseline();
  const files = [];
  for (const dir of SCAN_DIRS) {
    const absolute = path.join(root, dir);
    if (fs.existsSync(absolute)) collectFiles(absolute, files);
  }

  const violations = [];
  const measured = {};
  for (const absolute of files) {
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    const lines = countLines(absolute);
    measured[relative] = lines;
    const allowed = allowedLinesFor(relative, baseline);
    if (lines <= allowed) continue;
    violations.push({
      file: relative,
      lines,
      allowed,
      kind: baseline[relative] === undefined ? "new-file-too-large" : "baseline-exceeded",
    });
  }

  const staleEntries = Object.keys(baseline).filter((entry) => measured[entry] === undefined);
  return { violations, staleEntries, baseline, measured };
}

function formatViolation({ file, lines, allowed, kind }) {
  const hint =
    kind === "new-file-too-large"
      ? "New files must stay under the budget — split into modules or a feature package."
      : "This legacy file is frozen — extract code instead of growing it. Do not raise the baseline.";
  return `  ${file}: ${lines} lines (budget ${allowed}). ${hint}`;
}

export function ratchetBaseline() {
  const { staleEntries, baseline, measured } = checkFileSizeBudget();
  const bootstrap = !fs.existsSync(BASELINE_PATH);
  const next = {};
  for (const [file, lines] of Object.entries(measured)) {
    if (bootstrap) {
      if (lines > NEW_FILE_MAX_LINES) next[file] = lines;
    } else if (baseline[file] !== undefined) {
      // Ratchet down only: keep the smaller of frozen and current size, and
      // drop entries that now fit the regular budget.
      const ratcheted = Math.min(baseline[file], lines);
      if (ratcheted > NEW_FILE_MAX_LINES) next[file] = ratcheted;
    }
  }
  const sorted = Object.fromEntries(
    Object.entries(next).sort(([, a], [, b]) => b - a),
  );
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  return { bootstrap, removedStale: staleEntries, entryCount: Object.keys(sorted).length };
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  if (process.argv.includes("--ratchet")) {
    const { bootstrap, removedStale, entryCount } = ratchetBaseline();
    console.log(
      `file-size-budget: ${bootstrap ? "bootstrapped" : "ratcheted"} baseline (${entryCount} entries` +
        `${removedStale.length > 0 ? `, removed ${removedStale.length} stale` : ""}).`,
    );
  } else {
    const { violations, staleEntries } = checkFileSizeBudget();
    if (staleEntries.length > 0) {
      console.error(
        `file-size-budget: stale baseline entries (file moved/deleted?) — run --ratchet:\n${staleEntries
          .map((entry) => `  ${entry}`)
          .join("\n")}`,
      );
    }
    if (violations.length > 0) {
      console.error(`file-size-budget: ${violations.length} violation(s):\n${violations.map(formatViolation).join("\n")}`);
    }
    if (violations.length > 0 || staleEntries.length > 0) process.exit(1);
    console.log("file-size-budget: OK");
  }
}
