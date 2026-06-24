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
  studioUnifiedSidebarSections,
  worldBottomNavKey,
  worldCockpitTabItems,
  worldNavItems,
} from "./studio-navigation";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const EXPECTED_SIDEBAR_SECTIONS = [
  "Heute",
  "Welten",
  "Leben",
  "Werkstatt",
  "Wissen",
  "Medien",
  "KI",
  "System",
  "Admin",
];

describe("studio navigation", () => {
  it("uses consolidated IA sidebar sections", () => {
    const sections = studioSidebarSections("/today");
    const sectionTitles = sections.map((section) => section.title);
    assert.deepEqual(sectionTitles, EXPECTED_SIDEBAR_SECTIONS);
  });

  it("places Heute as the sole primary home link", () => {
    const sections = studioSidebarSections("/today");
    const heute = sections.find((section) => section.title === "Heute");
    assert.ok(heute);
    assert.deepEqual(
      heute.items.map((item) => item.href),
      ["/today"],
    );
    assert.ok(heute.items[0]?.active);
  });

  it("groups Welten, Leben, KI, System, and Admin items", () => {
    const sections = studioSidebarSections("/admin/users");
    const worlds = sections.find((section) => section.title === "Welten");
    const leben = sections.find((section) => section.title === "Leben");
    const ki = sections.find((section) => section.title === "KI");
    const system = sections.find((section) => section.title === "System");
    const admin = sections.find((section) => section.title === "Admin");

    assert.ok(worlds?.items.some((item) => item.href === "/worlds"));
    assert.ok(worlds?.items.some((item) => item.href === "/search"));
    assert.ok(leben?.items.some((item) => item.href === "/capture"));
    assert.ok(leben?.items.some((item) => item.href === "/hardware"));
    assert.ok(ki?.items.some((item) => item.href === "/ai"));
    assert.ok(!ki?.items.some((item) => item.href === "/admin/ai-prompt"));
    assert.ok(system?.items.some((item) => item.href === "/system"));
    assert.ok(admin?.items.some((item) => item.href === "/admin/users"));
  });

  it("unified sidebar follows consolidated IA hierarchy", () => {
    const sections = studioUnifiedSidebarSections("/today", {
      portalUrl: "http://localhost:3001",
    });
    const titles = sections.map((section) => section.title);
    assert.deepEqual(titles, ["Portal", ...EXPECTED_SIDEBAR_SECTIONS]);
    const portal = sections.find((section) => section.title === "Portal");
    assert.ok(portal?.items.some((item) => item.label === "Spieler-Portal"));
    assert.ok(portal?.items.some((item) => item.href === "http://localhost:3001/worlds"));
  });

  it("exposes horizontal cockpit tabs for world overview", () => {
    const tabs = worldCockpitTabItems("terra", "overview");
    assert.ok(tabs.length >= 6);
    assert.equal(tabs[0]?.key, "overview");
    assert.ok(tabs.some((tab) => tab.key === "brain"));
    assert.ok(tabs.find((tab) => tab.key === "overview")?.active);
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

  it("provides compact dashboard nav anchored on Heute and System", () => {
    const nav = studioDashboardNav("/today");
    assert.ok(nav.some((item) => item.href === "/today" && item.active));
    assert.ok(nav.some((item) => item.href === "/worlds"));
    assert.ok(nav.some((item) => item.href === "/system"));
    assert.ok(nav.some((item) => item.href === "/admin"));
    assert.ok(!nav.some((item) => item.href === "/studio"));
  });

  it("builds command palette commands from studio IA", () => {
    const commands = studioCommandPaletteCommands({
      worlds: [{ name: "Terra", slug: "terra" }],
      worldSlug: "terra",
      pathname: "/worlds/terra/dashboard",
    });

    assert.ok(commands.some((cmd) => cmd.href === "/today" && cmd.group === "Heute"));
    assert.ok(commands.some((cmd) => cmd.href === "/worlds/terra/pages/new"));
    assert.ok(commands.some((cmd) => cmd.href === "/admin/reviews"));
    assert.ok(commands.some((cmd) => cmd.href === "/capture"));
    assert.ok(commands.some((cmd) => cmd.href === "/system" && cmd.group === "System"));
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

  it("marks worlds path active in studio sidebar sections for world shell", () => {
    const sections = studioSidebarSections("/worlds/terra/dashboard");
    const worldsSection = sections.find((section) => section.title === "Welten");
    assert.ok(worldsSection);
    assert.ok(worldsSection.items.some((item) => item.href === "/worlds" && item.active));
  });

  it("marks system hub active for legacy admin status route", () => {
    const sections = studioSidebarSections("/admin/status");
    const system = sections.find((section) => section.title === "System");
    assert.ok(system?.items.some((item) => item.href === "/system" && item.active));
  });
});
