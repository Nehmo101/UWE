import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const studioRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const repoRoot = dirname(dirname(studioRoot));
const portalRoot = join(repoRoot, "apps", "portal");

/**
 * Canonical Server-Action auth guards. Every mutating Server Action must invoke
 * its app's guard — directly, or transitively through an in-module wrapper.
 * Middleware alone is NOT sufficient for Server Actions, so this file is the
 * static regression net for the guard call (the sibling of the API-route
 * inventory test in packages/security-tests/src/studio-route-inventory.ts).
 */
const STUDIO_ACTION_GUARD = "requireStudioActionAuth";
const PORTAL_ACTION_GUARD = "requirePortalActionAuth";

interface AltGuardExemption {
  /** Stronger guard the module's exported actions rely on instead of the canonical one. */
  guard: string;
  reason: string;
}

/**
 * Studio action modules whose exported actions intentionally gate on a stronger
 * RBAC guard (requireOwner / requireAdminAccess) INSTEAD OF the canonical
 * requireStudioActionAuth. This allowlist is currently EMPTY: the two modules
 * that previously qualified (admin/ai-prompt-actions.ts,
 * system/cloudflare/actions.ts) were hardened per the audit M3 nuance — they now
 * call requireStudioActionAuth() (the explicit Origin/CSRF check) in addition to
 * their requireAdminAccess/requireOwner RBAC, so they are enforced through the
 * canonical guard directly and need no exemption.
 *
 * If a future action legitimately must rely solely on an RBAC guard, add it here
 * with a reason. Each entry stays "load-bearing": a separate test fails if an
 * allowlisted module drops its documented guard, or if it has since adopted the
 * canonical guard (making the exemption stale). Keyed by path relative to
 * apps/studio/app.
 */
const STUDIO_ALT_GUARD_ALLOWLIST = new Map<string, AltGuardExemption>([]);

/**
 * Exported async functions that are intentionally public / guardless (e.g. a
 * public read). Keyed "<relPath>::<functionName>". Empty today — every Studio
 * and Portal action currently enforces a guard. Add an entry here ONLY for a
 * deliberately public action, with a comment explaining why it is safe.
 */
const PUBLIC_ACTION_ALLOWLIST = new Set<string>([]);

async function collectActionFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectActionFiles(fullPath)));
      continue;
    }
    if (entry.name.endsWith("-actions.ts") || entry.name === "actions.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

interface TopLevelFn {
  name: string;
  exported: boolean;
  isAsync: boolean;
  /** Source text of the function body (block or concise arrow body). */
  body: string;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);
}

/**
 * Parse a module and return its top-level function-like declarations
 * (`function foo` and `const foo = async () => {}`), with a robust body text so
 * per-function guard checks aren't fooled by return-type braces
 * (`Promise<{ ok: true }>`) or inline object parameter types.
 */
function collectTopLevelFns(source: string, fileName: string): TopLevelFn[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const fns: TopLevelFn[] = [];

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
      fns.push({
        name: stmt.name.text,
        exported: hasModifier(stmt, ts.SyntaxKind.ExportKeyword),
        isAsync: hasModifier(stmt, ts.SyntaxKind.AsyncKeyword),
        body: stmt.body.getText(sourceFile),
      });
      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      const exported = hasModifier(stmt, ts.SyntaxKind.ExportKeyword);
      for (const decl of stmt.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          fns.push({
            name: decl.name.text,
            exported,
            isAsync: hasModifier(decl.initializer, ts.SyntaxKind.AsyncKeyword),
            body: decl.initializer.body.getText(sourceFile),
          });
        }
      }
    }
  }

  return fns;
}

function referencesIdentifier(body: string, identifier: string): boolean {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(body);
}

/**
 * The set of identifiers whose presence in an action body proves the guard is
 * reached: the seed guard(s) plus every in-module helper that transitively
 * references one of them. This makes the check wrapper-aware — e.g.
 * `applyStudioLevelUpAction` reaches the guard only via a local
 * `assertStudioCharacterAccess()` helper.
 */
function buildGuardReferenceSet(fns: TopLevelFn[], seedGuards: readonly string[]): Set<string> {
  const guardSet = new Set<string>(seedGuards);
  let changed = true;
  while (changed) {
    changed = false;
    for (const fn of fns) {
      if (guardSet.has(fn.name)) {
        continue;
      }
      if ([...guardSet].some((guard) => referencesIdentifier(fn.body, guard))) {
        guardSet.add(fn.name);
        changed = true;
      }
    }
  }
  return guardSet;
}

interface GuardScanResult {
  scannedActions: number;
  unguarded: string[];
}

async function scanActionGuards(
  appDir: string,
  canonicalGuard: string,
  altGuards: Map<string, AltGuardExemption>,
): Promise<GuardScanResult> {
  const actionFiles = await collectActionFiles(appDir);
  let scannedActions = 0;
  const unguarded: string[] = [];

  for (const file of actionFiles) {
    const rel = relative(appDir, file).split(sep).join("/");
    const source = await readFile(file, "utf8");
    const fns = collectTopLevelFns(source, file);

    const exemption = altGuards.get(rel);
    const seedGuards = exemption ? [canonicalGuard, exemption.guard] : [canonicalGuard];
    const guardSet = buildGuardReferenceSet(fns, seedGuards);

    for (const fn of fns) {
      if (!fn.exported || !fn.isAsync) {
        continue;
      }
      scannedActions++;
      const key = `${rel}::${fn.name}`;
      if (PUBLIC_ACTION_ALLOWLIST.has(key)) {
        continue;
      }
      const guarded = [...guardSet].some((guard) => referencesIdentifier(fn.body, guard));
      if (!guarded) {
        unguarded.push(key);
      }
    }
  }

  return { scannedActions, unguarded };
}

async function assertServerOnly(appDir: string): Promise<void> {
  const actionFiles = await collectActionFiles(appDir);
  assert.ok(actionFiles.length > 0);

  for (const file of actionFiles) {
    const source = await readFile(file, "utf8");
    const firstLine = source.split(/\r?\n/).find((line) => line.trim().length > 0);
    assert.equal(firstLine, '"use server";', file);
  }
}

describe("studio server actions", () => {
  it("marks all action modules as server-only", async () => {
    await assertServerOnly(join(studioRoot, "app"));
  });

  it("guards every exported Server Action with requireStudioActionAuth (or a documented alternate)", async () => {
    const { scannedActions, unguarded } = await scanActionGuards(
      join(studioRoot, "app"),
      STUDIO_ACTION_GUARD,
      STUDIO_ALT_GUARD_ALLOWLIST,
    );

    assert.equal(
      unguarded.length,
      0,
      `Studio Server Actions without an auth guard — each must call ${STUDIO_ACTION_GUARD} ` +
        `(directly or via an in-module wrapper), or be added to STUDIO_ALT_GUARD_ALLOWLIST / ` +
        `PUBLIC_ACTION_ALLOWLIST with justification:\n  ${unguarded.join("\n  ")}`,
    );

    // Sanity floor: guard against the scanner silently matching nothing.
    assert.ok(
      scannedActions >= 200,
      `expected to scan the full Studio action surface, only scanned ${scannedActions}`,
    );
  });

  it("keeps the alternate-guard allowlist load-bearing (no stale exemptions)", async () => {
    const appDir = join(studioRoot, "app");

    for (const [rel, exemption] of STUDIO_ALT_GUARD_ALLOWLIST) {
      const source = await readFile(join(appDir, rel), "utf8").catch(() => {
        throw new Error(`Allowlisted action module no longer exists: ${rel}`);
      });

      assert.ok(
        referencesIdentifier(source, exemption.guard),
        `Allowlisted module ${rel} no longer references its documented guard ` +
          `${exemption.guard}; re-verify auth and update STUDIO_ALT_GUARD_ALLOWLIST. (${exemption.reason})`,
      );

      // If a module has since adopted the canonical guard, the exemption is
      // dead weight and could mask a future regression — force it to be removed.
      assert.ok(
        !referencesIdentifier(source, STUDIO_ACTION_GUARD),
        `Module ${rel} now references ${STUDIO_ACTION_GUARD}; remove it from ` +
          `STUDIO_ALT_GUARD_ALLOWLIST so the canonical guard is enforced directly.`,
      );
    }
  });
});

describe("portal server actions", () => {
  it("marks all action modules as server-only", async () => {
    await assertServerOnly(join(portalRoot, "app"));
  });

  it("guards every exported Server Action with requirePortalActionAuth", async () => {
    const { scannedActions, unguarded } = await scanActionGuards(
      join(portalRoot, "app"),
      PORTAL_ACTION_GUARD,
      new Map(),
    );

    assert.equal(
      unguarded.length,
      0,
      `Portal Server Actions without ${PORTAL_ACTION_GUARD} (directly or via an ` +
        `in-module wrapper):\n  ${unguarded.join("\n  ")}`,
    );

    assert.ok(
      scannedActions > 0,
      `expected to scan Portal actions, only scanned ${scannedActions}`,
    );
  });
});
