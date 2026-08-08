"use client";

// Filter-/Chrome-Panel des Vollbild-Graphen (Suche, Kategorie-Chips,
// Nachbarschafts-Umschalter + Tiefe, Live-Zähler). Aus `GraphView.tsx`
// ausgelagert, um die Datei unter dem Zeilenbudget zu halten und das Panel
// unabhängig testbar/lesbar zu machen — reine Präsentationskomponente, der
// gesamte Zustand (Auswahl, Filter, Engine) bleibt in `GraphView.tsx`.
//
// Product decision (Filters scope — intentional, not unfinished):
// UWE Filters = category chips + Nachbarschaft depth (+ optional Isolierte fade).
// No force/physics sliders, no Obsidian-style Attachments block. That thinner
// panel is a parchment-OS product choice: local-depth UX without a physics lab.
// Do not treat missing sliders as a chrome gap versus Obsidian Filters.

import type { ChangeEvent } from "react";
import { Focus, Minus, Plus, Search, Unlink } from "lucide-react";
import type { GraphNodeCategory } from "@uwe/database/graph-types";
import { GRAPH_NODE_CATEGORY_LABELS } from "@uwe/database/graph-types";
import { CHIP_COUNT_BADGE, DEPTH_STEP_BTN, catCssColor, chipClass, dotClass } from "./graph-view-chrome";

/** Live-Zähler für das Filter-Panel: Knoten/Kanten der aktuellen Ansicht
 *  (ganzer Graph oder Nachbarschaft) vor/nach den Kategorie-Chips. */
export interface GraphViewStats {
  totalNodes: number;
  totalEdges: number;
  visibleNodes: number;
  visibleEdges: number;
}

export interface GraphViewControlsProps {
  query: string;
  onSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  categories: GraphNodeCategory[];
  categoryCounts: Partial<Record<GraphNodeCategory, number>>;
  hidden: Set<GraphNodeCategory>;
  onToggleCategory: (cat: GraphNodeCategory) => void;
  stats: GraphViewStats | null;
  neighborhoodActive: boolean;
  canGoNeighborhood: boolean;
  onToggleNeighborhood: () => void;
  /** Titel des Ankerknotens, solange die Nachbarschaft aktiv ist. */
  neighborhoodAnchorTitle: string | null;
  depth: number;
  minDepth: number;
  maxDepth: number;
  onChangeDepth: (delta: number) => void;
  /** Isolierte (Grad-0) Knoten ausblenden — optionaler Filters-Chip. */
  hideOrphans: boolean;
  orphanCount: number;
  onToggleOrphans: () => void;
}

function statsLabel(visible: number, total: number, unit: string): string {
  return visible === total ? `${total} ${unit}` : `${visible} von ${total} ${unit}`;
}

export function GraphViewControls({
  query,
  onSearch,
  categories,
  categoryCounts,
  hidden,
  onToggleCategory,
  stats,
  neighborhoodActive,
  canGoNeighborhood,
  onToggleNeighborhood,
  neighborhoodAnchorTitle,
  depth,
  minDepth,
  maxDepth,
  onChangeDepth,
  hideOrphans,
  orphanCount,
  onToggleOrphans,
}: GraphViewControlsProps) {
  // Isolierte sichtbar = Chip "aktiv" (pressed=false when fading them out).
  const orphansVisible = !hideOrphans;
  return (
    <div
      className="absolute right-6 top-[22px] w-[340px] max-w-[calc(100%-48px)] rounded-[14px] border border-border bg-[color-mix(in_srgb,var(--uwe-bg-elevated,var(--uwe-surface))_80%,transparent)] p-3 shadow-[var(--uwe-shadow-md)] backdrop-blur-md backdrop-saturate-[1.05]"
      aria-label="Filter: Kategorien und Nachbarschaftstiefe (keine Physik-Regler)"
    >
      <div className="flex h-[38px] items-center gap-2 rounded-[var(--radius)] border border-border bg-[var(--uwe-input-bg,var(--uwe-bg-elevated))] px-2.5 text-muted-foreground">
        <Search size={15} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={onSearch}
          placeholder="Knoten suchen…"
          aria-label="Knoten suchen"
          className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none"
        />
      </div>

      <div className="mt-[11px] flex flex-wrap gap-[7px]">
        {categories.map((cat) => {
          const active = !hidden.has(cat);
          const count = categoryCounts[cat] ?? 0;
          return (
            <button
              key={cat}
              type="button"
              className={chipClass(active)}
              aria-pressed={active}
              onClick={() => onToggleCategory(cat)}
              title={
                active
                  ? `${GRAPH_NODE_CATEGORY_LABELS[cat]} ausblenden (${count} Knoten)`
                  : `${GRAPH_NODE_CATEGORY_LABELS[cat]} einblenden (${count} Knoten)`
              }
            >
              <span
                className={dotClass(!active)}
                style={active ? { background: catCssColor(cat) } : { borderColor: catCssColor(cat) }}
              />
              <span>{GRAPH_NODE_CATEGORY_LABELS[cat]}</span>
              <span className={CHIP_COUNT_BADGE}>{count}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`${chipClass(orphansVisible)} disabled:pointer-events-none disabled:opacity-40`}
          aria-pressed={orphansVisible}
          disabled={orphanCount === 0 && orphansVisible}
          onClick={onToggleOrphans}
          title={
            orphansVisible
              ? `Isolierte Knoten ausblenden (${orphanCount})`
              : `Isolierte Knoten einblenden (${orphanCount})`
          }
        >
          <Unlink size={13} aria-hidden />
          <span>Isolierte</span>
          <span className={CHIP_COUNT_BADGE}>{orphanCount}</span>
        </button>
      </div>

      {stats && (
        <p
          className="mt-[9px] text-[length:var(--uwe-text-2xs)] tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {statsLabel(stats.visibleNodes, stats.totalNodes, "Knoten")} ·{" "}
          {statsLabel(stats.visibleEdges, stats.totalEdges, "Kanten")}
        </p>
      )}

      <div className="mt-[11px] flex flex-wrap items-center gap-[7px] border-t border-border/60 pt-[11px]">
        <button
          type="button"
          className={`${chipClass(neighborhoodActive)} disabled:pointer-events-none disabled:opacity-40`}
          aria-pressed={neighborhoodActive}
          disabled={!neighborhoodActive && !canGoNeighborhood}
          onClick={onToggleNeighborhood}
          title={
            neighborhoodActive
              ? "Zur Gesamtansicht wechseln"
              : canGoNeighborhood
                ? "Nachbarschaft um den gewählten Knoten anzeigen"
                : "Erst einen Knoten wählen"
          }
        >
          <Focus size={13} aria-hidden />
          <span className="max-w-[160px] truncate">
            {neighborhoodActive && neighborhoodAnchorTitle
              ? `Nachbarschaft: ${neighborhoodAnchorTitle}`
              : "Nachbarschaft"}
          </span>
        </button>
        {neighborhoodActive && (
          <div className="ml-auto flex items-center gap-1.5" role="group" aria-label="Tiefe der Nachbarschaft">
            <span
              className="text-[length:var(--uwe-text-2xs)] uppercase tracking-[0.1em] text-muted-foreground"
              title="Wie viele Verknüpfungs-Schritte vom gewählten Knoten aus mit angezeigt werden"
            >
              Tiefe
            </span>
            <button
              type="button"
              className={DEPTH_STEP_BTN}
              onClick={() => onChangeDepth(-1)}
              disabled={depth <= minDepth}
              aria-label="Tiefe verringern"
              title="Tiefe verringern"
            >
              <Minus size={12} aria-hidden />
            </button>
            <span className="w-3 text-center text-[13px] tabular-nums text-foreground" aria-live="polite">
              {depth}
            </span>
            <button
              type="button"
              className={DEPTH_STEP_BTN}
              onClick={() => onChangeDepth(1)}
              disabled={depth >= maxDepth}
              aria-label="Tiefe erhöhen"
              title="Tiefe erhöhen"
            >
              <Plus size={12} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
