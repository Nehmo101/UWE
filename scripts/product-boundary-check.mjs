/**
 * Product-boundary import guard (three-product split, Invariant 5).
 *
 * Enforces, statically and with zero dependencies:
 *  - No app imports another app: apps/* (studio, portal, brain, family,
 *    landing, engine-connector-client) must never import each other (via
 *    `@uwe/<app>` or a relative path that escapes into a sibling app).
 *  - No package/tool imports an app: shared engines and tools must not depend on
 *    a specific product app.
 *
 * Shared engines (packages/*) remain the allowed way to share code. This guard
 * only looks at ES import/export/`import()`/`require()` specifiers — a file that
 * merely reads another app's file at runtime is out of scope here.
 *
 * Run: `node scripts/product-boundary-check.mjs`. Exits 1 on any violation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_NAMES = new Set(["studio", "portal", "brain", "family", "landing", "engine-connector-client"]);
const SCAN_DIRS = ["apps", "packages", "tools"];
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

/** The app a repo-relative path belongs to, or null when it is a package/tool. */
function ownerAppOf(fileRel) {
  const m = /^apps\/([^/]+)\//.exec(fileRel);
  return m && APP_NAMES.has(m[1]) ? m[1] : null;
}

function isLibPath(fileRel) {
  return fileRel.startsWith("packages/") || fileRel.startsWith("tools/");
}

/** The app a specifier targets (via @uwe/<app> or a relative escape), or null. */
function targetAppOf(fileRel, specifier) {
  const scoped = /^@uwe\/(studio|portal|brain|family|landing|engine-connector-client)(?:\/|$)/.exec(specifier);
  if (scoped) return scoped[1];
  if (specifier.startsWith(".")) {
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(fileRel), specifier),
    );
    const m = /^apps\/([^/]+)\//.exec(resolved.replace(/^(\.\.\/)+/, ""));
    if (m && APP_NAMES.has(m[1])) return m[1];
    const direct = /^apps\/([^/]+)(?:\/|$)/.exec(resolved);
    if (direct && APP_NAMES.has(direct[1])) return direct[1];
  }
  return null;
}

/**
 * Pure check: returns a violation `{ rule, targetApp }` for one import, or null.
 * Exported for the guard's own regression test.
 */
export function checkImport(fileRel, specifier) {
  const targetApp = targetAppOf(fileRel, specifier);
  if (!targetApp) return null;

  const ownerApp = ownerAppOf(fileRel);
  if (ownerApp) {
    if (targetApp !== ownerApp) {
      return { rule: "cross-app-import", targetApp };
    }
    return null;
  }
  if (isLibPath(fileRel)) {
    return { rule: "package-to-app-import", targetApp };
  }
  return null;
}

const IMPORT_RE =
  /(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function extractImports(source) {
  const specs = [];
  let match;
  while ((match = IMPORT_RE.exec(source)) !== null) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier) continue;
    const line = source.slice(0, match.index).split("\n").length;
    specs.push({ specifier, line });
  }
  return specs;
}

function isSource(fileName) {
  return /\.(ts|tsx|mjs|js|jsx)$/.test(fileName) && !fileName.endsWith(".d.ts");
}

function collectFiles(dir, results) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) collectFiles(absolute, results);
    } else if (entry.isFile() && isSource(entry.name)) {
      results.push(absolute);
    }
  }
}

function main() {
  const files = [];
  for (const dir of SCAN_DIRS) collectFiles(path.join(root, dir), files);

  const violations = [];
  for (const absolute of files) {
    const fileRel = path.relative(root, absolute).split(path.sep).join("/");
    const source = fs.readFileSync(absolute, "utf8");
    for (const { specifier, line } of extractImports(source)) {
      const v = checkImport(fileRel, specifier);
      if (v) violations.push({ fileRel, line, specifier, ...v });
    }
  }

  if (violations.length === 0) {
    console.log("product-boundary: OK (no cross-app or package→app imports)");
    return;
  }

  console.error(`product-boundary: ${violations.length} violation(s):`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.fileRel}:${v.line} imports "${v.specifier}" (app: ${v.targetApp})`);
  }
  console.error(
    "\nApps must not import each other; packages/tools must not import an app. " +
      "Share code through a package (shared engine) instead.",
  );
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
