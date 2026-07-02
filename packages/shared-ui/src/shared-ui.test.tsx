import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Button,
  Collapsible,
  CollapsibleNavSidebar,
  EmptyState,
  ErrorAlert,
  LoadingSpinner,
  MobileBottomNav,
  PageHeader,
  SidebarContextProvider,
  SidebarNav,
  StickyActionBar,
  ThemePicker,
  ToolWindow,
} from "./index";
import {
  PageTypeBadge,
  PublishBadge,
  QuestStatusBadge,
  RtxStatusBadge,
  VisibilityBadge,
} from "./StatusBadges";
import { SearchResultsList } from "./SearchResults";
import { filterPaletteCommands } from "./CommandPalette";
import { GraphView } from "./GraphView";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uweCss = readFileSync(path.join(__dirname, "uwe.css"), "utf8");
const uweComponentsCss = readFileSync(path.join(__dirname, "uwe-components.css"), "utf8");

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
        <VisibilityBadge visibility="dm_only" />
        <PublishBadge status="published" />
        <PageTypeBadge type="lore" />
      </>,
    );
    assert.match(html, /Portal sichtbar/);
    assert.match(html, /Nur GM/);
    assert.match(html, /uwe-badge-secret/);
    assert.match(html, /aria-label=/);
    assert.match(html, /Veröffentlicht/);
    assert.match(html, /Lore/);
    assert.doesNotMatch(html, /dm_only/);
  });

  it("renders quest status badges and treats missing status as open", () => {
    const html = renderToStaticMarkup(
      <>
        <QuestStatusBadge status="completed" />
        <QuestStatusBadge status="failed" />
        <QuestStatusBadge status={null} />
      </>,
    );
    assert.match(html, /Erledigt/);
    assert.match(html, /Gescheitert/);
    assert.match(html, /Offen/);
    assert.match(html, /uwe-badge-published/);
    assert.match(html, /uwe-badge-danger/);
    assert.match(html, /aria-label="Quest-Status:/);
  });

  it("shows the quest status badge for quest search results", () => {
    const html = renderToStaticMarkup(
      <SearchResultsList
        query="turm"
        results={[
          {
            pageId: "q1",
            title: "Der gefallene Turm",
            slug: "gefallener-turm",
            type: "quest",
            worldSlug: "terra",
            worldName: "Terra",
            campaignName: null,
            visibility: "player_visible",
            questStatus: "completed",
            href: "/worlds/terra/quests/gefallener-turm",
            matchedFields: ["title"],
            snippet: null,
          },
        ]}
      />,
    );
    assert.match(html, /Der gefallene Turm/);
    assert.match(html, /Erledigt/);
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
    assert.match(html, /Portal sichtbar/);
    assert.doesNotMatch(html, /Nur GM/);
    assert.doesNotMatch(html, /dm_only/);
    assert.doesNotMatch(html, /Geheim/);
  });

  it("declares CSS imports before other rules so bundlers include component styles", () => {
    const componentsImport = uweCss.indexOf('@import "./uwe-components.css"');
    const polishImport = uweCss.indexOf('@import "./uwe-visual-polish.css"');
    const rootIndex = uweCss.indexOf(":root {");
    assert.ok(componentsImport >= 0);
    assert.ok(polishImport >= 0);
    assert.ok(componentsImport < rootIndex);
    assert.ok(polishImport < rootIndex);
  });

  it("includes mobile navigation styles in shared CSS", () => {
    assert.match(uweCss, /uwe-mobile-nav-toggle/);
    assert.match(uweCss, /max-width: 960px/);
    assert.match(uweCss, /uwe-btn-secondary/);
    assert.match(uweCss, /uwe-error-alert/);
    assert.match(uweCss, /uwe-bottom-nav/);
    assert.match(uweCss, /uwe-sticky-action-bar/);
    assert.match(uweCss, /uwe-filter-sheet/);
    assert.match(uweCss, /uwe-page-list-cards/);
    assert.match(uweCss, /--uwe-bg/);
    assert.match(uweCss, /uwe-theme-frosted/);
    assert.match(uweCss, /uwe-theme-grid/);
    assert.match(uweCss, /focus-visible/);
    assert.match(uweCss, /prefers-reduced-motion/);
    assert.match(uweCss, /uwe-theme-picker/);
  });

  it("renders accessible theme picker with labeled swatches", () => {
    const html = renderToStaticMarkup(<ThemePicker defaultValue="light" />);
    assert.match(html, /type="radio"/);
    assert.match(html, /name="theme"/);
    assert.match(html, /Dark/);
    assert.match(html, /Light/);
    assert.match(html, /System/);
    assert.match(html, /Dunkles Erscheinungsbild/);
    assert.match(html, /is-selected/);
    assert.match(html, /Aktiv ausgewählt/);
  });

  it("includes command palette, dashboard and inspector styles in shared CSS", () => {
    assert.match(uweCss, /uwe-palette-overlay/);
    assert.match(uweCss, /uwe-template-card/);
    assert.match(uweCss, /uwe-dashboard-grid/);
    assert.match(uweCss, /uwe-inspector-findings/);
  });

  it("renders mobile bottom navigation with active item", () => {
    const html = renderToStaticMarkup(
      <SidebarContextProvider closeSidebar={() => {}}>
        <MobileBottomNav
          items={[
            { label: "Dashboard", href: "/", icon: "⌂", active: true },
            { label: "Mehr", icon: "☰", action: "open-sidebar" },
          ]}
        />
      </SidebarContextProvider>,
    );
    assert.match(html, /uwe-bottom-nav/);
    assert.match(html, /class="active"/);
    assert.match(html, /aria-current="page"/);
  });

  it("renders sticky action bar for mobile forms", () => {
    const html = renderToStaticMarkup(
      <StickyActionBar>
        <button type="submit">Speichern</button>
      </StickyActionBar>,
    );
    assert.match(html, /uwe-sticky-action-bar/);
    assert.match(html, /role="toolbar"/);
  });

  it("renders Button variants with uwe classes", () => {
    const html = renderToStaticMarkup(
      <>
        <Button variant="primary">Speichern</Button>
        <Button variant="danger">Löschen</Button>
      </>,
    );
    assert.match(html, /uwe-btn-primary/);
    assert.match(html, /uwe-btn-danger/);
    assert.match(html, /Speichern/);
  });

  it("renders closed ToolWindow as empty", () => {
    const html = renderToStaticMarkup(
      <ToolWindow open={false} onClose={() => {}} title="Test">
        Inhalt
      </ToolWindow>,
    );
    assert.equal(html, "");
  });

  it("renders collapsible sidebar section with trigger and body", () => {
    const html = renderToStaticMarkup(
      <Collapsible variant="sidebar" title="Dashboard" defaultOpen>
        <p>Nav-Inhalt</p>
      </Collapsible>,
    );
    assert.match(html, /uwe-collapsible-sidebar/);
    assert.match(html, /uwe-sidebar-section-trigger/);
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, /Nav-Inhalt/);
  });

  it("renders collapsible nav sidebar with grouped sections", () => {
    const html = renderToStaticMarkup(
      <CollapsibleNavSidebar
        sections={[
          {
            title: "Dashboard",
            items: [{ label: "Studio", href: "/studio", active: true }],
          },
          {
            title: "Welten",
            items: [{ label: "Welten", href: "/worlds" }],
          },
        ]}
        defaultOpenTitles={["Dashboard"]}
      />,
    );
    assert.match(html, /Dashboard/);
    assert.match(html, /class="active"/);
    assert.match(html, /Welten/);
  });

  it("includes native UI component styles", () => {
    assert.match(uweComponentsCss, /uwe-toolwindow/);
    assert.match(uweComponentsCss, /uwe-icon-rail/);
    assert.match(uweComponentsCss, /--uwe-radius-md/);
    assert.match(uweComponentsCss, /--uwe-spacing-md/);
    assert.match(uweComponentsCss, /--uwe-focus-ring/);
    assert.match(uweComponentsCss, /uwe-sidebar-collapse-toggle/);
    assert.match(uweComponentsCss, /uwe-collapsible-sidebar/);
    assert.match(uweComponentsCss, /data-sidebar-collapsed/);
    assert.match(uweComponentsCss, /uwe-admin-status-grid/);
  });

  it("includes inline action and page action mobile layout rules", () => {
    assert.match(uweCss, /\.uwe-inline-actions/);
    assert.match(uweCss, /\.uwe-page-actions/);
    assert.match(uweCss, /uwe-inline-actions > \.uwe-btn:only-child/);
    assert.match(uweCss, /uwe-page-actions \.uwe-btn:only-child/);
    assert.match(uweCss, /--uwe-spacing-sm/);
    assert.match(uweCss, /--uwe-card-bg/);
  });

  it("renders the RTX status badge with state, label and tooltip", () => {
    const online = renderToStaticMarkup(<RtxStatusBadge state="online" />);
    assert.match(online, /uwe-rtx-badge/);
    assert.match(online, /data-rtx-state="online"/);
    assert.match(online, /uwe-rtx-badge-dot/);
    assert.match(online, /RTX online/);
    assert.match(online, /title="/);

    const offline = renderToStaticMarkup(
      <RtxStatusBadge state="offline" label="RTX offline · 0/1" />,
    );
    assert.match(offline, /data-rtx-state="offline"/);
    assert.match(offline, /RTX offline · 0\/1/);
    assert.match(offline, /aria-label="RTX-Status: RTX offline/);
  });

  it("includes RTX status badge styles in shared CSS", () => {
    assert.match(uweCss, /\.uwe-rtx-badge/);
    assert.match(uweCss, /uwe-rtx-badge\[data-rtx-state="online"\]/);
    assert.match(uweCss, /uwe-rtx-badge-dot/);
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

describe("GraphView accessibility", () => {
  it("renders aria-label on graph node links", () => {
    const html = renderToStaticMarkup(
      <GraphView
        nodes={[
          {
            id: "n1",
            title: "Elara",
            slug: "elara",
            type: "npc",
            category: "npc",
            visibility: "player_visible",
            tags: [],
            href: "/worlds/terra/npcs/elara",
            campaignId: null,
          },
          {
            id: "n2",
            title: "Hafenstadt",
            slug: "hafenstadt",
            type: "location",
            category: "location",
            visibility: "dm_only",
            tags: [],
            href: "/worlds/terra/locations/hafenstadt",
            campaignId: null,
            isFocus: true,
          },
        ]}
        edges={[]}
      />,
    );
    assert.match(html, /aria-label="Elara, NPC"/);
    assert.match(html, /aria-label="Hafenstadt, Ort \(Fokus\)"/);
  });
});
