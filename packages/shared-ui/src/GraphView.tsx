"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Lock, LockOpen, Maximize, Maximize2, Minimize2, Minus, Plus, X } from "lucide-react";
import type { GraphEdge, GraphNode, GraphNodeCategory } from "@uwe/database/graph-types";
import { GRAPH_NODE_CATEGORY_LABELS } from "@uwe/database/graph-types";
import { GraphEngine, isGraphPositionCacheValid } from "./graph-engine";
import { GraphViewControls, type GraphViewStats } from "./GraphViewControls";
import { DOT_BASE, catCssColor } from "./graph-view-chrome";
import { resolveNeighborhoodFocus, stepNeighborhoodDepth } from "./graph-view-ego";
import { PageTypeBadge } from "./StatusBadges";

export interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Kompaktes Ego-Netz-Widget (kleinere Radien, nur Legende + Mini-Zoom). */
  compact?: boolean;
  /** Explizite Höhe in px (überschreibt die CSS-Defaults). */
  height?: number;
  /** Weltname für den Titelblock des Vollbild-Explorers. */
  worldName?: string;
  /** Anfangs-Fokus/Auswahl (z. B. die aktuelle Seite im Widget). */
  focusPageId?: string;
  /** Minimap im Vollbild anzeigen (Standard: an). */
  showMinimap?: boolean;
}

/** Grenzen der Ego-Tiefe im Nachbarschafts-Modus (Chrome: Fokus-Radius um einen Knoten). */
const MIN_EGO_DEPTH = 1;
const MAX_EGO_DEPTH = 4;
const DEFAULT_EGO_DEPTH = 2;
/** Halbe Breite des Detail-Panels (`w-[312px]`) — verschiebt das Kamera-Zentrum beim
 *  sanften Heranschwenken, damit der fokussierte Knoten nicht dahinter verschwindet. */
const DETAIL_PANEL_OFFSET_X = 156;

/** Anzeigereihenfolge der Kategorie-Chips/Legende (Session zuerst, wie im Handoff). */
const CATEGORY_ORDER: GraphNodeCategory[] = [
  "session",
  "npc",
  "location",
  "faction",
  "quest",
  "dungeon",
  "item",
  "lore",
  "handout",
];

function graphNodeAccessibleName(node: GraphNode): string {
  const category = GRAPH_NODE_CATEGORY_LABELS[node.category];
  return node.isFocus ? `${node.title}, ${category} (Fokus)` : `${node.title}, ${category}`;
}

// --- Tailwind-Klassenbausteine für die Graph-Chrome -------------------------
// (Kategorie-Punkt/Chip-Bausteine leben in `graph-view-chrome.ts`, geteilt mit
// `GraphViewControls.tsx`. Der Zoom-/Fit-/Lock-/Vollbild-Icon-Rail bleibt hier,
// da er nur von dieser Datei gerendert wird.)
const ICON_BTN_BASE =
  "flex items-center justify-center text-foreground transition-colors motion-reduce:transition-none hover:bg-[color-mix(in_srgb,var(--uwe-accent)_12%,transparent)] hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary active:translate-y-px";

function iconBtnClass(compact: boolean, active = false): string {
  const size = compact ? "h-[34px] w-[34px]" : "h-11 w-11";
  const activeClass = active
    ? " bg-[color-mix(in_srgb,var(--uwe-accent)_12%,transparent)] text-primary"
    : "";
  return `${ICON_BTN_BASE} ${size}${activeClass}`;
}

interface PanelConnection {
  key: string;
  id: string;
  dir: string;
  label: string;
  title: string;
  color: string;
  catLabel: string;
}

export function GraphView({
  nodes,
  edges,
  compact = false,
  height,
  worldName,
  focusPageId,
  showMinimap = true,
}: GraphViewProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const miniElRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GraphEngine | null>(null);
  const posCacheRef = useRef<Record<string, { x: number; y: number }>>({});

  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hidden, setHidden] = useState<Set<GraphNodeCategory>>(new Set());
  const [hideOrphans, setHideOrphans] = useState(false);
  const [orphanCount, setOrphanCount] = useState(0);
  const [query, setQuery] = useState("");
  const [locked, setLocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Ego-Netz-Modus ("Nachbarschaft"): Anker ist die aktuelle Auswahl (oder der
  // initiale Fokus), Tiefe steuert den Radius. `localMode` ist die Nutzer-Absicht;
  // `effectiveFocusId` bleibt null, solange kein gültiger Anker existiert (z. B.
  // nach Schließen des Panels), sodass der Graph dann automatisch zur Gesamtansicht
  // zurückkehrt, ohne die Umschaltung selbst zurückzusetzen.
  const [localMode, setLocalMode] = useState(false);
  const [localDepth, setLocalDepth] = useState(DEFAULT_EGO_DEPTH);
  // Live-Zähler fürs Filter-Panel: Knoten/Kanten der aktuellen Ansicht (ganzer
  // Graph oder Nachbarschaft) vor/nach den Kategorie-Chips, plus Knoten je
  // Kategorie für die Zähl-Badges auf den Chips. Beides kommt aus der Engine
  // (die kennt die tatsächliche, ggf. auf ein Ego-Netz reduzierte Ansicht),
  // nicht aus den vollen `nodes`/`edges`-Props.
  const [viewStats, setViewStats] = useState<GraphViewStats | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Partial<Record<GraphNodeCategory, number>>>({});

  // Spiegel des Chrome-States, damit ein Rebuild (neue Daten) den aktuellen Filter
  // übernimmt, ohne die Engine bei jedem Tastendruck neu zu erzeugen.
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const hideOrphansRef = useRef(hideOrphans);
  hideOrphansRef.current = hideOrphans;
  const queryRef = useRef(query);
  queryRef.current = query;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const canvasCb = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el;
  }, []);
  const miniCb = useCallback((el: HTMLCanvasElement | null) => {
    miniElRef.current = el;
  }, []);

  const hasNodes = nodes.length > 0;
  const withMinimap = !compact && showMinimap;

  // Ego-Netz-Anker: Auswahl → Fokus — null wenn kompakt/aus/Anker fehlt
  // (Engine baut dann den ganzen Graphen). Logik in graph-view-ego.ts.
  const { canGoLocal, effectiveFocusId } = resolveNeighborhoodFocus({
    compact: Boolean(compact),
    localMode,
    selectedId: selected?.id,
    focusPageId,
    nodeIds: nodes.map((node) => node.id),
  });

  // Zähler aus der Engine übernehmen (aktuelle Ansicht, nicht die vollen Props) —
  // nach jedem Engine-Rebuild und nach jeder Kategorie-Umschaltung aufrufen.
  const refreshCounts = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) {
      setViewStats(null);
      setCategoryCounts({});
      return;
    }
    setViewStats({
      totalNodes: engine.nodeCount,
      totalEdges: engine.edgeCount,
      visibleNodes: engine.visibleNodeCount(),
      visibleEdges: engine.visibleEdgeCount(),
    });
    setCategoryCounts(engine.categoryCounts());
    setOrphanCount(engine.orphanCount());
  }, []);

  // Engine-Lebenszyklus: instanziieren beim Mount, neu aufbauen bei Datenwechsel
  // (inkl. Nachbarschafts-Anker/-Tiefe — das baut das Ego-Netz neu auf).
  useEffect(() => {
    const canvas = canvasElRef.current;
    if (!canvas || nodes.length === 0) return;

    const initialSelectId = effectiveFocusId ?? focusPageId ?? null;
    const engine = new GraphEngine(canvas, {
      nodes,
      edges,
      focusId: effectiveFocusId,
      egoDepth: effectiveFocusId ? localDepth : undefined,
      selectId: initialSelectId,
      compact,
      dotGrid: true,
      mini: withMinimap ? miniElRef.current : null,
      onSelect: (node) => {
        // Kompakt-Widget: Klick springt direkt zur Wiki-Seite statt ein
        // Detail-Panel zu öffnen (das im Kompakt-Modus gar nicht gerendert wird).
        if (compact) {
          if (node?.href) window.location.assign(node.href);
          return;
        }
        setSelected(node);
      },
    });
    // Vollbild-Panel schiebt sich über den rechten Rand — Fokussieren zentriert
    // den Knoten in der sichtbaren Restfläche statt dahinter.
    engine.setFocusOffsetX(compact ? 0 : DETAIL_PANEL_OFFSET_X);
    const cachedPositions = isGraphPositionCacheValid(posCacheRef.current, nodes.map((node) => node.id))
      ? posCacheRef.current
      : {};
    engine.applyPositions(cachedPositions);
    engine.setHiddenCats(hiddenRef.current);
    engine.setHideOrphans(hideOrphansRef.current);
    engine.setQuery(queryRef.current);
    engineRef.current = engine;
    engine.start();
    // Sperr-Zustand nach einem Datenwechsel-Rebuild wiederherstellen.
    if (lockedRef.current && !engine.locked) engine.toggleLock();
    refreshCounts();

    if (initialSelectId) {
      setSelected(nodes.find((node) => node.id === initialSelectId) ?? null);
    } else {
      setSelected(null);
    }

    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => {
        engine.refreshColors();
        engine.wake();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "data-uwe-theme", "data-theme"],
      });
    }

    return () => {
      observer?.disconnect();
      posCacheRef.current = engine.capturePositions();
      engine.destroy();
      engineRef.current = null;
    };
  }, [nodes, edges, compact, focusPageId, withMinimap, effectiveFocusId, localDepth, refreshCounts]);

  const onSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    engineRef.current?.setQuery(value);
  }, []);

  const toggleCat = useCallback(
    (cat: GraphNodeCategory) => {
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        return next;
      });
      engineRef.current?.toggleCat(cat);
      refreshCounts();
    },
    [refreshCounts],
  );

  const toggleOrphans = useCallback(() => {
    setHideOrphans((prev) => {
      const next = !prev;
      engineRef.current?.setHideOrphans(next);
      return next;
    });
    refreshCounts();
  }, [refreshCounts]);

  const zoomIn = useCallback(() => engineRef.current?.zoomBy(1.2), []);
  const zoomOut = useCallback(() => engineRef.current?.zoomBy(0.83), []);
  const fit = useCallback(() => engineRef.current?.fit(), []);
  const toggleLocalMode = useCallback(() => {
    setLocalMode((prev) => {
      if (!prev && !canGoLocal) return prev; // ohne Anker nichts umzuschalten
      return !prev;
    });
  }, [canGoLocal]);
  const changeLocalDepth = useCallback((delta: number) => {
    setLocalDepth((prev) => stepNeighborhoodDepth(prev, delta, MIN_EGO_DEPTH, MAX_EGO_DEPTH));
  }, []);
  const toggleLock = useCallback(() => {
    const value = engineRef.current?.toggleLock() ?? false;
    setLocked(value);
  }, []);
  const closePanel = useCallback(() => {
    setSelected(null);
    engineRef.current?.select(null);
  }, []);
  // Vollbild: bevorzugt die native Fullscreen-API auf dem Graph-Container;
  // ohne Unterstützung (z. B. iOS Safari) greift ein CSS-Overlay-Fallback.
  const toggleFullscreen = useCallback(() => {
    const doc = typeof document !== "undefined" ? document : null;
    if (doc?.fullscreenElement) {
      void doc.exitFullscreen().catch(() => undefined);
      setFullscreen(false);
      return;
    }
    setFullscreen((prev) => {
      if (prev) return false; // CSS-Fallback verlassen
      const el = containerRef.current;
      if (el?.requestFullscreen) {
        // Erfolg/Abbruch meldet sich über "fullscreenchange"; der State steht
        // schon jetzt auf Vollbild, damit der Fallback nahtlos übernimmt.
        el.requestFullscreen().catch(() => undefined);
      }
      return true;
    });
  }, []);
  const selectConnection = useCallback((id: string) => {
    engineRef.current?.select(id);
  }, []);

  // Detail-Panel per Escape schließen (Klick ins Leere schließt bewusst nicht).
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, closePanel]);

  // Natives Vollbild mit dem React-State synchron halten (Escape/F11 des Browsers).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => {
      setFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Escape beendet den CSS-Fallback (natives Vollbild regelt der Browser selbst;
  // ein offenes Detail-Panel hat Vorrang und wird zuerst geschlossen).
  useEffect(() => {
    if (!fullscreen || selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (typeof document !== "undefined" && document.fullscreenElement) return;
      setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, selected]);

  // Nach dem Moduswechsel neu einpassen — erst nachdem der ResizeObserver der
  // Engine die neue Canvas-Größe übernommen hat (daher doppeltes rAF).
  useEffect(() => {
    if (typeof requestAnimationFrame === "undefined") return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => engineRef.current?.fit());
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [fullscreen]);

  const presentCategories = useMemo(() => {
    const present = new Set(nodes.map((node) => node.category));
    return CATEGORY_ORDER.filter((cat) => present.has(cat));
  }, [nodes]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const connections = useMemo<PanelConnection[]>(() => {
    if (!selected) return [];
    const rows: PanelConnection[] = [];
    edges.forEach((edge) => {
      if (edge.sourceId !== selected.id && edge.targetId !== selected.id) return;
      const outgoing = edge.sourceId === selected.id;
      const otherId = outgoing ? edge.targetId : edge.sourceId;
      const other = nodeById.get(otherId);
      if (!other) return;
      rows.push({
        key: edge.id,
        id: otherId,
        dir: outgoing ? "→" : "←",
        label: edge.label,
        title: other.title,
        color: catCssColor(other.category),
        catLabel: GRAPH_NODE_CATEGORY_LABELS[other.category],
      });
    });
    rows.sort((a, b) => a.title.localeCompare(b.title, "de"));
    return rows;
  }, [selected, edges, nodeById]);

  if (!hasNodes) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <p>Keine Knoten für den aktuellen Filter.</p>
      </div>
    );
  }

  /* TODO(design-kit): uwe-fdgraph/-compact/-full/-canvas bestimmen die Geometrie,
     die GraphEngine per getBoundingClientRect() vom Canvas ausliest (Zoom, Pan,
     Minimap-Skalierung). Bewusst nicht auf Utilities migriert, um die Render-
     Fläche des Canvas 2D nicht zu verändern. */
  const containerClass = `uwe-fdgraph${compact ? " uwe-fdgraph-compact" : " uwe-fdgraph-full"}${
    fullscreen ? " uwe-fdgraph-fullscreen" : ""
  }`;
  // Im Vollbild gewinnt die CSS-Höhe des Fullscreen-Modus über die height-Prop.
  const containerStyle = height && !fullscreen ? { height: `${height}px` } : undefined;

  return (
    <div
      ref={containerRef}
      className={containerClass}
      style={containerStyle}
      role="group"
      aria-label={worldName ? `Beziehungsnetz: ${worldName}` : "Beziehungsnetz"}
    >
      <canvas ref={canvasCb} className="uwe-fdgraph-canvas" aria-hidden />

      {/* Barrierefreie, visuell versteckte Repräsentation für Screenreader/SSR. */}
      <ul className="sr-only list-none">
        {nodes.map((node) => (
          <li key={node.id}>
            <a href={node.href} aria-label={graphNodeAccessibleName(node)}>
              {node.title}
            </a>
          </li>
        ))}
      </ul>

      {!compact && worldName && (
        <div className="pointer-events-none absolute left-6 top-[22px] max-w-[60%]">
          <div className="text-[length:var(--uwe-text-2xs)] uppercase tracking-[0.12em] text-muted-foreground">
            Beziehungsnetz
          </div>
          <div className="mt-0.5 font-[family-name:var(--uwe-font-newsreader)] text-[30px] leading-[1.1] tracking-[-0.02em] text-foreground">
            {worldName}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            {nodes.length} Knoten · {edges.length} Kanten · Ziehen · scrollen zum Zoomen · Knoten
            antippen
          </div>
        </div>
      )}

      {/* Der Header oben nennt die Gesamtgröße der Welt; das Filter-Panel rechts
          zeigt die LIVE-Zahl der aktuellen Ansicht (Nachbarschaft/Kategorie-Chips) —
          bewusst getrennt, damit "Welt" und "gerade sichtbar" nicht verschmelzen. */}

      {compact && (
        <div
          className="pointer-events-none absolute left-3 top-3 flex max-w-[70%] flex-wrap gap-x-3 gap-y-[5px]"
          aria-hidden
        >
          {presentCategories.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1.5 text-[length:var(--uwe-text-2xs)] text-muted-foreground">
              <span className={DOT_BASE} style={{ background: catCssColor(cat) }} />
              {GRAPH_NODE_CATEGORY_LABELS[cat]}
            </span>
          ))}
        </div>
      )}

      {!compact && (
        <GraphViewControls
          query={query}
          onSearch={onSearch}
          categories={presentCategories}
          categoryCounts={categoryCounts}
          hidden={hidden}
          onToggleCategory={toggleCat}
          stats={viewStats}
          neighborhoodActive={!!effectiveFocusId}
          canGoNeighborhood={canGoLocal}
          onToggleNeighborhood={toggleLocalMode}
          neighborhoodAnchorTitle={effectiveFocusId ? (nodeById.get(effectiveFocusId)?.title ?? null) : null}
          depth={localDepth}
          minDepth={MIN_EGO_DEPTH}
          maxDepth={MAX_EGO_DEPTH}
          onChangeDepth={changeLocalDepth}
          hideOrphans={hideOrphans}
          orphanCount={orphanCount}
          onToggleOrphans={toggleOrphans}
        />
      )}

      <div
        className={`absolute flex flex-col divide-y divide-border overflow-hidden border border-border bg-[color-mix(in_srgb,var(--uwe-bg-elevated,var(--uwe-surface))_86%,transparent)] shadow-[var(--uwe-shadow-md)] backdrop-blur-md ${
          compact ? "bottom-3 left-3 rounded-[var(--radius)]" : "bottom-6 left-6 rounded-[var(--uwe-radius-lg)]"
        }`}
      >
        <button type="button" className={iconBtnClass(compact)} onClick={zoomIn} title="Vergrößern" aria-label="Vergrößern">
          <Plus size={compact ? 15 : 17} aria-hidden />
        </button>
        <button type="button" className={iconBtnClass(compact)} onClick={zoomOut} title="Verkleinern" aria-label="Verkleinern">
          <Minus size={compact ? 15 : 17} aria-hidden />
        </button>
        <button type="button" className={iconBtnClass(compact)} onClick={fit} title="Einpassen" aria-label="Einpassen">
          <Maximize size={compact ? 14 : 16} aria-hidden />
        </button>
        {!compact && (
          <button
            type="button"
            className={iconBtnClass(compact, locked)}
            onClick={toggleLock}
            title={locked ? "Layout entsperren" : "Layout fixieren"}
            aria-label={locked ? "Layout entsperren" : "Layout fixieren"}
            aria-pressed={locked}
          >
            {locked ? <Lock size={16} aria-hidden /> : <LockOpen size={16} aria-hidden />}
          </button>
        )}
        {!compact && (
          <button
            type="button"
            className={iconBtnClass(compact, fullscreen)}
            onClick={toggleFullscreen}
            title={fullscreen ? "Vollbild verlassen" : "Vollbild"}
            aria-label={fullscreen ? "Vollbild verlassen" : "Vollbild öffnen"}
          >
            {fullscreen ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
          </button>
        )}
      </div>

      {/* TODO(design-kit): uwe-fdgraph-minimap/-minimap-canvas bestimmen die
          Geometrie, die GraphEngine für die Minimap-Skalierung per
          getBoundingClientRect() ausliest — bewusst nicht migriert. */}
      {withMinimap && (
        <div className="uwe-fdgraph-minimap" aria-hidden>
          <div className="absolute left-2.5 top-1.5 text-[length:var(--uwe-text-2xs)] uppercase tracking-[0.1em] text-muted-foreground">
            Übersicht
          </div>
          <canvas ref={miniCb} className="uwe-fdgraph-minimap-canvas" />
        </div>
      )}

      {!compact && selected && (
        <aside
          className="absolute inset-y-0 right-0 flex h-full w-[312px] max-w-[88%] flex-col border-l border-border bg-[color-mix(in_srgb,var(--uwe-bg-elevated,var(--uwe-surface))_92%,var(--uwe-bg))] shadow-[var(--uwe-shadow-lg)] backdrop-blur-[14px] backdrop-saturate-[1.05]"
          aria-label="Knoten-Details"
        >
          <div className="flex items-start justify-between gap-2.5 px-5 pb-3.5 pt-5">
            <div className="flex flex-wrap items-center gap-[9px]">
              <span className={DOT_BASE} style={{ background: catCssColor(selected.category) }} />
              <PageTypeBadge type={selected.type} />
            </div>
            <button
              type="button"
              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[var(--radius)] border border-border text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-[color-mix(in_srgb,var(--uwe-accent)_12%,transparent)] hover:text-primary active:translate-y-px"
              onClick={closePanel}
              title="Schließen"
              aria-label="Detail-Panel schließen"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="px-5">
            <h2 className="m-0 font-[family-name:var(--uwe-font-newsreader)] text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">
              {selected.title}
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {GRAPH_NODE_CATEGORY_LABELS[selected.category]} · {connections.length} Verknüpfungen
            </p>
            <a
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary text-sm text-primary-foreground no-underline transition-colors hover:bg-primary/90"
              href={selected.href}
            >
              Seite öffnen
              <ArrowRight size={15} aria-hidden />
            </a>
          </div>
          <div className="px-5 pb-2 pt-[22px] text-[length:var(--uwe-text-2xs)] uppercase tracking-[0.12em] text-muted-foreground">
            Verknüpfungen
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-5">
            {connections.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">Keine Verknüpfungen.</p>
            )}
            {connections.map((conn) => (
              <button
                key={conn.key}
                type="button"
                className="flex w-full items-center gap-2.5 rounded-[var(--radius)] px-2.5 py-[9px] text-left transition-colors motion-reduce:transition-none hover:bg-[color-mix(in_srgb,var(--uwe-accent)_12%,transparent)]"
                onClick={() => selectConnection(conn.id)}
              >
                <span className={DOT_BASE} style={{ background: conn.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:var(--uwe-text-2xs)] text-muted-foreground">
                    {conn.dir} {conn.label}
                  </span>
                  <span className="block truncate text-[13px] text-foreground">{conn.title}</span>
                </span>
                <span className="flex-none text-[length:var(--uwe-text-2xs)] text-muted-foreground">{conn.catLabel}</span>
              </button>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

export interface GraphRelationListProps {
  edges: GraphEdge[];
  focusPageId?: string;
  nodeTitles: Record<string, string>;
}

export function GraphRelationList({
  edges,
  focusPageId,
  nodeTitles,
}: GraphRelationListProps) {
  if (edges.length === 0) {
    return <p className="italic text-muted-foreground">Keine Relationen im aktuellen Ausschnitt.</p>;
  }

  const sorted = [...edges].sort((a, b) => a.label.localeCompare(b.label, "de"));

  return (
    <ul className="m-0 grid list-none gap-2 p-0 text-[0.8125rem]">
      {sorted.map((edge) => {
        const outgoing = edge.sourceId === focusPageId;
        const otherId = outgoing ? edge.targetId : edge.sourceId;
        const direction = outgoing ? "→" : "←";
        return (
          <li key={edge.id}>
            <span className="font-semibold text-[color-mix(in_srgb,var(--uwe-accent)_75%,white_25%)]">
              {edge.label}
            </span>
            <span className="mx-[0.35rem] text-muted-foreground">{direction}</span>
            <span>{nodeTitles[otherId] ?? "Unbekannt"}</span>
            <span className="ml-2 text-xs text-muted-foreground">{edge.kind}</span>
          </li>
        );
      })}
    </ul>
  );
}
