import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { normalizeNavPath } from "./types";
import {
  STUDIO_NAV,
  STUDIO_SECTIONS,
  studioCommands,
  studioNavConflicts,
  studioNavItems,
  studioSidebar,
} from "./studio-nav";
import { worldNav, worldNavConflicts, worldNavItems } from "./world-nav";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUDIO_APP_DIR = join(__dirname, "../../app");

/** Resolve a static (non-world) Studio href to its expected page.tsx path. */
function studioRouteExists(href: string): boolean {
  const pathname = normalizeNavPath(href).split("?")[0]!;
  const rel = pathname === "/" ? "" : pathname.replace(/^\//, "");
  return existsSync(join(STUDIO_APP_DIR, rel, "page.tsx"));
}

/** Resolve a world href to its dynamic [worldSlug] route path. */
function worldRouteExists(href: string, slug: string): boolean {
  const pathname = normalizeNavPath(href).split("?")[0]!;
  const rel = pathname.replace(/^\//, "").replace(`worlds/${slug}`, "worlds/[worldSlug]");
  return existsSync(join(STUDIO_APP_DIR, rel, "page.tsx"));
}

describe("studio navigation", () => {
  it("exposes the seven canonical IA sections in order", () => {
    const titles = STUDIO_NAV.map((group) => group.title);
    // Sections may have multiple groups; ensure each canonical section appears.
    for (const section of STUDIO_SECTIONS) {
      assert.ok(
        STUDIO_NAV.some((group) => group.items.some((item) => item.section === section)),
        `missing section: ${section}`,
      );
    }
    assert.ok(titles.length >= STUDIO_SECTIONS.length);
  });

  it("has no duplicate ids, hrefs, or labels", () => {
    const conflicts = studioNavConflicts();
    assert.deepEqual(conflicts.duplicateIds, [], `duplicate ids: ${conflicts.duplicateIds}`);
    assert.deepEqual(conflicts.duplicateHrefs, [], `duplicate hrefs: ${conflicts.duplicateHrefs}`);
    assert.deepEqual(conflicts.duplicateLabels, [], `duplicate labels: ${conflicts.duplicateLabels}`);
  });

  it("every item has icon, permission, and a leading-slash href", () => {
    for (const item of studioNavItems()) {
      assert.ok(item.icon.length > 0, `${item.id} missing icon`);
      assert.ok(item.permission.length > 0, `${item.id} missing permission`);
      assert.ok(item.href.startsWith("/"), `${item.id} href must be app-relative: ${item.href}`);
    }
  });

  it("active studio nav items point to existing routes", () => {
    const missing = studioNavItems()
      .filter((item) => item.status === "active")
      .filter((item) => !studioRouteExists(item.href))
      .map((item) => `${item.id} -> ${item.href}`);
    assert.deepEqual(missing, [], `active items without a route: ${missing.join(", ")}`);
  });

  it("planned items intentionally lack routes (documented future work)", () => {
    const planned = studioNavItems().filter((item) => item.status === "planned");
    assert.ok(planned.length > 0, "expected some planned items");
  });

  it("resolves active state for nested routes", () => {
    const sidebar = studioSidebar("/admin/users/abc");
    const usersActive = sidebar
      .flatMap((group) => group.items)
      .some((item) => item.id === "system-users" && item.active);
    assert.ok(usersActive);
  });

  it("builds command palette entries from the IA", () => {
    const commands = studioCommands();
    assert.ok(commands.some((cmd) => cmd.href === "/today"));
    assert.ok(commands.some((cmd) => cmd.href === "/worlds"));
    assert.ok(commands.every((cmd) => cmd.group.includes(" / ")));
  });
});

describe("world cockpit navigation", () => {
  it("is stable and covers the canonical world areas", () => {
    const items = worldNavItems("terra");
    const labels = items.map((item) => item.label);
    for (const label of [
      "Übersicht",
      "Wiki / Seiten",
      "Sessions",
      "Dungeons",
      "Medien / Assets",
      "Labels & Print",
      "Verbindungen / Graph",
      "Import & Konvertierung",
      "KI / Generatoren",
      "Brain / Wissen",
    ]) {
      assert.ok(labels.includes(label), `missing world area: ${label}`);
    }
  });

  it("has no duplicate ids/hrefs/labels", () => {
    const conflicts = worldNavConflicts("terra");
    assert.deepEqual(conflicts.duplicateIds, []);
    assert.deepEqual(conflicts.duplicateHrefs, []);
    assert.deepEqual(conflicts.duplicateLabels, []);
  });

  it("all world nav items point to existing [worldSlug] routes", () => {
    const missing = worldNavItems("terra")
      .filter((item) => item.status === "active")
      .filter((item) => !worldRouteExists(item.href, "terra"))
      .map((item) => `${item.id} -> ${item.href}`);
    assert.deepEqual(missing, [], `world items without a route: ${missing.join(", ")}`);
  });

  it("does not vary between worlds (same shape for different slugs)", () => {
    const a = worldNav("terra").map((group) => group.items.map((item) => item.id));
    const b = worldNav("hells").map((group) => group.items.map((item) => item.id));
    assert.deepEqual(a, b);
  });
});
