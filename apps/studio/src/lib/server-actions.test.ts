import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const studioRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const repoRoot = dirname(dirname(studioRoot));
const portalRoot = join(repoRoot, "apps", "portal");
const brainRoot = join(repoRoot, "apps", "brain");
const familyRoot = join(repoRoot, "apps", "family");

/**
 * Canonical Server-Action auth guards. Every mutating Server Action must invoke
 * its app's guard — directly, or transitively through an in-module wrapper.
 * Middleware alone is NOT sufficient for Server Actions, so this file is the
 * static regression net for the guard call (the sibling of the API-route
 * inventory test in packages/security-tests/src/studio-route-inventory.ts).
 */
const STUDIO_ACTION_GUARD = "requireStudioActionAuth";
const PORTAL_ACTION_GUARD = "requirePortalActionAuth";
const BRAIN_ACTION_GUARD = "requireBrainActionAuth";
const FAMILY_ACTION_GUARD = "requireFamilyActionAuth";

/**
 * KI-Varianten der Guards (G-KI). Sie rufen den kanonischen Guard IN SICH auf
 * und zählen deshalb hier als gleichwertig — sonst meldete der Scanner jede
 * KI-Action als ungeschützt, obwohl sie strenger geprüft ist als die anderen.
 */
const AI_ACTION_GUARDS: Record<string, string> = {
  [STUDIO_ACTION_GUARD]: "requireStudioAiActionAuth",
  [BRAIN_ACTION_GUARD]: "requireBrainAiActionAuth",
  [FAMILY_ACTION_GUARD]: "requireFamilyAiActionAuth",
};

/**
 * Importe, deren Aufruf den RTX-Host beschäftigt. Ein Action-Modul, das eines
 * davon nennt, muss den KI-Guard nennen — welche seiner Actions ihn bekommen,
 * entscheidet weiterhin der Autor, aber er muss die Frage stellen.
 *
 * Geprüft wird der DIREKTE Import des Moduls, nicht der ganze Importbaum. Das
 * ist Absicht und wurde gemessen: transitiv erreichen 44 von 65 Studio-Modulen
 * ein KI-Paket, weil ein einziger geteilter Helfer es hereinzieht. Ein Test,
 * der fast alles meldet, wird weggeklickt und schützt dann nichts mehr.
 *
 * Der Preis dafür sind die zweite Liste unten: ein Helfer, der KI auslöst,
 * ohne selbst ein KI-Paket zu sein, muss hier eingetragen werden. Wer einen
 * neuen baut, trägt ihn ein — dieselbe Sorgfalt, die er ohnehin für den Guard
 * braucht.
 */
const AI_IMPORT_PATTERNS: readonly RegExp[] = [
  /@uwe\/(ai-brain|brain-assistant|image-studio|page-ai-review|web-search|theme-studio)/,
  // Studio-eigene Helfer, die hinter der Fassade Inferenz starten.
  /@\/src\/lib\/generator-handlers/,
  /@\/src\/lib\/ai-handlers/,
  /@\/src\/lib\/brain-handlers/,
  /@\/src\/lib\/ai-gateway-handlers/,
  /@\/src\/lib\/label-ai-shorten/,
  /@\/src\/lib\/research-synthesis/,
];

/**
 * Action-Module mit KI-Paket im Importbaum, die BEWUSST keinen KI-Guard
 * tragen. Jeder Eintrag braucht einen Grund — er ist eine Entscheidung, kein
 * Versehen.
 */
const AI_GUARD_EXEMPTIONS = new Map<string, string>([
  [
    "life-admin-actions.ts",
    "Die Embedding-Jobs sind eine Nebenwirkung des Speicherns owner-privater " +
      "Notizen, keine vom Nutzer ausgelöste KI-Funktion. Wer eine Life-Brain-Notiz " +
      "anlegen darf, muss sie auch indizieren lassen dürfen — sonst wäre der " +
      "Datensatz halb geschrieben.",
  ],
]);

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
  const aiGuard = AI_ACTION_GUARDS[canonicalGuard];
  const actionFiles = await collectActionFiles(appDir);
  let scannedActions = 0;
  const unguarded: string[] = [];

  for (const file of actionFiles) {
    const rel = relative(appDir, file).split(sep).join("/");
    const source = await readFile(file, "utf8");
    const fns = collectTopLevelFns(source, file);

    const exemption = altGuards.get(rel);
    const seedGuards = [canonicalGuard, ...(aiGuard ? [aiGuard] : [])];
    if (exemption) seedGuards.push(exemption.guard);
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

    // Sanity floor gegen einen still ins Leere laufenden Scanner — kein Zielwert.
    // Die Zahl sinkt, wenn Bereiche Studio verlassen: mit Abschnitt G sind
    // Küche, Haushalt, Scan-Eingang, Verträge und Dokumente nach Family
    // gewandert. Nur senken, wenn der Rückgang erklärbar ist.
    assert.ok(
      scannedActions >= 150,
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

describe("brain server actions", () => {
  it("marks all action modules as server-only", async () => {
    await assertServerOnly(join(brainRoot, "app"));
  });

  it("guards every exported Server Action with requireBrainActionAuth", async () => {
    const { scannedActions, unguarded } = await scanActionGuards(
      join(brainRoot, "app"),
      BRAIN_ACTION_GUARD,
      new Map(),
    );

    assert.equal(
      unguarded.length,
      0,
      `Brain Server Actions without ${BRAIN_ACTION_GUARD} (directly or via an ` +
        `in-module wrapper):\n  ${unguarded.join("\n  ")}`,
    );

    assert.ok(scannedActions > 0, `expected to scan Brain actions, only scanned ${scannedActions}`);
  });
});

describe("family server actions", () => {
  it("marks all action modules as server-only", async () => {
    await assertServerOnly(join(familyRoot, "app"));
  });

  it("guards every exported Server Action with requireFamilyActionAuth", async () => {
    const { scannedActions, unguarded } = await scanActionGuards(
      join(familyRoot, "app"),
      FAMILY_ACTION_GUARD,
      new Map(),
    );

    assert.equal(
      unguarded.length,
      0,
      `Family Server Actions without ${FAMILY_ACTION_GUARD} (directly or via an ` +
        `in-module wrapper):\n  ${unguarded.join("\n  ")}`,
    );

    assert.ok(scannedActions > 0, `expected to scan Family actions, only scanned ${scannedActions}`);
  });
});

/**
 * G-KI — wer den RTX-Host beschäftigen darf, ist im Command Center einstellbar
 * (`User.aiAccess`). Bei den API-Routen trägt eine zentrale Pfadregel diese
 * Prüfung (`getRequiredAccessForApiPath` → `"ai"`); eine Server Action kennt
 * ihren Pfad zur Laufzeit aber nicht und muss sich selbst melden.
 *
 * Genau das prüft dieser Block — und zwar gegen den unauffälligen Ausfallmodus:
 * eine vergessene KI-Prüfung fällt niemandem auf, weil die Funktion weiter
 * läuft. Sie läuft nur für zu viele Leute. Ein Test, der erst beim Benutzen
 * anschlägt, käme dafür zu spät.
 *
 * Geprüft wird auf MODUL-Ebene, nicht je Action: erreicht ein Action-Modul ein
 * KI-Paket, muss es den KI-Guard nennen. Welche seiner Actions ihn bekommen,
 * bleibt die Entscheidung des Autors — die Frage stellen muss er trotzdem.
 */
describe("RTX-KI guards", () => {
  const APPS: Array<{ label: string; root: string; guard: string }> = [
    { label: "Studio", root: studioRoot, guard: AI_ACTION_GUARDS[STUDIO_ACTION_GUARD]! },
    { label: "Brain", root: brainRoot, guard: AI_ACTION_GUARDS[BRAIN_ACTION_GUARD]! },
    { label: "Family", root: familyRoot, guard: AI_ACTION_GUARDS[FAMILY_ACTION_GUARD]! },
  ];

  /**
   * Nennt dieses Modul einen Import, der den RTX-Host beschäftigt? Direkt —
   * siehe die Begründung an AI_IMPORT_PATTERNS.
   */
  function usesAiImport(source: string): boolean {
    return AI_IMPORT_PATTERNS.some((pattern) => pattern.test(source));
  }

  for (const app of APPS) {
    it(`${app.label}: jedes Action-Modul mit KI-Import nennt ${app.guard}`, async () => {
      const appDir = join(app.root, "app");
      const files = await collectActionFiles(appDir);
      const missing: string[] = [];
      let withAiPath = 0;

      for (const file of files) {
        const rel = relative(appDir, file).split(sep).join("/");
        const source = await readFile(file, "utf8");
        if (!usesAiImport(source)) continue;
        withAiPath++;
        if (AI_GUARD_EXEMPTIONS.has(rel)) continue;

        if (!referencesIdentifier(source, app.guard)) {
          missing.push(rel);
        }
      }

      assert.equal(
        missing.length,
        0,
        `${app.label}-Action-Module, die den RTX-Host beschäftigen, aber ${app.guard} nicht nennen. ` +
          `Entweder den Guard auf die KI-Actions setzen, oder das Modul mit Begründung in ` +
          `AI_GUARD_EXEMPTIONS eintragen:\n  ${missing.join("\n  ")}`,
      );

      assert.ok(
        withAiPath > 0,
        `${app.label}: kein einziges Action-Modul mit KI-Import gefunden — der Scanner läuft ins Leere.`,
      );
    });
  }

  it("kein toter Eintrag in AI_GUARD_EXEMPTIONS", async () => {
    // Ein Modul, das den Guard inzwischen selbst nennt, braucht keine Ausnahme
    // mehr — und eine stehengebliebene Ausnahme verdeckt beim nächsten Umbau
    // eine echte Lücke.
    for (const [rel] of AI_GUARD_EXEMPTIONS) {
      const file = join(studioRoot, "app", rel);
      const source = await readFile(file, "utf8").catch(() => null);
      assert.ok(source !== null, `AI_GUARD_EXEMPTIONS verweist auf ein Modul, das es nicht gibt: ${rel}`);
      assert.ok(
        !referencesIdentifier(source, AI_ACTION_GUARDS[STUDIO_ACTION_GUARD]!),
        `${rel} nennt den KI-Guard inzwischen selbst — Eintrag aus AI_GUARD_EXEMPTIONS entfernen.`,
      );
    }
  });
});
