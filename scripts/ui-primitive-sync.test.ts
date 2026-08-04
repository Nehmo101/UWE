/**
 * UI primitive sync guard.
 *
 * apps/studio and apps/portal each keep their OWN copy of a set of
 * shadcn-style UI primitives (button, card, dialog, ...). Seventeen of these
 * are byte-identical today and MUST be hand-synced: an a11y fix or bug fix to one
 * app's copy has to be mirrored in the other, or the two apps silently drift.
 * Because nothing enforced that, some copies have already diverged
 * (dropdown-menu, data-table, the index barrel).
 *
 * Rather than move every primitive into @uwe/shared-ui and rewrite hundreds of
 * imports (high build risk), this test freezes the current reality so that
 * divergence becomes a build failure and the duplication stays deliberate:
 *
 *   - SYNCED_PRIMITIVES must stay byte-identical across both apps.
 *   - INTENTIONALLY_DIVERGENT documents copies that are knowingly different
 *     (or exist in only one app), each with a reason.
 *   - Any file that exists in BOTH ui/ dirs but is in neither list fails the
 *     test, so a new shared primitive gets registered on purpose.
 *
 * Fixing drift means editing BOTH copies to match (or moving the file to the
 * INTENTIONALLY_DIVERGENT allowlist deliberately, with a reason). The
 * long-term option is to consolidate these into @uwe/shared-ui; until then,
 * this guard keeps the duplication honest.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const STUDIO_UI = path.join(root, "apps/studio/src/components/ui");
const PORTAL_UI = path.join(root, "apps/portal/src/components/ui");

/**
 * Files that MUST stay byte-identical between apps/studio and apps/portal.
 * Verified byte-identical against the tree on 2026-07-10. Any edit to one copy
 * must be mirrored in the other — that is exactly what this test enforces.
 */
const SYNCED_PRIMITIVES = [
  "badge.tsx",
  "button.tsx",
  "card.tsx",
  "cn.ts",
  "command-palette.tsx",
  "dialog.tsx",
  "form.tsx",
  "icon.tsx",
  "input.tsx",
  "label.tsx",
  "scroll-area.tsx",
  "select.tsx",
  "sheet.tsx",
  "states.tsx",
  "tabs.tsx",
  "toaster.tsx",
  "tooltip.tsx",
] as const;

/**
 * Primitives that are knowingly NOT in sync — either they exist in both apps
 * but differ, or they live in a single app. Each entry carries a reason so the
 * drift is documented instead of silently accepted. To exempt a file, add it
 * here with a one-line justification.
 */
const INTENTIONALLY_DIVERGENT: Record<string, string> = {
  "data-table.tsx":
    "Studio ships a full-featured data grid (sorting/filtering/pagination, ~10KB); the Portal copy is a lean read-only table.",
  "dropdown-menu.tsx":
    "Studio adds admin-only menu affordances that the Portal deliberately does not render.",
  "index.ts":
    "Barrels differ on purpose: Studio re-exports additional admin-only primitives.",
  "icon.test.ts":
    "Studio-only co-located unit test for icon.tsx; not a shipped primitive.",
};

function isPrimitiveFile(name: string): boolean {
  return name.endsWith(".ts") || name.endsWith(".tsx");
}

function listPrimitives(dir: string): Set<string> {
  return new Set(fs.readdirSync(dir).filter(isPrimitiveFile));
}

function readFile(dir: string, name: string): string {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

describe("ui primitive sync guard", () => {
  it("keeps every SYNCED_PRIMITIVE byte-identical across studio and portal", () => {
    const drifted: string[] = [];
    const missing: string[] = [];

    for (const name of SYNCED_PRIMITIVES) {
      const studioPath = path.join(STUDIO_UI, name);
      const portalPath = path.join(PORTAL_UI, name);
      if (!fs.existsSync(studioPath) || !fs.existsSync(portalPath)) {
        missing.push(name);
        continue;
      }
      if (readFile(STUDIO_UI, name) !== readFile(PORTAL_UI, name)) {
        drifted.push(name);
      }
    }

    assert.deepEqual(
      missing,
      [],
      "SYNCED_PRIMITIVES lists files that no longer exist in both apps: " +
        `${missing.join(", ")}. Update the list or restore the missing copy.`,
    );

    assert.deepEqual(
      drifted,
      [],
      "These UI primitives have DRIFTED out of sync between " +
        "apps/studio/src/components/ui and apps/portal/src/components/ui: " +
        `${drifted.join(", ")}. Re-sync both copies to be byte-identical, or, ` +
        "if the divergence is intentional, move the file to " +
        "INTENTIONALLY_DIVERGENT in scripts/ui-primitive-sync.test.ts with a reason.",
    );
  });

  it("registers every primitive that exists in both apps", () => {
    const synced = new Set<string>(SYNCED_PRIMITIVES);
    const studioFiles = listPrimitives(STUDIO_UI);
    const portalFiles = listPrimitives(PORTAL_UI);

    const unregistered: string[] = [];
    for (const name of studioFiles) {
      if (!portalFiles.has(name)) continue; // single-app files handled below
      if (synced.has(name)) continue;
      if (name in INTENTIONALLY_DIVERGENT) continue;
      unregistered.push(name);
    }
    unregistered.sort();

    assert.deepEqual(
      unregistered,
      [],
      "These primitives now exist in BOTH ui/ dirs but are not registered: " +
        `${unregistered.join(", ")}. If they are (or should be) identical, add ` +
        "them to SYNCED_PRIMITIVES and make both copies match; otherwise add " +
        "them to INTENTIONALLY_DIVERGENT with a reason.",
    );
  });

  it("does not list a byte-identical file as intentionally divergent", () => {
    // Keeps the allowlist honest: if a divergent entry has been re-synced to be
    // identical, it should graduate back into SYNCED_PRIMITIVES.
    const shouldBeSynced: string[] = [];
    for (const name of Object.keys(INTENTIONALLY_DIVERGENT)) {
      const studioPath = path.join(STUDIO_UI, name);
      const portalPath = path.join(PORTAL_UI, name);
      if (!fs.existsSync(studioPath) || !fs.existsSync(portalPath)) continue;
      if (readFile(STUDIO_UI, name) === readFile(PORTAL_UI, name)) {
        shouldBeSynced.push(name);
      }
    }
    shouldBeSynced.sort();

    assert.deepEqual(
      shouldBeSynced,
      [],
      "These files are listed as INTENTIONALLY_DIVERGENT but are now " +
        `byte-identical in both apps: ${shouldBeSynced.join(", ")}. Move them ` +
        "into SYNCED_PRIMITIVES so future drift is caught.",
    );
  });
});
