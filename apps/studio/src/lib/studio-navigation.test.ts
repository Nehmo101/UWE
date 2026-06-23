import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveWorldNavKey,
  studioDashboardNav,
  studioSidebarSections,
  worldBottomNavKey,
  worldNavItems,
} from "./studio-navigation";

const REQUIRED_WORLD_NAV_LABELS = [
  "Übersicht",
  "Seiten",
  "Sessions",
  "Dungeons",
  "Medien & Assets",
  "Labels",
  "Spielernotizen",
  "Soundboard",
  "Wissensgraph",
  "Brain Store",
  "Kanon & Leaks",
  "KI-Läufe",
  "Import",
  "DnD API",
  "Backup",
  "Neue Seite",
];

describe("studio navigation", () => {
  it("groups admin and system areas in Studio sidebar", () => {
    const sections = studioSidebarSections("/admin/users");
    const sectionTitles = sections.map((section) => section.title);
    assert.ok(sectionTitles.includes("Benutzer & Rollen"));
    assert.ok(sectionTitles.includes("Admin"));
    assert.ok(sectionTitles.includes("System & Diagnose"));
  });

  it("includes all canonical world nav items", () => {
    const nav = worldNavItems("terra");
    const labels = nav.map((item) => item.label);
    for (const label of REQUIRED_WORLD_NAV_LABELS) {
      assert.ok(labels.includes(label), `missing world nav item: ${label}`);
    }
    assert.equal(nav.length, REQUIRED_WORLD_NAV_LABELS.length);
  });

  it("includes brain and ai-runs in world nav", () => {
    const nav = worldNavItems("terra");
    const labels = nav.map((item) => item.label);
    assert.ok(labels.includes("Brain Store"));
    assert.ok(labels.includes("KI-Läufe"));
  });

  it("resolves world nav keys for nested routes", () => {
    assert.equal(resolveWorldNavKey("/worlds/terra/brain/doc-1", "terra"), "brain");
    assert.equal(resolveWorldNavKey("/worlds/terra/ai-runs/run-1", "terra"), "ai-runs");
    assert.equal(resolveWorldNavKey("/worlds/terra/dungeons/crypt/ebenen/l1", "terra"), "dungeons");
    assert.equal(resolveWorldNavKey("/worlds/terra/labels/lbl-1", "terra"), "labels");
    assert.equal(resolveWorldNavKey("/worlds/terra/pages/new", "terra"), "new-page");
    assert.equal(
      resolveWorldNavKey("/worlds/terra/sessions/2025-01-14-session-ftkj", "terra"),
      "pages",
    );
    assert.equal(
      resolveWorldNavKey("/worlds/terra/sessions/clxyz1234567890abcdefghij", "terra"),
      "sessions",
    );
  });

  it("maps world nav keys to mobile bottom nav tabs", () => {
    assert.equal(worldBottomNavKey("overview"), "overview");
    assert.equal(worldBottomNavKey("pages"), "pages");
    assert.equal(worldBottomNavKey("new-page"), "pages");
    assert.equal(worldBottomNavKey("inspector"), "inspector");
    assert.equal(worldBottomNavKey("dungeons"), "more");
    assert.equal(worldBottomNavKey("brain"), "more");
    assert.equal(worldBottomNavKey("pages", true), "search");
  });

  it("provides compact dashboard nav", () => {
    const nav = studioDashboardNav("/studio");
    assert.ok(nav.some((item) => item.href === "/studio" && item.active));
    assert.ok(nav.some((item) => item.href === "/worlds"));
    assert.ok(nav.some((item) => item.href === "/admin"));
  });
});
