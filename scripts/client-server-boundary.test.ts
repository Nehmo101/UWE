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
 * `@uwe/database/import-job-constants` or `@uwe/database/enums`.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

const SERVER_ONLY_SPECIFIERS = ["@uwe/database/server"];

const SCAN_ROOTS = ["apps/studio", "apps/portal", "packages/shared-ui"];

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

function findValueImportViolations(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  // Match full import statements (single- or multi-line) ending in a
  // string-literal module specifier.
  const importRe = /import\s+[\s\S]*?from\s*(["'])([^"']+)\1/g;
  for (const match of source.matchAll(importRe)) {
    const specifier = match[2];
    if (!SERVER_ONLY_SPECIFIERS.includes(specifier)) continue;
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
        "Move the constants to a client-safe subpath export (see @uwe/database/import-job-constants)",
        "or use `import type` for type-only usage.",
        ...violations.map((v) => `  ${v.file}: ${v.statement}`),
      ].join("\n"),
    );
  });
});
