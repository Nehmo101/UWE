// UWE Graph — Canvas-Renderer (Hauptszene + Minimap) der Nachbarschafts-Graph-Engine.
//
// Aus `graph-engine.ts` herausgezogen und auf Obsidian-Niveau gehoben, ohne die
// Parchment-OS-Palette zu verlassen: weiche Community-Hüllen, Kantenart-Hierarchie
// (wiki/relation/hierarchy), zweistufiges Fokus/Dimmen (Dim-Schicht zuerst, Fokus
// obenauf) und glasige Knoten-Verläufe statt Flat-Fill. Reine Funktionen, kein
// State — die Engine hält Zoom/Pan/Auswahl und ruft `renderGraphScene` /
// `renderGraphMinimap` pro Frame auf.
//
// Design decision (light parchment vs Obsidian void) — intentional, not a gap:
// UWE ships a light Parchment OS canvas (warm ground, ink strokes, glass chrome).
// Obsidian's local/global graph dissolves glow into near-black void. Matching that
// void would break Studio/Portal theme tokens and the product language around the
// graph. We chase Obsidian's *structure* (constellation spacing, spotlight dim,
// quiet long bridges) on parchment, not a dark-theme clone.

import type { GraphEdgeKind, GraphNodeCategory } from "@uwe/database/graph-types";
import type { SimEdge, SimNode } from "./graph-engine-dataset";
import {
  CANVAS_FONT,
  clamp,
  darken,
  lighten,
  mixColors,
  withAlpha,
  type ChromeColors,
} from "./graph-engine-visuals";

// --- Layout-/Stil-Parameter (nur Rendering — Physik bleibt in graph-engine-physics.ts) ---
const EDGE_BEND = 0.12; // Basis-Kantenbiegung (je Kantenart moduliert, s. EDGE_KIND_STYLE)
// Round-2-Fix: lange Kanten, die quer über gewonnene Leerfläche zwischen
// Communities laufen, wirkten als auffällige diagonale Bögen (Kritik: "cut
// across whitespace"). Distanz-adaptiv abflachen statt eine feste Biegung für
// jede Kantenlänge: kurze/innergemeinschaftliche Kanten behalten die volle,
// gut lesbare Biegung, lange Brücken-Kanten werden fast gerade (unauffälliger,
// liest sich eher als dünne Verbindungslinie denn als geschwungener Bogen).
const EDGE_BEND_LONG_LEN = 260; // Bildschirm-Pixel-Länge (bei aktuellem Zoom), ab der die Biegung abflacht
const EDGE_BEND_MIN_FACTOR = 0.28; // sehr lange Kanten behalten mindestens diesen Bruchteil der Basis-Biegung
const FOCUS_BRIGHT_THRESHOLD = 0.5; // hl oberhalb davon zählt als "im Fokus" (zweite Zeichenschicht)
// ROUND 7/9/10/11: lange Inter-Cluster-Brücken und leise Wiki-Kanten ausdünnen —
// Deckkraft/Breite skalieren mit Bildschirm-Länge (stärker bei niedrigem Zoom
// und im Hintergrund-Hairball beim Reinzoomen). Fokus-Kanten (hl hell) bleiben
// voll lesbar; nur Dim-/Idle-Kanten werden beschnitten.
// ROUND 9: aggressiver bei Overview — parchment constellation, not Obsidian void.
// ROUND 10: at zoom≤1, tan bridges fade harder still (whitespace constellation
// for a light-theme wiki product — not a void retheme).
// ROUND 11: at zoom≤1 and no focus, skip dim edges longer than N×median screen
// length entirely (kills residual tan web through whitespace) and further dim
// the remaining overview bridges. Focused neighborhood edges stay vivid.
const EDGE_LEN_FADE_START = 85; // ab dieser Bildschirm-Länge beginnt Ausblenden
const EDGE_LEN_FADE_END = 320; // darüber: maximale Längen-Dämpfung
const EDGE_LEN_FADE_MIN = 0.02; // unterste Multiplikator-Schranke für sehr lange Dim-Kanten
const EDGE_LEN_WIDTH_MIN = 0.14; // unterste Breiten-Schranke für sehr lange Dim-Kanten
const EDGE_LOW_WEIGHT = 1.05; // darunter (typisch wiki=1) zählt als "leise" Kante
const EDGE_LOW_WEIGHT_EXTRA = 0.32; // Extra-Dämpfung für leise Kanten außerhalb Fokus
const EDGE_LOW_ZOOM_LEN_BOOST = 1.6; // Overview (zoom≤1): längere Brücken stärker dämpfen
const EDGE_LOW_ZOOM_THRESHOLD = 1; // hardest fade / skip-draw at/below fit overview
/**
 * Dim overview bridges longer than this × median screen length are not drawn.
 * Round 11: gate only fires when there is no focus set — idle edges keep hl=1,
 * so "focus edge" must mean neighborhood-focus, not raw hl (see isFocusEdge).
 */
export const EDGE_OVERVIEW_MEDIAN_SKIP_MUL = 1.35;
/** Extra alpha mul for remaining dim edges in overview (no focus, zoom≤1). */
const EDGE_OVERVIEW_IDLE_ALPHA_MUL = 0.32;

// --- Obsidian-Vergleich: rausgezoomt sind Konstellationen fast unbeschriftet,
// nur Hover/Auswahl/Nachbarschaft und die wenigen sehr hoch vernetzten Hubs
// tragen ein Label. Erst beim Ranzoomen füllt sich die Beschriftung. ---
// `fit()` landet für einen ganzen Graphen typischerweise bei zoom≈1 (Passgenau
// auf den Viewport) — die Schwelle braucht Luft nach oben, sonst kippt genau
// dieser "ganzer Graph, ausgeruht" Fall (der AAA-Vergleichs-Screenshot!) wieder
// in die alte, zu großzügige Mittelzoom-Regel.
const LOW_ZOOM_LABEL_MAX = 1.15; // unterhalb davon: nur Fokus + echte Hubs (nicht mehr jeder deg>=3-Knoten)
const HUB_MIN_DEG = 6; // absolute Untergrenze, damit kleine/dünne Graphen nicht komplett hublos wirken
const HUB_DEG_RATIO = 0.62; // Anteil vom höchsten Grad im aktuellen Datensatz — nur die Spitze zählt als Hub

// Ausbleich-/Dimm-Stärke für Nicht-Fokus-Elemente — tiefer als vorher, damit
// der Spotlight-Effekt (Obsidian) statt eines bloßen Transparenz-Reglers wirkt.
const DIM_BLEACH_STRENGTH = 0.85; // wie stark gedimmte Knoten Richtung Pergament-Grund wandern
const NODE_HL_FLOOR = 0.045; // Mindest-Deckkraft eines Knotens (vorher 0.06)
const EDGE_ALPHA_BASE_FOCUS = 0.05; // Grund-Deckkraft einer Kante mit aktivem Fokus (vorher 0.14)
const EDGE_ALPHA_SCALE_FOCUS = 0.66; // hl-Multiplikator mit aktivem Fokus (vorher 0.62)
const EDGE_ALPHA_BASE_IDLE = 0.06; // Grund-Deckkraft ohne Fokus (Gesamtübersicht, vorher 0.14)
const EDGE_ALPHA_SCALE_IDLE = 0.16; // hl-Multiplikator ohne Fokus (vorher 0.14)

type Point = { x: number; y: number };

/** Median of an already-sorted ascending numeric array (empty → 0). */
export function medianSorted(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (values[mid - 1]! + values[mid]!) / 2 : values[mid]!;
}

/** Screen-length threshold above which overview dim bridges are skipped. */
export function overviewDimEdgeSkipLength(
  medianScreenLen: number,
  mul = EDGE_OVERVIEW_MEDIAN_SKIP_MUL,
): number {
  if (!(medianScreenLen > 0) || !(mul > 0)) return Infinity;
  return medianScreenLen * mul;
}

interface EdgeKindStyle {
  /** Zusätzlicher Breiten-Multiplikator obendrauf auf `edge.weight`. */
  widthMul: number;
  /** Gestrichelt (Länge/Lücke, in Basis-Pixeln vor Zoom-Skalierung) oder durchgezogen. */
  dash: [number, number] | null;
  /** Biegung relativ zu EDGE_BEND — Hierarchie-Kanten wirken gerader/struktureller. */
  bend: number;
  /** Tinten-Farbverlauf statt Kategorie-Verlauf (strukturelle statt inhaltliche Kante). */
  monochrome: boolean;
  /** Weicher Außen-Schein zusätzlich zur Kernlinie (betonte Beziehungen). */
  glow: boolean;
}

const EDGE_KIND_STYLE: Record<GraphEdgeKind, EdgeKindStyle> = {
  wiki: { widthMul: 1, dash: null, bend: 1, monochrome: false, glow: false },
  relation: { widthMul: 1.25, dash: null, bend: 1.25, monochrome: false, glow: true },
  hierarchy: { widthMul: 0.85, dash: [5, 4], bend: 0.4, monochrome: true, glow: false },
};

export interface RenderSceneParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  nodes: SimNode[];
  edges: SimEdge[];
  byId: (id: string) => SimNode | undefined;
  zoom: number;
  tx: number;
  ty: number;
  nodeScale: number;
  chrome: ChromeColors;
  catColors: Record<GraphNodeCategory, string>;
  hoverId: string | null;
  selectedId: string | null;
  focus: Set<string> | null;
  dotGrid: boolean;
}

export interface RenderMinimapParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  nodes: SimNode[];
  edges: SimEdge[];
  byId: (id: string) => SimNode | undefined;
  chrome: ChromeColors;
  catColors: Record<GraphNodeCategory, string>;
  hidden: Set<GraphNodeCategory>;
  viewport: { tx: number; ty: number; zoom: number; rectW: number; rectH: number };
}

function catColor(catColors: Record<GraphNodeCategory, string>, cat: GraphNodeCategory): string {
  return catColors[cat] || "#7a7060";
}

// --- Geometrie-Helfer -------------------------------------------------------

/**
 * Andrew-Monotone-Chain Konvexe Hülle. Liefert die Hülle im Uhrzeigersinn.
 * Exportiert für Unit-Tests (reine Geometrie, kein Canvas nötig). Nicht mehr
 * für Community-Hüllen genutzt (siehe Kommentar bei `drawCommunityHulls`'
 * Entfernung weiter unten) — bleibt als eigenständige, getestete Geometrie-
 * Utility erhalten, falls ein späteres Feature konvexe Hüllen braucht.
 */
export function convexHull(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// --- Beschriftungs-Helfer ----------------------------------------------------

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ROUND 4 fix: labels were positioned purely relative to the node/edge, with no
// awareness of the canvas frame — hubs near the left/right/top/bottom edge got
// their chip cut off mid-word ("Nor... 1L", named twice by the critic). Clamp
// the chip's center/top so the whole rounded chip stays inside [0,width]x
// [0,height] minus a small margin, rather than skipping the label outright —
// a slightly nudged label still reads fine, a clipped one doesn't.
const LABEL_EDGE_MARGIN = 4;

function drawLabelChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  topY: number,
  haloColor: string,
  textColor: string,
  alpha: number,
  bounds: { width: number; height: number },
): void {
  const w = ctx.measureText(text).width;
  const chipW = w + 10;
  const chipH = 16;
  const halfW = chipW / 2;
  // Falls die Chip-Breite selbst die Leinwand überschreitet (winziger Canvas /
  // sehr langer Text), fällt clamp auf die Bildmitte zurück statt negativ zu
  // werden — kein Crash, nur ein weiterhin zentrierter, evtl. leicht
  // beschnittener Rand-Fall.
  const minCx = Math.min(halfW + LABEL_EDGE_MARGIN, bounds.width / 2);
  const maxCx = Math.max(bounds.width - halfW - LABEL_EDGE_MARGIN, bounds.width / 2);
  const clampedCx = clamp(cx, minCx, maxCx);
  const minTopY = LABEL_EDGE_MARGIN;
  const maxTopY = Math.max(bounds.height - chipH - LABEL_EDGE_MARGIN, minTopY);
  const clampedTopY = clamp(topY, minTopY, maxTopY);
  ctx.globalAlpha = alpha;
  roundRectPath(ctx, clampedCx - halfW, clampedTopY, chipW, chipH, 5);
  ctx.fillStyle = haloColor;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.fillText(text, clampedCx, clampedTopY + 8);
}

// --- Knoten-Glanz -------------------------------------------------------------

// Flacherer, mattierter Verlauf statt "Murmel/Marmor"-Glanz: kleinerer,
// schwächerer Glanzpunkt, breiterer Mittelbereich in der Grundfarbe. Die
// Knoten-Tiefe kommt jetzt hauptsächlich vom weichen Außen-Schein (drawGlow),
// nicht mehr von starker Spiegelung auf der Bubble selbst.
function nodeGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  base: string,
): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.22, y - r * 0.26, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, lighten(base, 0.2));
  g.addColorStop(0.68, base);
  g.addColorStop(1, darken(base, 0.1));
  return g;
}

/** `intensity` skaliert die Kernhelligkeit — voller Bloom bei Hover/Auswahl, sehr sanft im Umgebungslicht. */
function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  intensity = 1,
): void {
  const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4);
  g.addColorStop(0, withAlpha(color, 0.32 * intensity));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
}

// --- Hauptszene ---------------------------------------------------------------

export function renderGraphScene(p: RenderSceneParams): void {
  const { ctx } = p;
  const W = p.width,
    H = p.height;
  ctx.clearRect(0, 0, W, H);

  // Pergament-Grund + weicher radialer Akzent-Wash + dezente Vignette (Tiefe).
  ctx.fillStyle = p.chrome.ground;
  ctx.fillRect(0, 0, W, H);
  const wash = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
  wash.addColorStop(0, withAlpha(p.chrome.accent, 0.05));
  wash.addColorStop(0.6, withAlpha(p.chrome.ground, 0));
  wash.addColorStop(1, withAlpha(p.chrome.ink, 0.05));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  const vignette = ctx.createRadialGradient(
    W * 0.5,
    H * 0.5,
    Math.min(W, H) * 0.35,
    W * 0.5,
    H * 0.5,
    Math.max(W, H) * 0.72,
  );
  vignette.addColorStop(0, withAlpha(p.chrome.ink, 0));
  vignette.addColorStop(1, withAlpha(p.chrome.ink, 0.06));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // sehr feines Punkteraster
  if (p.dotGrid) {
    const step = 34 * p.zoom;
    if (step > 12) {
      const ox = ((p.tx % step) + step) % step;
      const oy = ((p.ty % step) + step) % step;
      ctx.fillStyle = p.chrome.grid;
      for (let x = ox; x < W; x += step) {
        for (let y = oy; y < H; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  const s2 = (n: SimNode): [number, number] => [n.x * p.zoom + p.tx, n.y * p.zoom + p.ty];
  const radiusOf = (n: SimNode) => n.r * p.nodeScale;

  // Community-Hüllen wurden entfernt (Round-2-Entscheidung, s. CRITIC_ROUND2.md):
  // zwei Runden lang bei jeder Alpha-Stärke unterhalb der Wahrnehmungsschwelle
  // (0.05–0.14, dann 0.02–0.08) — reiner Render-/Wartungs-Kosten ohne
  // wahrnehmbaren Nutzen. Obsidians eigene Referenz-Graphen zeichnen ebenfalls
  // keine Community-Hüllen; die Konstellations-Trennung kommt dort wie hier
  // aus dem Kräfte-Layout selbst (siehe graph-engine-physics.ts), nicht aus
  // einer expliziten Umriss-Form. `convexHull` bleibt exportiert/getestet für
  // ein mögliches späteres Feature.

  // --- Kanten: Dim-Schicht zuerst, Fokus-Schicht obenauf (Obsidian-Layering:
  // gedimmte Linien dürfen fokussierte Knoten/Kanten nie optisch verdecken). ---
  const isBright = (hl: number) => hl > FOCUS_BRIGHT_THRESHOLD;
  // Round 11: overview (zoom≤1, no focus) — median length gate for dim bridges.
  const overviewNoFocus = !p.focus && p.zoom <= EDGE_LOW_ZOOM_THRESHOLD;
  let overviewSkipLen = Infinity;
  if (overviewNoFocus && p.edges.length > 0) {
    const lengths: number[] = [];
    for (const e of p.edges) {
      const s = p.byId(e.sourceId);
      const t = p.byId(e.targetId);
      if (!s || !t) continue;
      const [x1, y1] = s2(s);
      const [x2, y2] = s2(t);
      lengths.push(Math.hypot(x2 - x1, y2 - y1));
    }
    lengths.sort((a, b) => a - b);
    overviewSkipLen = overviewDimEdgeSkipLength(medianSorted(lengths));
  }
  ctx.lineCap = "round";
  const drawEdgePass = (bright: boolean) => {
    p.edges.forEach((e) => {
      if (isBright(e.hl) !== bright) return;
      const s = p.byId(e.sourceId),
        t = p.byId(e.targetId);
      if (!s || !t) return;
      const style = EDGE_KIND_STYLE[e.kind] ?? EDGE_KIND_STYLE.wiki;
      const [x1, y1] = s2(s),
        [x2, y2] = s2(t);
      const mx = (x1 + x2) / 2,
        my = (y1 + y2) / 2;
      const nx = -(y2 - y1),
        ny = x2 - x1;
      const nl = Math.hypot(nx, ny) || 1; // == Bildschirm-Länge der Kante (x1,y1)-(x2,y2)
      // Länge/Gewicht-Fade nur außerhalb der Fokus-Nachbarschaft. Idle overview
      // keeps every edge at hl≈1 — so "focus edge" means an active focus set
      // with bright hl, not raw hl alone (otherwise length skip/fade never ran).
      const a = e.hl;
      const isFocusEdge =
        p.focus != null && (bright || a > FOCUS_BRIGHT_THRESHOLD);
      // Round 11: drop long tan bridges entirely in settled overview (no focus).
      if (overviewNoFocus && nl > overviewSkipLen) return;
      // Distanz-adaptiv: lange Kanten (Brücken über gewonnene Community-Leerfläche)
      // bekommen eine flachere Biegung als kurze innergemeinschaftliche Kanten,
      // damit sie nicht als auffällige Bögen quer durchs Bild schwingen.
      const bendLenFactor = clamp(EDGE_BEND_LONG_LEN / nl, EDGE_BEND_MIN_FACTOR, 1);
      const bend = EDGE_BEND * style.bend * bendLenFactor;
      const cpx = mx + (nx / nl) * nl * bend,
        cpy = my + (ny / nl) * nl * bend;
      if (style.monochrome) {
        ctx.strokeStyle = withAlpha(p.chrome.ink, 0.85);
      } else {
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, catColor(p.catColors, s.category));
        grad.addColorStop(1, catColor(p.catColors, t.category));
        ctx.strokeStyle = grad;
      }
      const lenT = clamp(
        (nl - EDGE_LEN_FADE_START) / (EDGE_LEN_FADE_END - EDGE_LEN_FADE_START),
        0,
        1,
      );
      // Bei Überblick (zoom≤1) und beim Reinzoomen im Hintergrund stärker
      // dämpfen: lange Brücken sollen keine Diagonalen durchs Leerfeld ziehen.
      const zoomLenBoost =
        p.zoom <= EDGE_LOW_ZOOM_THRESHOLD
          ? EDGE_LOW_ZOOM_LEN_BOOST
          : clamp(0.55 + p.zoom * 0.35, 0.55, 1.15);
      const lenFade = isFocusEdge
        ? 1
        : clamp(1 - lenT * (1 - EDGE_LEN_FADE_MIN) * zoomLenBoost, EDGE_LEN_FADE_MIN, 1);
      const weightFade =
        isFocusEdge || (e.weight ?? 1) >= EDGE_LOW_WEIGHT ? 1 : EDGE_LOW_WEIGHT_EXTRA;
      const edgeFade = clamp(lenFade * weightFade, EDGE_LEN_FADE_MIN, 1);
      const overviewDim =
        overviewNoFocus && !isFocusEdge ? EDGE_OVERVIEW_IDLE_ALPHA_MUL : 1;
      const width =
        (0.9 + a * 1.5) *
        style.widthMul *
        (e.weight ?? 1) *
        Math.min(p.zoom, 1.4) *
        (isFocusEdge ? 1 : Math.max(EDGE_LEN_WIDTH_MIN, edgeFade));
      // Tieferes Dimmen als vorher (Obsidian-Spotlight): abseits des Fokus bleibt
      // fast nichts von der Kante übrig, statt einer sichtbaren Mindest-Deckkraft.
      const baseAlpha = clamp(
        ((p.focus ? EDGE_ALPHA_BASE_FOCUS : EDGE_ALPHA_BASE_IDLE) +
          a * (p.focus ? EDGE_ALPHA_SCALE_FOCUS : EDGE_ALPHA_SCALE_IDLE)) *
          edgeFade *
          overviewDim,
        isFocusEdge ? 0.02 : 0.01,
        0.85,
      );
      if (style.dash) {
        const scale = Math.max(p.zoom, 0.4);
        ctx.setLineDash([style.dash[0] * scale, style.dash[1] * scale]);
      } else {
        ctx.setLineDash([]);
      }
      // Betonte Beziehungen (relation) bekommen einen weichen Außen-Schein.
      if (style.glow && a > FOCUS_BRIGHT_THRESHOLD) {
        ctx.globalAlpha = baseAlpha * 0.35;
        ctx.lineWidth = width * 2.6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpx, cpy, x2, y2);
        ctx.stroke();
      }
      ctx.globalAlpha = baseAlpha;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);
      ctx.stroke();
    });
  };
  drawEdgePass(false);
  drawEdgePass(true);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Kanten-Label nur für hervorgehobene Kanten bei genug Zoom
  if (p.focus && p.zoom > 0.7) {
    ctx.font = `600 11px ${CANVAS_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    p.edges.forEach((e) => {
      if (e.hl < 0.7) return;
      const s = p.byId(e.sourceId),
        t = p.byId(e.targetId);
      if (!s || !t || !e.label) return;
      const [x1, y1] = s2(s),
        [x2, y2] = s2(t);
      const mx = (x1 + x2) / 2,
        my = (y1 + y2) / 2;
      drawLabelChip(
        ctx,
        e.label,
        mx,
        my - 8,
        p.chrome.labelHalo,
        p.chrome.labelText,
        clamp(e.hl, 0, 1),
        { width: W, height: H },
      );
    });
    ctx.globalAlpha = 1;
  }

  // --- Knoten: gleiche Dim/Fokus-Zweiteilung wie bei den Kanten. ---
  const showAllLabels = p.zoom > 1.35;
  const lowZoomLabels = p.zoom < LOW_ZOOM_LABEL_MAX;
  // Hub-Schwelle relativ zum tatsächlichen Datensatz: nur die Spitze der
  // Grad-Verteilung gilt rausgezoomt als "sehr hoch vernetzt" — nicht mehr
  // jeder Knoten mit deg>=3 (das war die Buchstabensuppe im AAA-Vergleich).
  const maxDeg = p.nodes.reduce((m, n) => Math.max(m, n.deg), 0);
  const hubDegThreshold = Math.max(HUB_MIN_DEG, maxDeg * HUB_DEG_RATIO);
  const drawNodePass = (bright: boolean) => {
    p.nodes.forEach((n) => {
      if (isBright(n.hl) !== bright) return;
      const [x, y] = s2(n);
      const col = catColor(p.catColors, n.category);
      const r = radiusOf(n);
      const sel = n.id === p.selectedId;
      const hov = n.id === p.hoverId;
      const a = clamp(n.hl, NODE_HL_FLOOR, 1);
      // Gedimmte Knoten bleichen Richtung Pergament aus, statt nur transparenter
      // zu werden — wirkt wie verblasste Tinte statt wie ein Deckkraft-Regler.
      // Deutlich stärkerer Bleich-Anteil als vorher (Obsidian-Spotlight).
      const fillCol = a < 0.9 ? mixColors(col, p.chrome.ground, (1 - a) * DIM_BLEACH_STRENGTH) : col;

      if ((sel || hov) && a > 0.5) {
        ctx.globalAlpha = 1;
        drawGlow(ctx, x, y, r, col);
      } else if (p.focus && p.focus.has(n.id) && !sel && !hov) {
        // Nachbarschafts-Knoten im Fokus: dezenter Ring statt vollem Bloom.
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha(col, 0.5);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (!p.focus && a > 0.5) {
        // Ohne aktiven Fokus: ein sehr sanfter Umgebungs-Schein statt Glanz auf
        // der Bubble selbst — trägt die "weiche Tiefe" ohne Spielzeug-Look.
        ctx.globalAlpha = 1;
        drawGlow(ctx, x, y, r, col, 0.4);
      }
      ctx.globalAlpha = a;
      // Ring (Pergamentfarben) zur Trennung von den Kanten
      ctx.beginPath();
      ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.chrome.ring;
      ctx.fill();
      // Glasige Füllung (Radialverlauf statt Flat-Fill)
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeGradient(ctx, x, y, r, fillCol);
      ctx.fill();
      // ROUND 4 fix (named in rounds 2 and 3, untouched until now): a near-
      // black ink contour on every single node read as a hard outline/pin on
      // the light parchment ground, unlike Obsidian's edge-less glow-into-void
      // dot. Un-selected nodes now get a hairline in the node's OWN darkened
      // fill color (not ink) — just enough to separate the bubble edge from
      // overlapping edges/siblings, without the sticker look. Selection stays
      // a stronger ink ring so the one deliberate outline in the scene still
      // reads as "this is selected", not as every node's default state.
      if (sel) {
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = p.chrome.ink;
      } else {
        ctx.lineWidth = 0.75;
        ctx.strokeStyle = withAlpha(darken(fillCol, 0.22), 0.55);
      }
      ctx.stroke();

      // Label — rausgezoomt (< LOW_ZOOM_LABEL_MAX) zeigen wir NUR Hover/
      // Auswahl/Fokus-Nachbarschaft oder echte Hubs (Grad-Spitze), sonst
      // wird der Graph zur Buchstabensuppe statt zur Obsidian-Konstellation.
      // Ab mittlerem Zoom darf mehr beschriftet werden, ab showAllLabels alles.
      const inFocusNeighborhood = !!p.focus && a > 0.6;
      const midZoomEnough = n.deg >= 3 || n.category === "session";
      const showLabel =
        a > 0.35 &&
        (showAllLabels ||
          sel ||
          hov ||
          inFocusNeighborhood ||
          (lowZoomLabels ? n.deg >= hubDegThreshold : midZoomEnough));
      if (showLabel) {
        const label = n.title.length > 26 ? n.title.slice(0, 25) + "…" : n.title;
        ctx.font = `${sel ? 700 : 400} 12px ${CANVAS_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        drawLabelChip(
          ctx,
          label,
          x,
          y + r + 4,
          p.chrome.labelHalo,
          sel ? p.chrome.ink : p.chrome.labelText,
          a,
          { width: W, height: H },
        );
      }
      ctx.globalAlpha = 1;
    });
  };
  drawNodePass(false);
  drawNodePass(true);
  ctx.globalAlpha = 1;
}

// --- Minimap -------------------------------------------------------------------

export function renderGraphMinimap(p: RenderMinimapParams): void {
  const { ctx } = p;
  const W = p.width,
    H = p.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = withAlpha(p.chrome.ink, 0.04);
  ctx.fillRect(0, 0, W, H);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  p.nodes.forEach((n) => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  });
  if (!Number.isFinite(minX)) return;
  const pad = 10;
  const w = Math.max(maxX - minX, 1),
    h = Math.max(maxY - minY, 1);
  const z = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
  const m = (n: SimNode): [number, number] => [pad + (n.x - minX) * z, pad + (n.y - minY) * z];
  p.edges.forEach((e) => {
    const s = p.byId(e.sourceId),
      t = p.byId(e.targetId);
    if (!s || !t) return;
    const [x1, y1] = m(s),
      [x2, y2] = m(t);
    ctx.strokeStyle = withAlpha(p.chrome.ink, 0.12);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  p.nodes.forEach((n) => {
    const [x, y] = m(n);
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = p.hidden.has(n.category)
      ? withAlpha(p.chrome.ink, 0.15)
      : catColor(p.catColors, n.category);
    ctx.fill();
  });
  // Viewport-Rechteck
  const { tx, ty, zoom, rectW, rectH } = p.viewport;
  const wx0 = -tx / zoom,
    wy0 = -ty / zoom;
  const wx1 = (rectW - tx) / zoom,
    wy1 = (rectH - ty) / zoom;
  const [vx0, vy0] = [pad + (wx0 - minX) * z, pad + (wy0 - minY) * z];
  const [vx1, vy1] = [pad + (wx1 - minX) * z, pad + (wy1 - minY) * z];
  ctx.strokeStyle = p.chrome.accent;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
}
