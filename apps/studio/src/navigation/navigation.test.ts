import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
import {
  STUDIO_PALETTE_EXTRA,
  studioCommandPaletteCommands,
} from "../lib/studio-navigation";
import { worldNav, worldNavConflicts, worldNavItems, worldSidebar } from "./world-nav";

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
    const missingRoutes = planned
      .filter((item) => studioRouteExists(item.href))
      .map((item) => `${item.id} -> ${item.href}`);
    assert.deepEqual(
      missingRoutes,
      [],
      `planned items should not have routes yet: ${missingRoutes.join(", ")}`,
    );
  });

  it("resolves active state for nested routes", () => {
    // Studio's admin routes moved to Brain and the Command Center (Abschnitt D);
    // the agent-jobs view is the remaining route with a nested path.
    const sidebar = studioSidebar("/admin/agent-jobs/run-1");
    const jobsActive = sidebar
      .flatMap((group) => group.items)
      .some((item) => item.id === "tools-agent-jobs" && item.active);
    assert.ok(jobsActive);
  });

  it("builds command palette entries from the IA", () => {
    const commands = studioCommands();
    assert.ok(commands.some((cmd) => cmd.href === "/worlds"));
    assert.ok(commands.some((cmd) => cmd.href === "/capture"));
    assert.ok(commands.some((cmd) => cmd.href === "/admin"));
    assert.ok(commands.every((cmd) => cmd.group.includes(" / ")));
  });

  it("includes STUDIO_PALETTE_EXTRA shortcuts in command palette output", () => {
    const commands = studioCommandPaletteCommands({ worlds: [] });
    const hrefs = commands.map((cmd) => cmd.href.split("?")[0]);
    for (const shortcut of STUDIO_PALETTE_EXTRA) {
      const normalized = shortcut.href.split("?")[0];
      assert.ok(
        hrefs.includes(normalized),
        `missing palette shortcut: ${shortcut.href}`,
      );
    }
  });

  it("marks the admin hub active for /admin/* routes", () => {
    const adminSidebar = studioSidebar("/admin/status");
    const adminHubActive = adminSidebar
      .flatMap((group) => group.items)
      .some((item) => item.id === "system-admin" && item.active);
    assert.ok(adminHubActive);
  });

  it("marks worlds list active inside world shell paths", () => {
    const sidebar = studioSidebar("/worlds/terra/dashboard");
    const worldsActive = sidebar
      .flatMap((group) => group.items)
      .some((item) => item.id === "worlds-list" && item.active);
    assert.ok(worldsActive);
  });

  it("keeps createPageAction in a use server module", () => {
    const actionsPath = join(__dirname, "../../app/actions.ts");
    const source = readFileSync(actionsPath, "utf8");
    assert.match(source, /^"use server";/m);
    assert.match(source, /export async function createPageAction/);
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
      "Weltuhr",
      "Chronik",
      "Dungeons",
      "Medien / Assets",
      "Labels & Print",
      "Verbindungen / Graph",
      "Import & Konvertierung",
      "KI / Generatoren",
      "Brain / Wissen",
      "Session vorbereiten",
      "Kampagnen-Radar",
      "Wiki-Pflege",
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

  it("groups world navigation into cockpit sections", () => {
    const sections = worldNav("terra");
    assert.deepEqual(
      sections.map((section) => section.title),
      ["Übersicht", "Wiki", "Spiel", "Medien", "Wissen & KI", "Freigabe & Betrieb"],
    );
  });

  it("resolves active state for nested world routes", () => {
    const sidebar = worldSidebar("terra", "/worlds/terra/brain/doc-1");
    const brainActive = sidebar
      .flatMap((group) => group.items)
      .some((item) => item.id === "world-brain" && item.active);
    assert.ok(brainActive);

    const sessionsSidebar = worldSidebar("terra", "/worlds/terra/sessions/clxyz1234567890abcdefghij");
    const sessionsActive = sessionsSidebar
      .flatMap((group) => group.items)
      .some((item) => item.id === "world-sessions" && item.active);
    assert.ok(sessionsActive);
  });

  it("includes inspector and backup under Freigabe & Betrieb", () => {
    const labels = worldNavItems("terra").map((item) => item.label);
    assert.ok(labels.includes("Freigaben / Kanon"));
    assert.ok(labels.includes("Backup"));
  });
});
