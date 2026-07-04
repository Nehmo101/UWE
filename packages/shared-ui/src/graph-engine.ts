// UWE Nachbarschafts-Graph — kräftefreie, fließende Canvas-Engine im Parchment-OS-Stil.
//
// Physik-Simulation (Abstoßung + Feder + Zentrierung), die nach Interaktion sanft
// ausklingt und dann ruht ("bewegt sich nur bei Interaktion"). Rendering: Canvas 2D
// mit Obsidian-artigem Fokus (Hover hebt Nachbarn hervor, dimmt den Rest).
//
// Framework-agnostisch: keine React-Abhängigkeit. `GraphView.tsx` instanziiert die
// Klasse über useEffect + Callback-Ref, die Simulation läuft außerhalb des React-
// Render-Zyklus. Der Datenvertrag ist `GraphNode`/`GraphEdge` aus `graph-types.ts`.

import type { GraphEdge, GraphNode, GraphNodeCategory } from "@uwe/database/graph-types";
import { GRAPH_NODE_CATEGORIES } from "@uwe/database/graph-types";

// --- Physik-Parameter (aus dem Design-Handoff, unverändert) -------------------
const REP = 2900; // Abstoßungsstärke
const SPRING = 0.018; // Federkonstante
const GRAV = 0.0065; // Zentrierungskraft
const DAMP = 0.86; // Dämpfung → System kommt zur Ruhe
const REST = 0.045; // Schwelle "in Ruhe"
const HL_LERP = 0.16; // Fokus-/Sichtbarkeits-Interpolation pro Frame
const EDGE_BEND = 0.12; // Kantenbiegung

/**
 * Erdige Parchment-Palette (Design-Handoff). Wird als Fallback benutzt, wenn kein
 * `--uwe-graph-<kategorie>`-Token gesetzt ist. Zur Laufzeit werden diese Werte aus
 * `getComputedStyle` gelesen, damit der Graph über alle Themes mitzieht.
 */
export const GRAPH_CATEGORY_COLORS: Record<GraphNodeCategory, string> = {
  npc: "#c76b52",
  location: "#2f7d6e",
  faction: "#b08322",
  session: "#4f6d94",
  dungeon: "#7a5480",
  item: "#c78a3e",
  lore: "#6f7d5c",
  quest: "#b8462c",
  handout: "#4d8a9e",
};

/** Strukturelle Canvas-Farben (Fallbacks aus dem Parchment-OS-Handoff). */
interface ChromeColors {
  ground: string; // Pergament-Grund
  ring: string; // Trennring um Knoten (Grundfarbe)
  ink: string; // Tinten-Kontur / selektiertes Label
  labelText: string; // Label-Text (nicht selektiert)
  labelHalo: string; // Label-Hintergrund
  accent: string; // radialer Wash, Minimap-Viewport, GM-Sichtbarkeits-Dot
  dmOnly: string; // Nur-GM-Sichtbarkeit (Dot)
  grid: string; // Punkteraster
}

const CHROME_FALLBACK: ChromeColors = {
  ground: "#f1e8d4",
  ring: "#f1e8d4",
  ink: "#211d17",
  labelText: "#3d3832",
  labelHalo: "rgba(241,232,212,0.82)",
  accent: "#c2622b",
  dmOnly: "#c2622b",
  grid: "rgba(33,29,23,0.08)",
};

const CANVAS_FONT = 'ui-monospace, "Space Mono", "Cascadia Code", Consolas, monospace';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Parse `#rgb`/`#rrggbb`/`rgb()`/`rgba()` in `[r,g,b]`; null bei Unbekanntem. */
function parseRgb(color: string): [number, number, number] | null {
  const c = color.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length < 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(",").map((p) => parseFloat(p));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => !Number.isNaN(n))) {
      return [parts[0], parts[1], parts[2]];
    }
  }
  return null;
}

/** Farbe mit Alpha versehen; funktioniert für Hex und rgb()/rgba(). */
function withAlpha(color: string, a: number): string {
  const rgb = parseRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

export interface GraphEngineOptions {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Ego-Netz um diese Knoten-ID aufbauen (statt gesamter Graph). */
  focusId?: string | null;
  /** Tiefe des Ego-Netzes (nur mit focusId relevant). */
  egoDepth?: number;
  /** Initiale Auswahl (z. B. der Fokus-Knoten im Widget). */
  selectId?: string | null;
  /** Kompakt-Modus: kleinere Radien, engere Ruhelänge. */
  compact?: boolean;
  /** Punkteraster zeichnen (Standard: an). */
  dotGrid?: boolean;
  /** Minimap-Canvas (nur Vollbild). */
  mini?: HTMLCanvasElement | null;
  onSelect?: (node: GraphNode | null) => void;
  onHover?: (node: GraphNode | null) => void;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
  hl: number;
  deg: number;
  r: number;
  _fx: number;
  _fy: number;
}

interface SimEdge extends GraphEdge {
  hl: number;
}

export class GraphEngine {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private compact: boolean;
  private onSelect: (node: GraphNode | null) => void;
  private onHover: (node: GraphNode | null) => void;
  private mini: HTMLCanvasElement | null;
  private miniCtx: CanvasRenderingContext2D | null;
  private dotGrid: boolean;

  nodes: SimNode[];
  private edges: SimEdge[];
  private adj: Record<string, Set<string>>;
  private map: Map<string, SimNode>;

  private tx = 0;
  private ty = 0;
  private zoom = 1;
  hoverId: string | null = null;
  selectedId: string | null;
  private query = "";
  private hidden = new Set<GraphNodeCategory>();
  locked = false;
  private awake = true;
  private raf: number | null = null;
  private L: number;

  private drag: SimNode | null = null;
  private dpr = 1;
  private ro: ResizeObserver | null = null;

  private catColors: Record<GraphNodeCategory, string> = { ...GRAPH_CATEGORY_COLORS };
  private chrome: ChromeColors = { ...CHROME_FALLBACK };

  constructor(canvas: HTMLCanvasElement, opts: GraphEngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("GraphEngine: 2D-Canvas-Kontext nicht verfügbar");
    this.ctx = ctx;
    this.compact = !!opts.compact;
    this.onSelect = opts.onSelect ?? (() => {});
    this.onHover = opts.onHover ?? (() => {});
    this.mini = opts.mini ?? null;
    this.miniCtx = this.mini ? this.mini.getContext("2d") : null;
    this.dotGrid = opts.dotGrid !== false;

    const built = buildDataset(opts.nodes, opts.edges, opts.focusId, opts.egoDepth);
    this.nodes = built.nodes;
    this.edges = built.edges;
    this.adj = built.adj;
    this.map = new Map(this.nodes.map((n) => [n.id, n]));

    this.selectedId = opts.selectId ?? null;
    this.L = this.compact ? 78 : 96;

    this.refreshColors();
    this.initLayout();
    this.bind();
  }

  // --- Farben aus den --uwe-*-Tokens (mit Fallback) ---------------------------
  refreshColors(): void {
    if (typeof window === "undefined" || typeof getComputedStyle === "undefined") return;
    const cs = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string): string => {
      const v = cs.getPropertyValue(name).trim();
      return v || fallback;
    };
    for (const cat of GRAPH_NODE_CATEGORIES) {
      this.catColors[cat] = read(`--uwe-graph-${cat}`, GRAPH_CATEGORY_COLORS[cat]);
    }
    const bg = read("--uwe-bg", CHROME_FALLBACK.ground);
    this.chrome = {
      ground: bg,
      ring: bg,
      ink: read("--uwe-fg", CHROME_FALLBACK.ink),
      labelText: read("--uwe-fg-muted", CHROME_FALLBACK.labelText),
      labelHalo: withAlpha(read("--uwe-bg-elevated", CHROME_FALLBACK.ground), 0.82),
      accent: read("--uwe-accent", CHROME_FALLBACK.accent),
      dmOnly: read("--uwe-dm-only", CHROME_FALLBACK.dmOnly),
      grid: withAlpha(read("--uwe-fg", CHROME_FALLBACK.ink), 0.08),
    };
  }

  // --- Layout-Init: Knoten dicht am Ursprung, fließen dann auseinander --------
  private initLayout(): void {
    const n = this.nodes.length;
    this.nodes.forEach((nd, i) => {
      const a = (i / Math.max(n, 1)) * Math.PI * 2;
      const r = 26 + Math.random() * 30;
      nd.x = Math.cos(a) * r + (Math.random() - 0.5) * 8;
      nd.y = Math.sin(a) * r + (Math.random() - 0.5) * 8;
      nd.vx = 0;
      nd.vy = 0;
      nd.fixed = false;
      nd.hl = 1;
      nd.deg = this.adj[nd.id] ? this.adj[nd.id].size : 0;
      // Radius skaliert klar mit dem Grad (Anzahl anliegender Kanten):
      // wenige Verbindungen → klein, viele → deutlich größer.
      nd.r = clamp(5 + Math.pow(nd.deg, 0.72) * 4.6, 6.5, this.compact ? 20 : 32);
    });
    this.edges.forEach((e) => {
      e.hl = 1;
    });
  }

  /** Positionen aus einem Cache übernehmen (Remount/Ansichtswechsel). */
  applyPositions(cache: Record<string, { x: number; y: number }>): void {
    this.nodes.forEach((n) => {
      const p = cache[n.id];
      if (p) {
        n.x = p.x;
        n.y = p.y;
      }
    });
  }

  /** Aktuelle Positionen in einen Cache schreiben. */
  capturePositions(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    this.nodes.forEach((n) => {
      out[n.id] = { x: n.x, y: n.y };
    });
    return out;
  }

  start(prewarm = true): void {
    if (this.raf) return;
    // vorab ein paar Schritte, damit der erste Frame nicht chaotisch ist
    if (prewarm) for (let i = 0; i < 40; i++) this.step();
    this.resize();
    this.fit(false);
    this.awake = true;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.ro) this.ro.disconnect();
    const c = this.canvas;
    c.onpointerdown = c.onpointermove = c.onpointerup = c.onpointerleave = null;
    c.onpointercancel = null;
    c.onwheel = null;
  }

  wake(): void {
    this.awake = true;
  }

  // --- Öffentliche Steuerung --------------------------------------------------
  setHiddenCats(cats: Iterable<GraphNodeCategory>): void {
    this.hidden = new Set(cats);
    this.wake();
  }
  toggleCat(cat: GraphNodeCategory): void {
    if (this.hidden.has(cat)) this.hidden.delete(cat);
    else this.hidden.add(cat);
    this.wake();
  }
  setQuery(q: string): void {
    this.query = (q || "").trim().toLowerCase();
    this.wake();
  }
  select(id: string | null): void {
    // Den zuvor fixierten Auswahl-Knoten wieder freigeben …
    if (this.selectedId && this.selectedId !== id) {
      const prev = this.map.get(this.selectedId);
      if (prev && !this.locked) prev.fixed = false;
    }
    this.selectedId = id;
    const nd = id ? this.map.get(id) ?? null : null;
    // … und den neu gewählten Knoten fixieren, damit er nicht wegdriftet,
    // während der Cursor zum Detail-Panel ("Seite öffnen") wandert.
    if (nd) {
      nd.fixed = true;
      nd.vx = 0;
      nd.vy = 0;
    }
    this.onSelect(nd);
    this.wake();
  }
  zoomBy(f: number, cx?: number, cy?: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const px = cx == null ? rect.width / 2 : cx;
    const py = cy == null ? rect.height / 2 : cy;
    const nz = clamp(this.zoom * f, 0.35, 3.2);
    this.tx = px - (px - this.tx) * (nz / this.zoom);
    this.ty = py - (py - this.ty) * (nz / this.zoom);
    this.zoom = nz;
    this.wake();
  }
  toggleLock(): boolean {
    this.locked = !this.locked;
    this.nodes.forEach((n) => {
      n.fixed = this.locked;
      if (this.locked) {
        n.vx = 0;
        n.vy = 0;
      }
    });
    this.wake();
    return this.locked;
  }
  fit(anim = true): void {
    void anim;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    this.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    });
    if (!Number.isFinite(minX)) return;
    const pad = this.compact ? 46 : 80;
    const w = Math.max(maxX - minX, 1),
      h = Math.max(maxY - minY, 1);
    const z = clamp(
      Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h),
      0.35,
      2.2,
    );
    const cx = (minX + maxX) / 2,
      cy = (minY + maxY) / 2;
    this.zoom = z;
    this.tx = rect.width / 2 - cx * z;
    this.ty = rect.height / 2 - cy * z;
    this.wake();
  }

  // --- Physik -----------------------------------------------------------------
  private step(): number {
    const ns = this.nodes;
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      let fx = 0,
        fy = 0;
      for (let j = 0; j < ns.length; j++) {
        if (i === j) continue;
        const b = ns[j];
        let dx = a.x - b.x,
          dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        // größere Knoten stoßen stärker ab → mehr Platz für Hubs
        const f = (REP * (0.55 + (a.r + b.r) / 42)) / d2;
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }
      fx -= a.x * GRAV;
      fy -= a.y * GRAV;
      a._fx = fx;
      a._fy = fy;
    }
    this.edges.forEach((e) => {
      const s = this.byId(e.sourceId),
        t = this.byId(e.targetId);
      if (!s || !t) return;
      const dx = t.x - s.x,
        dy = t.y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      // Ruhelänge inkl. Knotenradien, damit dicke Knoten nicht überlappen
      const rest = this.L + s.r + t.r;
      const f = SPRING * (d - rest);
      const ux = dx / d,
        uy = dy / d;
      s._fx += ux * f;
      s._fy += uy * f;
      t._fx -= ux * f;
      t._fy -= uy * f;
    });
    let ke = 0;
    ns.forEach((a) => {
      if (a.fixed) {
        a.vx = 0;
        a.vy = 0;
        return;
      }
      a.vx = (a.vx + a._fx) * DAMP;
      a.vy = (a.vy + a._fy) * DAMP;
      a.x += a.vx;
      a.y += a.vy;
      ke += a.vx * a.vx + a.vy * a.vy;
    });
    return ke / Math.max(ns.length, 1);
  }

  private byId(id: string): SimNode | undefined {
    return this.map.get(id);
  }

  // --- Frame ------------------------------------------------------------------
  private frame(): void {
    let moving = false;
    if (this.awake && !this.locked && !this.drag) {
      const ke = this.step();
      moving = ke > REST;
    }
    const focus = this.focusSet();
    let transitioning = false;
    this.nodes.forEach((n) => {
      let target = 1;
      if (this.hidden.has(n.category)) target = 0.06;
      else if (focus) target = focus.has(n.id) ? 1 : 0.12;
      n.hl = lerp(n.hl, target, HL_LERP);
      if (Math.abs(n.hl - target) > 0.01) transitioning = true;
    });
    this.edges.forEach((e) => {
      const s = this.byId(e.sourceId),
        t = this.byId(e.targetId);
      let target = 1;
      if (!s || !t || this.hidden.has(s.category) || this.hidden.has(t.category)) target = 0.04;
      else if (focus) target = focus.has(e.sourceId) && focus.has(e.targetId) ? 1 : 0.08;
      e.hl = lerp(e.hl, target, HL_LERP);
      if (Math.abs(e.hl - target) > 0.01) transitioning = true;
    });
    this.render();
    if (this.mini) this.renderMini();
    if (!moving && !transitioning && !this.drag) this.awake = false;
  }

  private focusSet(): Set<string> | null {
    if (this.query) {
      const s = new Set<string>();
      this.nodes.forEach((n) => {
        if (n.title.toLowerCase().includes(this.query)) s.add(n.id);
      });
      return s.size ? s : new Set(["__none__"]);
    }
    const id = this.hoverId || this.selectedId;
    if (!id) return null;
    const s = new Set<string>([id]);
    (this.adj[id] || new Set()).forEach((nb) => s.add(nb));
    return s;
  }

  // --- Rendering --------------------------------------------------------------
  private resize(): void {
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));
    this.dpr = dpr;
    if (this.mini) {
      const mr = this.mini.getBoundingClientRect();
      this.mini.width = Math.max(1, Math.round(mr.width * dpr));
      this.mini.height = Math.max(1, Math.round(mr.height * dpr));
    }
  }

  private catColor(cat: GraphNodeCategory): string {
    return this.catColors[cat] || "#7a7060";
  }

  private render(): void {
    const ctx = this.ctx,
      c = this.canvas;
    const dpr = this.dpr || 1;
    const W = c.width / dpr,
      H = c.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Pergament-Grund + weicher radialer Akzent-Wash
    ctx.fillStyle = this.chrome.ground;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
    g.addColorStop(0, withAlpha(this.chrome.accent, 0.05));
    g.addColorStop(0.6, withAlpha(this.chrome.ground, 0));
    g.addColorStop(1, withAlpha(this.chrome.ink, 0.05));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sehr feines Punkteraster (Nicken an die alte Ansicht, aber ruhig)
    if (this.dotGrid) {
      const step = 34 * this.zoom;
      if (step > 12) {
        const ox = ((this.tx % step) + step) % step;
        const oy = ((this.ty % step) + step) % step;
        ctx.fillStyle = this.chrome.grid;
        for (let x = ox; x < W; x += step) {
          for (let y = oy; y < H; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    const s2 = (n: SimNode): [number, number] => [
      n.x * this.zoom + this.tx,
      n.y * this.zoom + this.ty,
    ];
    const focus = this.focusSet();

    // Kanten (weich gebogen, Farbverlauf zwischen den Knotenfarben)
    ctx.lineCap = "round";
    this.edges.forEach((e) => {
      const s = this.byId(e.sourceId),
        t = this.byId(e.targetId);
      if (!s || !t) return;
      const [x1, y1] = s2(s),
        [x2, y2] = s2(t);
      const mx = (x1 + x2) / 2,
        my = (y1 + y2) / 2;
      const nx = -(y2 - y1),
        ny = x2 - x1;
      const nl = Math.hypot(nx, ny) || 1;
      const cpx = mx + (nx / nl) * nl * EDGE_BEND,
        cpy = my + (ny / nl) * nl * EDGE_BEND;
      const a = e.hl;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, this.catColor(s.category));
      grad.addColorStop(1, this.catColor(t.category));
      ctx.strokeStyle = grad;
      ctx.globalAlpha = clamp(0.14 + a * (focus ? 0.62 : 0.14), 0.03, 0.85);
      ctx.lineWidth = (0.9 + a * 1.5) * Math.min(this.zoom, 1.4);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Kanten-Label nur für hervorgehobene Kanten bei genug Zoom
    if (focus && this.zoom > 0.7) {
      ctx.font = `600 11px ${CANVAS_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this.edges.forEach((e) => {
        if (e.hl < 0.7) return;
        const s = this.byId(e.sourceId),
          t = this.byId(e.targetId);
        if (!s || !t) return;
        const [x1, y1] = s2(s),
          [x2, y2] = s2(t);
        const mx = (x1 + x2) / 2,
          my = (y1 + y2) / 2;
        const w = ctx.measureText(e.label).width;
        ctx.globalAlpha = clamp(e.hl, 0, 1);
        ctx.fillStyle = this.chrome.labelHalo;
        ctx.fillRect(mx - w / 2 - 5, my - 8, w + 10, 16);
        ctx.fillStyle = this.chrome.labelText;
        ctx.fillText(e.label, mx, my + 1);
      });
      ctx.globalAlpha = 1;
    }

    // Knoten
    const showAllLabels = this.zoom > 1.35;
    this.nodes.forEach((n) => {
      const [x, y] = s2(n);
      const col = this.catColor(n.category);
      const r = n.r * clamp(this.zoom, 0.6, 1.6);
      const sel = n.id === this.selectedId;
      const hov = n.id === this.hoverId;
      const a = clamp(n.hl, 0.06, 1);

      // Glow bei Auswahl/Hover
      if ((sel || hov) && a > 0.5) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r + 9, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(col, 0.22);
        ctx.fill();
      }
      ctx.globalAlpha = a;
      // Ring (Pergamentfarben) zur Trennung von den Kanten
      ctx.beginPath();
      ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
      ctx.fillStyle = this.chrome.ring;
      ctx.fill();
      // Füllung
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      // Tinten-Kontur (Auswahl kräftiger)
      ctx.lineWidth = sel ? 2.4 : 1.3;
      ctx.strokeStyle = sel ? this.chrome.ink : withAlpha(this.chrome.ink, 0.35);
      ctx.stroke();

      // Sichtbarkeits-Punkt (Nur-GM = Terracotta)
      if (n.visibility === "dm_only" || n.visibility === "private") {
        ctx.beginPath();
        ctx.arc(x + r * 0.72, y - r * 0.72, 3, 0, Math.PI * 2);
        ctx.fillStyle = this.chrome.dmOnly;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = this.chrome.ring;
        ctx.stroke();
      }

      // Label
      const bigEnough = n.deg >= 3 || n.category === "session";
      const showLabel =
        a > 0.35 && (showAllLabels || bigEnough || sel || hov || (!!focus && a > 0.6));
      if (showLabel) {
        const label = n.title.length > 26 ? n.title.slice(0, 25) + "…" : n.title;
        ctx.font = `${sel ? 700 : 400} 12px ${CANVAS_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const ly = y + r + 5;
        const tw = ctx.measureText(label).width;
        ctx.globalAlpha = a;
        ctx.fillStyle = this.chrome.labelHalo;
        ctx.fillRect(x - tw / 2 - 3, ly - 1, tw + 6, 15);
        ctx.fillStyle = sel ? this.chrome.ink : this.chrome.labelText;
        ctx.fillText(label, x, ly);
      }
      ctx.globalAlpha = 1;
    });
    ctx.globalAlpha = 1;
  }

  private renderMini(): void {
    const ctx = this.miniCtx,
      c = this.mini;
    if (!ctx || !c) return;
    const dpr = this.dpr || 1;
    const W = c.width / dpr,
      H = c.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = withAlpha(this.chrome.ink, 0.04);
    ctx.fillRect(0, 0, W, H);
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    this.nodes.forEach((n) => {
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
    this.edges.forEach((e) => {
      const s = this.byId(e.sourceId),
        t = this.byId(e.targetId);
      if (!s || !t) return;
      const [x1, y1] = m(s),
        [x2, y2] = m(t);
      ctx.strokeStyle = withAlpha(this.chrome.ink, 0.12);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
    this.nodes.forEach((n) => {
      const [x, y] = m(n);
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = this.hidden.has(n.category)
        ? withAlpha(this.chrome.ink, 0.15)
        : this.catColor(n.category);
      ctx.fill();
    });
    // Viewport-Rechteck
    const rect = this.canvas.getBoundingClientRect();
    const wx0 = -this.tx / this.zoom,
      wy0 = -this.ty / this.zoom;
    const wx1 = (rect.width - this.tx) / this.zoom,
      wy1 = (rect.height - this.ty) / this.zoom;
    const [vx0, vy0] = [pad + (wx0 - minX) * z, pad + (wy0 - minY) * z];
    const [vx1, vy1] = [pad + (wx1 - minX) * z, pad + (wy1 - minY) * z];
    ctx.strokeStyle = this.chrome.accent;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  }

  // --- Interaktion ------------------------------------------------------------
  private pick(cx: number, cy: number): SimNode | null {
    let best: SimNode | null = null,
      bestD = Infinity;
    for (const n of this.nodes) {
      if (this.hidden.has(n.category)) continue;
      const sx = n.x * this.zoom + this.tx,
        sy = n.y * this.zoom + this.ty;
      const r = n.r * clamp(this.zoom, 0.6, 1.6) + 4;
      const d = Math.hypot(cx - sx, cy - sy);
      if (d < r && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  private bind(): void {
    const c = this.canvas;
    let down: { cx: number; cy: number; tx: number; ty: number; hit: SimNode | null } | null = null;
    let moved = 0;
    const pos = (e: PointerEvent | WheelEvent): [number, number] => {
      const rect = c.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };
    c.style.touchAction = "none";
    c.onpointerdown = (e) => {
      c.setPointerCapture(e.pointerId);
      const [cx, cy] = pos(e);
      const hit = this.pick(cx, cy);
      down = { cx, cy, tx: this.tx, ty: this.ty, hit };
      moved = 0;
      if (hit) {
        this.drag = hit;
        hit.fixed = true;
      }
      this.wake();
    };
    c.onpointermove = (e) => {
      const [cx, cy] = pos(e);
      if (down) {
        moved += Math.abs(cx - down.cx) + Math.abs(cy - down.cy);
        if (this.drag) {
          this.drag.x = (cx - this.tx) / this.zoom;
          this.drag.y = (cy - this.ty) / this.zoom;
          this.drag.vx = 0;
          this.drag.vy = 0;
        } else {
          this.tx = down.tx + (cx - down.cx);
          this.ty = down.ty + (cy - down.cy);
        }
        this.wake();
        return;
      }
      const hit = this.pick(cx, cy);
      const id = hit ? hit.id : null;
      if (id !== this.hoverId) {
        this.hoverId = id;
        this.onHover(hit);
        this.wake();
      }
      c.style.cursor = hit ? "pointer" : "grab";
    };
    const end = (e: PointerEvent) => {
      if (down && this.drag) {
        // Gezogenen Knoten wieder freigeben — außer er ist die aktuelle Auswahl
        // (die bleibt fixiert) oder das Layout ist global gesperrt.
        if (!this.locked && this.drag.id !== this.selectedId) this.drag.fixed = false;
      }
      if (down && moved < 5 && down.hit) {
        this.select(down.hit.id);
      }
      // Ein Klick ins Leere hebt die Auswahl bewusst NICHT auf: das Detail-Panel
      // bleibt offen, bis es über × / Escape geschlossen oder ein anderer Knoten
      // gewählt wird — so verschwindet es nicht, während man zu "Seite öffnen" zieht.
      this.drag = null;
      down = null;
      this.wake();
      try {
        c.releasePointerCapture(e.pointerId);
      } catch {
        // pointer bereits freigegeben
      }
    };
    c.onpointerup = end;
    // Pointer-Cancel (z. B. abgebrochene Geste) setzt den Zieh-/Klick-Zustand
    // sauber zurück, damit keine „hängende" Interaktion die Auswahl kippt.
    c.onpointercancel = end;
    c.onpointerleave = (e) => {
      if (this.hoverId) {
        this.hoverId = null;
        this.onHover(null);
        this.wake();
      }
      if (down) end(e);
    };
    c.onwheel = (e) => {
      e.preventDefault();
      const [cx, cy] = pos(e);
      this.zoomBy(e.deltaY < 0 ? 1.12 : 0.89, cx, cy);
    };

    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => {
        this.resize();
        this.wake();
      });
      this.ro.observe(c);
    }
  }
}

// Ego-Netz um focusId (Tiefe egoDepth) oder ganzer Graph.
function buildDataset(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focusId?: string | null,
  egoDepth?: number,
): { nodes: SimNode[]; edges: SimEdge[]; adj: Record<string, Set<string>> } {
  const adjAll: Record<string, Set<string>> = {};
  edges.forEach((e) => {
    (adjAll[e.sourceId] || (adjAll[e.sourceId] = new Set())).add(e.targetId);
    (adjAll[e.targetId] || (adjAll[e.targetId] = new Set())).add(e.sourceId);
  });
  let keep: Set<string>;
  if (focusId && egoDepth) {
    keep = new Set([focusId]);
    let frontier = [focusId];
    for (let d = 0; d < egoDepth; d++) {
      const next: string[] = [];
      frontier.forEach((id) =>
        (adjAll[id] || new Set()).forEach((nb) => {
          if (!keep.has(nb)) {
            keep.add(nb);
            next.push(nb);
          }
        }),
      );
      frontier = next;
    }
  } else {
    keep = new Set(nodes.map((n) => n.id));
  }
  const outNodes: SimNode[] = nodes
    .filter((n) => keep.has(n.id))
    .map((n) => ({
      ...n,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      fixed: false,
      hl: 1,
      deg: 0,
      r: 8,
      _fx: 0,
      _fy: 0,
    }));
  const outEdges: SimEdge[] = edges
    .filter((e) => keep.has(e.sourceId) && keep.has(e.targetId))
    .map((e) => ({ ...e, hl: 1 }));
  const adj: Record<string, Set<string>> = {};
  outEdges.forEach((e) => {
    (adj[e.sourceId] || (adj[e.sourceId] = new Set())).add(e.targetId);
    (adj[e.targetId] || (adj[e.targetId] = new Set())).add(e.sourceId);
  });
  outNodes.forEach((n) => {
    if (!adj[n.id]) adj[n.id] = new Set();
  });
  return { nodes: outNodes, edges: outEdges, adj };
}
