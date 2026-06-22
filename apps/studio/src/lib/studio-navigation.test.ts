import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveWorldNavKey,
  studioDashboardNav,
  studioSidebarSections,
  worldNavItems,
} from "./studio-navigation";

describe("studio navigation", () => {
  it("groups admin and system areas in Studio sidebar", () => {
    const sections = studioSidebarSections("/admin/users");
    const sectionTitles = sections.map((section) => section.title);
    assert.ok(sectionTitles.includes("Benutzer & Rollen"));
    assert.ok(sectionTitles.includes("Admin"));
    assert.ok(sectionTitles.includes("System & Diagnose"));
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
    assert.equal(
      resolveWorldNavKey("/worlds/terra/sessions/2025-01-14-session-ftkj", "terra"),
      "pages",
    );
    assert.equal(
      resolveWorldNavKey("/worlds/terra/sessions/clxyz1234567890abcdefghij", "terra"),
      "sessions",
    );
  });

  it("provides compact dashboard nav", () => {
    const nav = studioDashboardNav("/studio");
    assert.ok(nav.some((item) => item.href === "/studio" && item.active));
    assert.ok(nav.some((item) => item.href === "/worlds"));
    assert.ok(nav.some((item) => item.href === "/admin"));
  });
});
