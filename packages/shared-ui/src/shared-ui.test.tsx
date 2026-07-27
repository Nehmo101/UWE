import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Collapsible,
  EmptyState,
  ErrorAlert,
  LoadingSpinner,
  MobileBottomNav,
  SidebarContextProvider,
  StickyActionBar,
  ThemePicker,
  ToolWindow,
} from "./index";
import {
  PageTypeBadge,
  QuestStatusBadge,
  RtxStatusBadge,
} from "./StatusBadges";
import { SearchResultsList } from "./SearchResults";
import { GraphView } from "./GraphView";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uweCss = readFileSync(path.join(__dirname, "uwe.css"), "utf8");
const uweComponentsCss = readFileSync(path.join(__dirname, "uwe-components.css"), "utf8");

describe("shared-ui components", () => {
  it("renders empty state with title and description", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="Keine Seiten"
        description="Noch nichts hier."
      />,
    );
    assert.match(html, /Keine Seiten/);
    assert.match(html, /text-center/);
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

  it("renders type badges", () => {
    const html = renderToStaticMarkup(<PageTypeBadge type="lore" />);
    assert.match(html, /Lore/);
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
    assert.match(html, /--uwe-accent/);
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

  it("renders search results without leaking internal labels", () => {
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
            href: "/worlds/terra/lore/arbor",
            matchedFields: ["title"],
            snippet: "Der Wald Arbor.",
          },
        ]}
      />,
    );
    assert.match(html, /Arbor/);
    assert.doesNotMatch(html, /Nur GM/);
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
    assert.match(uweCss, /max-width: 960px/);
    assert.match(uweCss, /uwe-bottom-nav/);
    assert.match(uweCss, /uwe-sticky-action-bar/);
    assert.match(uweCss, /uwe-filter-sheet/);
    assert.match(uweCss, /--uwe-bg/);
    assert.match(uweCss, /uwe-theme-frosted/);
    assert.match(uweCss, /focus-visible/);
    assert.match(uweCss, /prefers-reduced-motion/);
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

  it("keeps the frosted-glass theme hook for migrated surfaces in shared CSS", () => {
    assert.match(uweCss, /body\.uwe-theme-frosted \.uwe-glass-surface/);
    assert.match(uweCss, /backdrop-filter/);
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

  it("includes native UI component styles", () => {
    assert.match(uweComponentsCss, /uwe-toolwindow/);
    assert.match(uweComponentsCss, /--uwe-radius-md/);
    assert.match(uweComponentsCss, /--uwe-spacing-md/);
    assert.match(uweComponentsCss, /--uwe-focus-ring/);
    assert.match(uweComponentsCss, /uwe-collapsible-sidebar/);
  });

  it("keeps core spacing and surface tokens in shared CSS", () => {
    assert.match(uweCss, /--uwe-spacing-sm/);
    assert.match(uweCss, /--uwe-card-bg/);
  });

  it("renders the RTX status badge with state, label and tooltip", () => {
    const online = renderToStaticMarkup(<RtxStatusBadge state="online" />);
    assert.match(online, /--uwe-success/);
    assert.match(online, /data-rtx-state="online"/);
    assert.match(online, /bg-\[var\(--uwe-success\)\]/);
    assert.match(online, /RTX online/);
    assert.match(online, /title="/);

    const offline = renderToStaticMarkup(
      <RtxStatusBadge state="offline" label="RTX offline · 0/1" />,
    );
    assert.match(offline, /data-rtx-state="offline"/);
    assert.match(offline, /RTX offline · 0\/1/);
    assert.match(offline, /aria-label="RTX-Status: RTX offline/);
  });

  it("renders distinct visual tones per RTX state", () => {
    const starting = renderToStaticMarkup(<RtxStatusBadge state="starting" />);
    assert.match(starting, /--uwe-warning/);
    assert.match(starting, /data-rtx-state="starting"/);
    const offline = renderToStaticMarkup(<RtxStatusBadge state="offline" />);
    assert.match(offline, /data-rtx-state="offline"/);
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
