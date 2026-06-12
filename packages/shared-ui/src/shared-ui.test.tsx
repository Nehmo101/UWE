import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EmptyState,
  ErrorAlert,
  LoadingSpinner,
  PageHeader,
  SidebarNav,
} from "./index";
import {
  PageTypeBadge,
  PublishBadge,
  VisibilityBadge,
} from "./StatusBadges";
import { SearchResultsList } from "./SearchResults";
import { filterPaletteCommands } from "./CommandPalette";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uweCss = readFileSync(path.join(__dirname, "uwe.css"), "utf8");

describe("shared-ui components", () => {
  it("renders page header with title and summary", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Test Welt" summary="Eine Demo-Welt" />,
    );
    assert.match(html, /Test Welt/);
    assert.match(html, /Eine Demo-Welt/);
    assert.match(html, /uwe-page-header/);
  });

  it("renders sidebar navigation with active state", () => {
    const html = renderToStaticMarkup(
      <SidebarNav
        items={[
          { label: "Dashboard", href: "/", active: true },
          { label: "Welten", href: "/worlds" },
        ]}
      />,
    );
    assert.match(html, /class="active"/);
    assert.match(html, /Dashboard/);
  });

  it("renders empty state with title and description", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="Keine Seiten"
        description="Noch nichts hier."
      />,
    );
    assert.match(html, /Keine Seiten/);
    assert.match(html, /uwe-empty-state/);
  });

  it("renders loading spinner with accessible label", () => {
    const html = renderToStaticMarkup(<LoadingSpinner label="Laden…" />);
    assert.match(html, /role="status"/);
    assert.match(html, /Laden…/);
  });

  it("renders error alert with message", () => {
    const html = renderToStaticMarkup(
      <ErrorAlert title="Fehler" message="Etwas ging schief." />,
    );
    assert.match(html, /role="alert"/);
    assert.match(html, /Etwas ging schief/);
  });

  it("renders visibility, publish and type badges", () => {
    const html = renderToStaticMarkup(
      <>
        <VisibilityBadge visibility="player_visible" />
        <PublishBadge status="published" />
        <PageTypeBadge type="lore" />
      </>,
    );
    assert.match(html, /Spieler/);
    assert.match(html, /Veröffentlicht/);
    assert.match(html, /Lore/);
    assert.doesNotMatch(html, /dm_only/);
    assert.doesNotMatch(html, /Nur GM/);
  });

  it("does not expose dm_only labels in player-visible search results", () => {
    const html = renderToStaticMarkup(
      <SearchResultsList
        query="arbor"
        results={[
          {
            pageId: "p1",
            title: "Arbor",
            slug: "arbor",
            type: "region",
            worldSlug: "terra",
            worldName: "Terra",
            campaignName: null,
            visibility: "player_visible",
            href: "/worlds/terra/lore/arbor",
            matchedFields: ["title"],
            snippet: "Der Wald Arbor.",
          },
        ]}
        showVisibility
      />,
    );
    assert.match(html, /Arbor/);
    assert.match(html, /Spieler/);
    assert.doesNotMatch(html, /Nur GM/);
    assert.doesNotMatch(html, /dm_only/);
    assert.doesNotMatch(html, /Geheim/);
  });

  it("includes mobile navigation styles in shared CSS", () => {
    assert.match(uweCss, /uwe-mobile-nav-toggle/);
    assert.match(uweCss, /max-width: 960px/);
    assert.match(uweCss, /uwe-btn-secondary/);
    assert.match(uweCss, /uwe-error-alert/);
  });

  it("includes command palette, dashboard and inspector styles in shared CSS", () => {
    assert.match(uweCss, /uwe-palette-overlay/);
    assert.match(uweCss, /uwe-template-card/);
    assert.match(uweCss, /uwe-dashboard-grid/);
    assert.match(uweCss, /uwe-inspector-findings/);
  });
});

describe("command palette filtering", () => {
  const commands = [
    { id: "a", label: "NPC erstellen", group: "Welt: Terra", keywords: ["create", "charakter"] },
    { id: "b", label: "Backup öffnen", group: "Studio", keywords: ["sicherung"] },
    { id: "c", label: "Inspektor öffnen", group: "Welt: Terra", keywords: ["sicherheit", "leak"] },
  ];

  it("returns all commands for an empty query", () => {
    assert.equal(filterPaletteCommands(commands, "").length, 3);
    assert.equal(filterPaletteCommands(commands, "   ").length, 3);
  });

  it("matches against label, group and keywords case-insensitively", () => {
    assert.deepEqual(
      filterPaletteCommands(commands, "npc").map((c) => c.id),
      ["a"],
    );
    assert.deepEqual(
      filterPaletteCommands(commands, "SICHERUNG").map((c) => c.id),
      ["b"],
    );
    assert.deepEqual(
      filterPaletteCommands(commands, "leak").map((c) => c.id),
      ["c"],
    );
  });

  it("requires all tokens to match", () => {
    assert.deepEqual(
      filterPaletteCommands(commands, "terra erstellen").map((c) => c.id),
      ["a"],
    );
    assert.equal(filterPaletteCommands(commands, "terra backup").length, 0);
  });
});
