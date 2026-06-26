import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  TARGET_STUDIO_NAV,
  resolveStudioRailActiveId,
  resolveWorldNavKey,
  studioCommandPaletteCommands,
  studioDashboardNav,
  studioSidebarSections,
  studioUnifiedSidebarSections,
  worldBottomNavKey,
  worldCockpitTabItems,
  worldNavItems,
  worldNavSections,
} from "./studio-navigation";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REQUIRED_WORLD_NAV_LABELS = [
  "Dashboard",
  "Seiten",
  "Neue Seite",
  "Sessions",
  "Spielernotizen",
  "Dungeons",
  "Medien & Assets",
  "Soundboard",
  "Labels & Print",
  "Brain Store",
  "Wissensgraph",
  "Kanon & Leaks",
  "KI-Läufe",
  "Import",
  "DnD API",
  "Backup",
];

const EXPECTED_SIDEBAR_SECTIONS = ["Heute", "Welten", "Erstellen", "Medien & KI", "System"];

describe("studio navigation", () => {
  it("uses five consolidated IA sidebar sections", () => {
    const sections = studioSidebarSections("/today");
    const sectionTitles = sections.map((section) => section.title);
    assert.deepEqual(sectionTitles, EXPECTED_SIDEBAR_SECTIONS);
    assert.deepEqual(
      TARGET_STUDIO_NAV.map((section) => section.id),
      ["today", "worlds", "create", "media-ai", "system"],
    );
  });

  it("keeps Heute lean without hiding quick capture", () => {
    const sections = studioSidebarSections("/today");
    const heute = sections.find((section) => section.title === "Heute");
    assert.ok(heute);
    assert.deepEqual(
      heute.items.map((item) => item.href),
      ["/today", "/capture?quick=1"],
    );
    assert.ok(heute.items[0]?.active);
  });

  it("maps legacy feature routes into reduced hubs", () => {
    const sections = studioSidebarSections("/admin/users");
    const worlds = sections.find((section) => section.title === "Welten");
    const create = sections.find((section) => section.title === "Erstellen");
    const mediaAi = sections.find((section) => section.title === "Medien & KI");
    const system = sections.find((section) => section.title === "System");

    assert.ok(worlds?.items.some((item) => item.href === "/worlds"));
    assert.ok(worlds?.items.some((item) => item.href === "/search"));
    assert.ok(create?.items.some((item) => item.href === "/capture"));
    assert.ok(create?.items.some((item) => item.href === "/templates"));
    assert.ok(mediaAi?.items.some((item) => item.href === "/ai"));
    assert.ok(mediaAi?.items.some((item) => item.href === "/admin/agent-jobs"));
    assert.ok(mediaAi?.items.some((item) => item.href === "/system/rtx-connector"));
    assert.ok(system?.items.some((item) => item.href === "/system"));
    assert.ok(system?.items.some((item) => item.href === "/admin/users"));
    assert.ok(!sections.some((section) => section.title === "Admin"));
  });

  it("unified sidebar stays product IA and not app switching chrome", () => {
    const sections = studioUnifiedSidebarSections("/today", {
      portalUrl: "http://localhost:3001",
    });
    const titles = sections.map((section) => section.title);
    assert.deepEqual(titles, EXPECTED_SIDEBAR_SECTIONS);
    assert.ok(!titles.includes("Portal"));
  });

  it("exposes cockpit tabs without world tool overload", () => {
    const tabs = worldCockpitTabItems("terra", "overview");
    assert.ok(tabs.length <= 5);
    assert.deepEqual(
      tabs.map((tab) => tab.key),
      ["overview", "pages", "sessions", "dungeons", "assets"],
    );
    assert.ok(!tabs.some((tab) => tab.key === "brain"));
    assert.ok(tabs.find((tab) => tab.key === "overview")?.active);
  });

  it("groups world navigation into cockpit sections", () => {
    const sections = worldNavSections("terra", "brain");
    assert.deepEqual(
      sections.map((section) => section.title),
      ["Übersicht", "Inhalte", "Sessions", "Dungeons", "Medien", "Tools"],
    );
    const tools = sections.find((section) => section.title === "Tools");
    assert.ok(tools?.items.some((item) => item.label === "Brain Store" && item.active));
    assert.ok(tools?.items.some((item) => item.label === "Import"));
    assert.equal(sections.flatMap((section) => section.items).length, REQUIRED_WORLD_NAV_LABELS.length);
  });

  it("includes all canonical world nav items", () => {
    const nav = worldNavItems("terra");
    const labels = nav.map((item) => item.label);
    for (const label of REQUIRED_WORLD_NAV_LABELS) {
      assert.ok(labels.includes(label), `missing world nav item: ${label}`);
    }
    assert.equal(nav.length, REQUIRED_WORLD_NAV_LABELS.length);
  });

  it("keeps world tools reachable without flattening them into cockpit tabs", () => {
    const nav = worldNavItems("terra");
    const labels = nav.map((item) => item.label);
    assert.ok(labels.includes("Brain Store"));
    assert.ok(labels.includes("KI-Läufe"));
    assert.ok(labels.includes("Kanon & Leaks"));
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

  it("maps world nav keys to at most five mobile bottom nav tabs", () => {
    assert.equal(worldBottomNavKey("overview"), "overview");
    assert.equal(worldBottomNavKey("pages"), "content");
    assert.equal(worldBottomNavKey("new-page"), "content");
    assert.equal(worldBottomNavKey("sessions"), "sessions");
    assert.equal(worldBottomNavKey("inspector"), "tools");
    assert.equal(worldBottomNavKey("brain"), "tools");
    assert.equal(worldBottomNavKey("dungeons"), "more");
    assert.equal(worldBottomNavKey("assets"), "more");
    assert.equal(worldBottomNavKey("pages", true), "content");
  });

  it("provides compact dashboard nav anchored on five global areas", () => {
    const nav = studioDashboardNav("/today");
    assert.deepEqual(
      nav.map((item) => item.href),
      ["/today", "/worlds", "/capture", "/ai", "/system"],
    );
    assert.ok(nav.some((item) => item.href === "/today" && item.active));
    assert.ok(!nav.some((item) => item.href === "/admin"));
    assert.ok(!nav.some((item) => item.href === "/studio"));
  });

  it("resolves reduced rail active ids for legacy route families", () => {
    assert.equal(resolveStudioRailActiveId("/today"), "today");
    assert.equal(resolveStudioRailActiveId("/worlds/terra/dashboard"), "worlds");
    assert.equal(resolveStudioRailActiveId("/capture"), "create");
    assert.equal(resolveStudioRailActiveId("/admin/agent-jobs"), "media-ai");
    assert.equal(resolveStudioRailActiveId("/admin/users"), "system");
    assert.equal(resolveStudioRailActiveId("/settings"), "system");
  });

  it("builds command palette commands from studio IA", () => {
    const commands = studioCommandPaletteCommands({
      worlds: [{ name: "Terra", slug: "terra" }],
      worldSlug: "terra",
      pathname: "/worlds/terra/dashboard",
    });

    assert.ok(commands.some((cmd) => cmd.href === "/today" && cmd.group === "Heute"));
    assert.ok(commands.some((cmd) => cmd.href === "/worlds/terra/pages/new"));
    assert.ok(commands.some((cmd) => cmd.href === "/worlds/terra/brain" && cmd.group === "Welt: Terra / Tools"));
    assert.ok(commands.some((cmd) => cmd.href === "/admin/reviews" && cmd.group === "Medien & KI"));
    assert.ok(commands.some((cmd) => cmd.href === "/capture" && cmd.group === "Erstellen"));
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
