import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  resolveWorldNavKey,
  studioCommandPaletteCommands,
  studioDashboardNav,
  studioSidebarSections,
  worldNavItems,
} from "./studio-navigation";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  it("builds command palette commands from studio IA", () => {
    const commands = studioCommandPaletteCommands({
      worlds: [{ name: "Terra", slug: "terra" }],
      worldSlug: "terra",
      pathname: "/worlds/terra/dashboard",
    });

    assert.ok(commands.some((cmd) => cmd.href === "/today" && cmd.group === "Dashboard"));
    assert.ok(commands.some((cmd) => cmd.href === "/worlds/terra/pages/new"));
    assert.ok(commands.some((cmd) => cmd.href === "/admin/reviews"));
    assert.ok(commands.some((cmd) => cmd.href === "/capture"));
  });

  it("includes world switcher commands for other worlds", () => {
    const commands = studioCommandPaletteCommands({
      worlds: [
        { name: "Terra", slug: "terra" },
        { name: "Hells", slug: "hells" },
      ],
      worldSlug: "terra",
    });

    assert.ok(
      commands.some(
        (cmd) => cmd.href === "/worlds/hells/dashboard" && cmd.label.includes("Hells"),
      ),
    );
  });

  it("keeps createPageAction in a use server module", () => {
    const actionsPath = join(__dirname, "../../app/actions.ts");
    const source = readFileSync(actionsPath, "utf8");
    assert.match(source, /^"use server";/m);
    assert.match(source, /export async function createPageAction/);
  });
});
