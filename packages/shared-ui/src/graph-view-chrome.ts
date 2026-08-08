// Geteilte Klassen-Bausteine für die GraphView-Chrome (Filter-Panel, Legende,
// Detail-Panel-Dot). Eigene, React-freie Datei, damit `GraphView.tsx` und
// `GraphViewControls.tsx` dieselben Bausteine nutzen können, ohne dass eine
// der beiden Komponenten-Dateien die andere importieren muss (keine
// zirkulären Modul-Importe).

import type { GraphNodeCategory } from "@uwe/database/graph-types";
import { GRAPH_CATEGORY_COLORS } from "./graph-engine";

/** Kategorie-Farbe als CSS-Variable mit Hex-Fallback (zieht über Themes mit). */
export function catCssColor(category: GraphNodeCategory): string {
  return `var(--uwe-graph-${category}, ${GRAPH_CATEGORY_COLORS[category]})`;
}

export const DOT_BASE = "inline-block h-2.5 w-2.5 flex-none rounded-full";

export function dotClass(ring: boolean): string {
  return ring ? `${DOT_BASE} border border-current bg-transparent` : DOT_BASE;
}

const CHIP_BASE =
  "inline-flex items-center gap-[0.45rem] rounded-full border py-[0.32rem] pl-[0.55rem] pr-[0.7rem] text-[12px] transition-colors motion-reduce:transition-none hover:border-primary hover:text-foreground ";
const CHIP_ACTIVE = "border-border bg-[var(--uwe-bg-elevated,var(--uwe-surface))] text-foreground opacity-100";
const CHIP_INACTIVE = "border-border text-muted-foreground opacity-60";

export function chipClass(active: boolean): string {
  return `${CHIP_BASE}${active ? CHIP_ACTIVE : CHIP_INACTIVE}`;
}

/** Kleines, gedecktes Zähler-Badge auf einem Filter-Chip (Anzahl Knoten der
 *  Kategorie in der aktuellen Ansicht) — bewusst dezent, damit es die
 *  Toggle-Funktion des Chips nicht überstrahlt. */
export const CHIP_COUNT_BADGE =
  "ml-0.5 rounded-full bg-[color-mix(in_srgb,var(--uwe-fg)_10%,transparent)] px-[0.4rem] py-[0.05rem] text-[10px] tabular-nums leading-[1.4] text-muted-foreground";

export const DEPTH_STEP_BTN =
  "flex h-6 w-6 flex-none items-center justify-center rounded-full border border-border text-muted-foreground transition-colors motion-reduce:transition-none hover:border-primary hover:text-primary disabled:opacity-30 disabled:pointer-events-none";
