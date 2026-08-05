/**
 * Client/server boundary regression test.
 *
 * "use client" components must never import runtime values from the
 * server-only barrel `@uwe/database/server`: the barrel transitively pulls
 * Node-only dependencies (sharp, adm-zip, nodemailer/tls, ...) into the
 * client webpack bundle and breaks the Next.js production build with
 * "Module not found: Can't resolve 'fs'".
 *
 * Type-only imports (`import type { ... }`) are erased at compile time and
 * are therefore allowed. Runtime constants (label maps, formatters, enums)
 * must live in a client-safe subpath export instead, e.g.
 * `@uwe/database/import-constants` or `@uwe/database/enums`.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

const SERVER_ONLY_SPECIFIERS = ["@uwe/database/server"];

const SCAN_ROOTS = [
  "apps/studio",
  "apps/portal",
  "apps/brain",
  "apps/family",
  "apps/landing",
  "packages/shared-ui",
];

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  ".turbo",
  ".worktrees",
]);

function collectSourceFiles(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSourceFiles(path.join(dir, entry.name), out);
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      out.push(path.join(dir, entry.name));
    }
  }
}

function isClientComponent(source: string): boolean {
  return /^\s*(["'])use client\1/m.test(source.slice(0, 500));
}

interface Violation {
  file: string;
  statement: string;
}

function findValueImportViolations(
  file: string,
  source: string,
  forbidden: string[] = SERVER_ONLY_SPECIFIERS,
): Violation[] {
  const violations: Violation[] = [];
  // Match full import statements (single- or multi-line) ending in a
  // string-literal module specifier.
  const importRe = /import\s+[\s\S]*?from\s*(["'])([^"']+)\1/g;
  for (const match of source.matchAll(importRe)) {
    const specifier = match[2];
    if (!forbidden.includes(specifier)) continue;
    const statement = match[0];
    if (/^import\s+type\s/.test(statement)) continue;
    // Named imports where every specifier is `type X` are also erased.
    const named = statement.match(/import\s*\{([\s\S]*?)\}\s*from/);
    if (named) {
      const specifiers = named[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (specifiers.every((s) => s.startsWith("type "))) continue;
    }
    violations.push({
      file: path.relative(root, file),
      statement: statement.replace(/\s+/g, " ").slice(0, 200),
    });
  }
  return violations;
}

/**
 * Barrels von Arbeitsbereichs-Paketen, die den server-only Einstieg zur
 * Laufzeit weiterreichen.
 *
 * Der direkte Import war schon verboten, der Umweg über ein Paket-Barrel nicht
 * — und genau der hat `main` am 2026-08-05 vier Läufe lang rot gehalten:
 * `PortalSessionsList.tsx` importierte `@uwe/player-hub`, dessen Index über
 * `player-characters.ts` `@uwe/database/server` mitbringt, das wiederum
 * `@uwe/assets` (adm-zip, sharp) hereinzieht. Ergebnis: „Can't resolve 'fs'".
 *
 * Die Liste wird nicht gepflegt, sondern berechnet: Für jedes `@uwe/…`-Barrel
 * wird der Einstieg aus der `package.json` gelesen und geprüft, ob er — direkt
 * oder über seine eigenen Dateien — zur Laufzeit auf einem verbotenen
 * Einstiegspunkt landet.
 */
function packageEntryFile(packageName: string): string | null {
  const dirName = packageName.replace(/^@uwe\//, "");
  const packageJsonPath = path.join(root, "packages", dirName, "package.json");
  if (!fs.existsSync(packageJsonPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    exports?: Record<string, string>;
  };
  const entry = manifest.exports?.["."];
  if (typeof entry !== "string") return null;
  const entryPath = path.join(root, "packages", dirName, entry);
  return fs.existsSync(entryPath) ? entryPath : null;
}

/** Läuft die Datei — über ihre paketinternen Re-Exporte — auf einem Server-Einstieg auf? */
function reachesServerOnly(file: string, seen = new Set<string>()): boolean {
  if (seen.has(file) || seen.size > 200) return false;
  seen.add(file);

  const source = fs.readFileSync(file, "utf8");
  const importRe = /(?:import|export)\s+[\s\S]*?from\s*(["'])([^"']+)\1/g;
  for (const match of source.matchAll(importRe)) {
    const statement = match[0];
    const specifier = match[2];
    if (/^(?:import|export)\s+type\s/.test(statement)) continue;

    if (SERVER_ONLY_SPECIFIERS.includes(specifier)) return true;

    if (specifier.startsWith(".")) {
      const base = path.resolve(path.dirname(file), specifier);
      const candidate = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find(
        (option) => fs.existsSync(option) && fs.statSync(option).isFile(),
      );
      if (candidate && reachesServerOnly(candidate, seen)) return true;
    }
  }
  return false;
}

function serverHeavyBarrels(): string[] {
  const packagesDir = path.join(root, "packages");
  const heavy: string[] = [];
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = `@uwe/${entry.name}`;
    const entryFile = packageEntryFile(name);
    if (entryFile && reachesServerOnly(entryFile)) heavy.push(name);
  }
  return heavy;
}

describe("client/server boundary — Paket-Barrels, die den Server-Einstieg weiterreichen", () => {
  const files: string[] = [];
  for (const scanRoot of SCAN_ROOTS) {
    const dir = path.join(root, scanRoot);
    if (fs.existsSync(dir)) collectSourceFiles(dir, files);
  }
  const heavy = serverHeavyBarrels();

  it("erkennt überhaupt server-lastige Barrels", () => {
    assert.ok(heavy.length > 0, "Kein einziges Barrel erkannt — die Prüfung greift ins Leere.");
  });

  it("findet keine Client-Komponente, die ein solches Barrel importiert", () => {
    const violations: Violation[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      if (!isClientComponent(source)) continue;
      violations.push(...findValueImportViolations(file, source, heavy));
    }
    assert.deepEqual(
      violations,
      [],
      [
        "Client-Komponenten dürfen kein Paket-Barrel importieren, das @uwe/database/server",
        "weiterreicht — das zieht adm-zip/sharp in das Client-Bündel und bricht `next build`.",
        "Stattdessen einen client-sicheren Subpfad benutzen (siehe @uwe/player-hub/portal-types).",
        ...violations.map((v) => `  ${v.file}: ${v.statement}`),
      ].join("\n"),
    );
  });
});

describe("client/server boundary — no runtime imports from @uwe/database/server in client components", () => {
  const files: string[] = [];
  for (const scanRoot of SCAN_ROOTS) {
    const dir = path.join(root, scanRoot);
    if (fs.existsSync(dir)) collectSourceFiles(dir, files);
  }

  it("scans a plausible number of source files", () => {
    assert.ok(files.length > 100, `Expected >100 files, found ${files.length}`);
  });

  it("finds no client components with runtime server-barrel imports", () => {
    const violations: Violation[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      if (!isClientComponent(source)) continue;
      violations.push(...findValueImportViolations(file, source));
    }
    assert.deepEqual(
      violations,
      [],
      [
        "Client components must not import runtime values from @uwe/database/server.",
        "Move the constants to a client-safe subpath export (see @uwe/database/import-constants)",
        "or use `import type` for type-only usage.",
        ...violations.map((v) => `  ${v.file}: ${v.statement}`),
      ].join("\n"),
    );
  });
});
