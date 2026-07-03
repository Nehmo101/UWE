"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Lock, LockOpen, Maximize, Minus, Plus, Search, X } from "lucide-react";
import type { GraphEdge, GraphNode, GraphNodeCategory } from "@uwe/database/graph-types";
import { GRAPH_NODE_CATEGORY_LABELS } from "@uwe/database/graph-types";
import { GraphEngine, GRAPH_CATEGORY_COLORS } from "./graph-engine";
import { PageTypeBadge, VisibilityBadge } from "./StatusBadges";

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

/** Kategorie-Farbe als CSS-Variable mit Hex-Fallback (zieht über Themes mit). */
function catCssColor(category: GraphNodeCategory): string {
  return `var(--uwe-graph-${category}, ${GRAPH_CATEGORY_COLORS[category]})`;
}

function graphNodeAccessibleName(node: GraphNode): string {
  const category = GRAPH_NODE_CATEGORY_LABELS[node.category];
  return node.isFocus ? `${node.title}, ${category} (Fokus)` : `${node.title}, ${category}`;
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
  const engineRef = useRef<GraphEngine | null>(null);
  const posCacheRef = useRef<Record<string, { x: number; y: number }>>({});

  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hidden, setHidden] = useState<Set<GraphNodeCategory>>(new Set());
  const [query, setQuery] = useState("");
  const [locked, setLocked] = useState(false);

  // Spiegel des Chrome-States, damit ein Rebuild (neue Daten) den aktuellen Filter
  // übernimmt, ohne die Engine bei jedem Tastendruck neu zu erzeugen.
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
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

  // Engine-Lebenszyklus: instanziieren beim Mount, neu aufbauen bei Datenwechsel.
  useEffect(() => {
    const canvas = canvasElRef.current;
    if (!canvas || nodes.length === 0) return;

    const engine = new GraphEngine(canvas, {
      nodes,
      edges,
      selectId: focusPageId ?? null,
      compact,
      dotGrid: true,
      mini: withMinimap ? miniElRef.current : null,
      onSelect: (node) => setSelected(node),
    });
    engine.applyPositions(posCacheRef.current);
    engine.setHiddenCats(hiddenRef.current);
    engine.setQuery(queryRef.current);
    engineRef.current = engine;
    engine.start();
    // Sperr-Zustand nach einem Datenwechsel-Rebuild wiederherstellen.
    if (lockedRef.current && !engine.locked) engine.toggleLock();

    if (focusPageId) {
      setSelected(nodes.find((node) => node.id === focusPageId) ?? null);
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
  }, [nodes, edges, compact, focusPageId, withMinimap]);

  const onSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    engineRef.current?.setQuery(value);
  }, []);

  const toggleCat = useCallback((cat: GraphNodeCategory) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
    engineRef.current?.toggleCat(cat);
  }, []);

  const zoomIn = useCallback(() => engineRef.current?.zoomBy(1.2), []);
  const zoomOut = useCallback(() => engineRef.current?.zoomBy(0.83), []);
  const fit = useCallback(() => engineRef.current?.fit(), []);
  const toggleLock = useCallback(() => {
    const value = engineRef.current?.toggleLock() ?? false;
    setLocked(value);
  }, []);
  const closePanel = useCallback(() => {
    setSelected(null);
    engineRef.current?.select(null);
  }, []);
  const selectConnection = useCallback((id: string) => {
    engineRef.current?.select(id);
  }, []);

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
      <div className="uwe-graph uwe-graph-empty">
        <p>Keine Knoten für den aktuellen Filter.</p>
      </div>
    );
  }

  const containerClass = `uwe-fdgraph${compact ? " uwe-fdgraph-compact" : " uwe-fdgraph-full"}`;
  const containerStyle = height ? { height: `${height}px` } : undefined;

  return (
    <div
      className={containerClass}
      style={containerStyle}
      role="group"
      aria-label={worldName ? `Beziehungsnetz: ${worldName}` : "Beziehungsnetz"}
    >
      <canvas ref={canvasCb} className="uwe-fdgraph-canvas" aria-hidden />

      {/* Barrierefreie, visuell versteckte Repräsentation für Screenreader/SSR. */}
      <ul className="uwe-graph-a11y">
        {nodes.map((node) => (
          <li key={node.id}>
            <a href={node.href} aria-label={graphNodeAccessibleName(node)}>
              {node.title}
            </a>
          </li>
        ))}
      </ul>

      {!compact && worldName && (
        <div className="uwe-fdgraph-title">
          <div className="uwe-fdgraph-eyebrow">Beziehungsnetz</div>
          <div className="uwe-fdgraph-worldname">{worldName}</div>
          <div className="uwe-fdgraph-stats">
            {nodes.length} Knoten · {edges.length} Kanten · Ziehen · scrollen zum Zoomen · Knoten
            antippen
          </div>
        </div>
      )}

      {compact && (
        <div className="uwe-fdgraph-legend" aria-hidden>
          {presentCategories.map((cat) => (
            <span key={cat} className="uwe-fdgraph-legend-item">
              <span className="uwe-fdgraph-dot" style={{ background: catCssColor(cat) }} />
              {GRAPH_NODE_CATEGORY_LABELS[cat]}
            </span>
          ))}
        </div>
      )}

      {!compact && (
        <div className="uwe-fdgraph-searchbar">
          <div className="uwe-fdgraph-search">
            <Search size={15} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={onSearch}
              placeholder="Knoten suchen…"
              aria-label="Knoten suchen"
            />
          </div>
          <div className="uwe-fdgraph-chips">
            {presentCategories.map((cat) => {
              const active = !hidden.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  className={`uwe-fdgraph-chip${active ? " is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => toggleCat(cat)}
                >
                  <span
                    className={`uwe-fdgraph-dot${active ? "" : " is-ring"}`}
                    style={active ? { background: catCssColor(cat) } : { borderColor: catCssColor(cat) }}
                  />
                  <span>{GRAPH_NODE_CATEGORY_LABELS[cat]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={`uwe-fdgraph-zoom${compact ? " is-compact" : ""}`}>
        <button type="button" className="uwe-fdgraph-icon-btn" onClick={zoomIn} title="Vergrößern" aria-label="Vergrößern">
          <Plus size={compact ? 15 : 17} aria-hidden />
        </button>
        <button type="button" className="uwe-fdgraph-icon-btn" onClick={zoomOut} title="Verkleinern" aria-label="Verkleinern">
          <Minus size={compact ? 15 : 17} aria-hidden />
        </button>
        <button type="button" className="uwe-fdgraph-icon-btn" onClick={fit} title="Einpassen" aria-label="Einpassen">
          <Maximize size={compact ? 14 : 16} aria-hidden />
        </button>
        {!compact && (
          <button
            type="button"
            className={`uwe-fdgraph-icon-btn${locked ? " is-active" : ""}`}
            onClick={toggleLock}
            title={locked ? "Layout entsperren" : "Layout fixieren"}
            aria-label={locked ? "Layout entsperren" : "Layout fixieren"}
            aria-pressed={locked}
          >
            {locked ? <Lock size={16} aria-hidden /> : <LockOpen size={16} aria-hidden />}
          </button>
        )}
      </div>

      {withMinimap && (
        <div className="uwe-fdgraph-minimap" aria-hidden>
          <div className="uwe-fdgraph-minimap-label">Übersicht</div>
          <canvas ref={miniCb} className="uwe-fdgraph-minimap-canvas" />
        </div>
      )}

      {!compact && selected && (
        <aside className="uwe-fdgraph-panel" aria-label="Knoten-Details">
          <div className="uwe-fdgraph-panel-head">
            <div className="uwe-fdgraph-panel-badges">
              <span className="uwe-fdgraph-dot" style={{ background: catCssColor(selected.category) }} />
              <PageTypeBadge type={selected.type} />
              <VisibilityBadge visibility={selected.visibility} />
            </div>
            <button
              type="button"
              className="uwe-fdgraph-icon-btn uwe-fdgraph-panel-close"
              onClick={closePanel}
              title="Schließen"
              aria-label="Detail-Panel schließen"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <div className="uwe-fdgraph-panel-body">
            <h2 className="uwe-fdgraph-panel-title">{selected.title}</h2>
            <p className="uwe-fdgraph-panel-meta">
              {GRAPH_NODE_CATEGORY_LABELS[selected.category]} · {connections.length} Verknüpfungen
            </p>
            <a className="uwe-fdgraph-open-btn" href={selected.href}>
              Seite öffnen
              <ArrowRight size={15} aria-hidden />
            </a>
          </div>
          <div className="uwe-fdgraph-panel-section">Verknüpfungen</div>
          <div className="uwe-fdgraph-panel-conns">
            {connections.length === 0 && <p className="uwe-fdgraph-panel-empty">Keine Verknüpfungen.</p>}
            {connections.map((conn) => (
              <button
                key={conn.key}
                type="button"
                className="uwe-fdgraph-conn"
                onClick={() => selectConnection(conn.id)}
              >
                <span className="uwe-fdgraph-dot" style={{ background: conn.color }} />
                <span className="uwe-fdgraph-conn-text">
                  <span className="uwe-fdgraph-conn-dir">
                    {conn.dir} {conn.label}
                  </span>
                  <span className="uwe-fdgraph-conn-title">{conn.title}</span>
                </span>
                <span className="uwe-fdgraph-conn-cat">{conn.catLabel}</span>
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
    return <p className="uwe-empty">Keine Relationen im aktuellen Ausschnitt.</p>;
  }

  const sorted = [...edges].sort((a, b) => a.label.localeCompare(b.label, "de"));

  return (
    <ul className="uwe-graph-relations">
      {sorted.map((edge) => {
        const outgoing = edge.sourceId === focusPageId;
        const otherId = outgoing ? edge.targetId : edge.sourceId;
        const direction = outgoing ? "→" : "←";
        return (
          <li key={edge.id}>
            <span className="uwe-graph-relation-label">{edge.label}</span>
            <span className="uwe-graph-relation-arrow">{direction}</span>
            <span>{nodeTitles[otherId] ?? "Unbekannt"}</span>
            <span className="uwe-graph-relation-kind">{edge.kind}</span>
          </li>
        );
      })}
    </ul>
  );
}
