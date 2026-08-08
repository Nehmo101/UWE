// UWE Nachbarschafts-Graph — kräftefreie, fließende Canvas-Engine im Parchment-OS-Stil.
//
// Physik-Simulation (Abstoßung + Feder + Zentrierung + Community-Packs), die per
// Simulated Annealing auskühlt und dann ruht ("bewegt sich nur bei Interaktion").
// Communities packen sich in runde Grüppchen mit sichtbarem Abstand (Moat), eine
// weiche kreisförmige Weltgrenze hält lose Teile in Sichtweite. Rendering: Canvas 2D
// mit Obsidian-artigem Fokus (Hover hebt Nachbarn hervor, dimmt den Rest).
//
// Framework-agnostisch: keine React-Abhängigkeit. `GraphView.tsx` instanziiert die
// Klasse über useEffect + Callback-Ref, die Simulation läuft außerhalb des React-
// Render-Zyklus. Der Datenvertrag ist `GraphNode`/`GraphEdge` aus `graph-types.ts`.

import type { GraphEdge, GraphNode, GraphNodeCategory } from "@uwe/database/graph-types";
import { GRAPH_NODE_CATEGORIES } from "@uwe/database/graph-types";
import { resolveNodeCollisions } from "./graph-collision";
import { detectCommunities } from "./graph-communities";
import {
  CHROME_FALLBACK,
  GRAPH_CATEGORY_COLORS,
  clamp,
  isGraphPositionCacheValid,
  lerp,
  withAlpha,
  type ChromeColors,
} from "./graph-engine-visuals";
import { buildDataset, type SimEdge, type SimNode } from "./graph-engine-dataset";
import {
  ALPHA_CACHED,
  ALPHA_DRAG,
  ALPHA_MIN,
  COLLIDE_PAD,
  COLLIDE_PAD_INTER,
  layoutCommunityPacks,
  stepPhysics,
} from "./graph-engine-physics";
import { CameraAnimator, type CameraState } from "./graph-engine-camera";
import { renderGraphMinimap, renderGraphScene } from "./graph-engine-render";

// Öffentliche API abwärtskompatibel halten (Importe über `./graph-engine`).
export { GRAPH_CATEGORY_COLORS, isGraphPositionCacheValid };

// --- Render-/Interaktions-Parameter (Physik-Parameter: graph-engine-physics.ts) ---
const REST = 0.045; // Schwelle "in Ruhe"
const HL_LERP = 0.2; // Fokus-/Sichtbarkeits-Interpolation pro Frame (aus (reduced motion): sofort)
// Wheel-Zoom: kontinuierlicher Faktor aus deltaY statt fester Stufen — fühlt sich unter
// Maus (große, gestufte deltaY) und Trackpad (kleine, feine deltaY) gleichermaßen weich an.
// ROUND 10: slightly finer sensitivity + short coast with reverse/select cancel
// (buttery trackpad; no floaty leftover when the user flips direction or pans).
const WHEEL_SENSITIVITY = 0.00185;
const WHEEL_FACTOR_MIN = 0.72;
const WHEEL_FACTOR_MAX = 1.35;
const WHEEL_COAST_KEEP = 0.12; // fraction of ln(factor) deferred to a short coast
const WHEEL_COAST_DECAY = 0.58; // per-frame coast drain (≈2–3 frames to rest)
const COLLIDE_MAX_ITERS = 32; // Obergrenze der Kollisions-Iterationen pro Schritt (adaptiv, bricht früh ab)
const MIN_ZOOM = 0.35; // untere Zoom-Grenze (zoomBy/fit)
const MAX_ZOOM = 3.2; // obere Zoom-Grenze
// Zeichenradius-Skala: ab hier wächst der Radius langsamer als der Zoom (Lesbarkeit
// beim Reinzoomen). Die UNTERGRENZE ist bewusst MIN_ZOOM: unterhalb von 1.6 gilt
// damit Skala == Zoom, d. h. die Bildschirm-Geometrie ist eine reine Skalierung der
// (kollisionsfreien) Welt-Geometrie — Bubbles können sich beim Rauszoomen nie
// überdecken. Eine höhere Untergrenze (früher 0.6) ließ die Kreise beim Rauszoomen
// langsamer schrumpfen als ihre Abstände → sichtbare Überlappung.
const NODE_SCALE_MAX = 1.6;
// ROUND 7/10: Prewarm trägt die Annealing-Kurve sync (CPU-Schritte, nicht RAF).
// Früher: feste ~75 Schritte, Rest über ~60fps → mehrsekündiges Mount→Idle.
// ROUND 10: enough budget to finish ≈ALPHA_MIN cooling on the 100-node fixture
// before the first paint, so mount→idle is page-load + a couple RAF frames.
const PREWARM_BASE = 80;
const PREWARM_PER_NODE = 1.0;
const PREWARM_MAX = 280;
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
  /** Chrome: Isolierte Knoten (deg===0) ausblenden — bewusst dünner Filters-Scope. */
  private hideOrphans = false;
  locked = false;
  private awake = true;
  private raf: number | null = null;
  /** `true` ab dem ersten `start()` bis `destroy()` — steuert, ob `wake()` die
   *  RAF-Schleife selbst wieder anstoßen darf (vor dem ersten Start/nach dem
   *  Zerstören soll ein Chrome-Update wie `setHiddenCats()` keinen RAF anlegen). */
  private started = false;
  private L: number;

  private drag: SimNode | null = null;
  private dpr = 1;
  private ro: ResizeObserver | null = null;

  private catColors: Record<GraphNodeCategory, string> = { ...GRAPH_CATEGORY_COLORS };
  private chrome: ChromeColors = { ...CHROME_FALLBACK };
  /** Community-Zuordnung (Label Propagation) für Grüppchen-Layout und Cluster-Kraft. */
  private community: Map<string, number>;
  /** Simulations-"Temperatur": Kräfte × alpha, kühlt pro Schritt aus (→ Ruhe statt Drift). */
  private alpha = 1;
  /** Nach dem Auskühlen: einmalig Rest-Kollisionen austragen, dann Physik
   *  latched-off bis alpha wieder steigt (Drag/ALPHA_DRAG) — verhindert, dass
   *  Hover-Fokus die Kollisionsauflösung erneut Sekunden wach hält. */
  private physicsRestLatched = false;
  /** Ziel-Pack-Radius je Community (Kreis, in den das Grüppchen zurückgezogen wird). */
  private packR = new Map<number, number>();
  /** Radius der weichen Weltgrenze (aus der belegten Gesamtfläche geschätzt). */
  private boundR = 200;

  // --- Kamera-Motion (Fit / Pan-to-Selected) ----------------------------------
  private cameraAnim = new CameraAnimator();
  /** Short wheel-zoom coast (ln remaining); cancelled on reverse / select / pan. */
  private wheelCoastLn = 0;
  private wheelCoastX = 0;
  private wheelCoastY = 0;
  private wheelCoastSign = 0;
  /** Horizontaler Versatz des Kamera-Zentrums (px), z. B. um das Detail-Panel
   *  im Vollbild nicht über den fokussierten Knoten zu legen. */
  private focusOffsetX = 0;
  /** `prefers-reduced-motion` — einmal gecacht, live per Media-Query-Listener aktuell gehalten. */
  private reducedMotion = false;
  private reducedMotionMedia: MediaQueryList | null = null;
  private readonly onReducedMotionChange = (e: MediaQueryListEvent): void => {
    this.reducedMotion = e.matches;
  };

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
    this.L = this.compact ? 64 : 80;
    this.community = detectCommunities(this.nodes.map((n) => n.id), this.adj);

    this.refreshColors();
    this.initLayout();
    this.bind();

    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      try {
        this.reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
        this.reducedMotion = this.reducedMotionMedia.matches;
        this.reducedMotionMedia.addEventListener?.("change", this.onReducedMotionChange);
      } catch {
        this.reducedMotion = false;
      }
    }
  }

  /** Horizontalen Kamera-Versatz setzen (siehe `focusOffsetX`). */
  setFocusOffsetX(px: number): void {
    this.focusOffsetX = px;
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

  // --- Layout-Init: jede Community als eigene Kreis-Packung (Phyllotaxis) ------
  private initLayout(): void {
    this.nodes.forEach((nd) => {
      nd.vx = 0;
      nd.vy = 0;
      nd.fixed = false;
      nd.hl = 1;
      nd.deg = this.adj[nd.id] ? this.adj[nd.id].size : 0;
      // Radius skaliert klar mit dem Grad (Anzahl anliegender Kanten):
      // wenige Verbindungen → klein, viele → deutlich größer.
      nd.r = clamp(5 + Math.pow(nd.deg, 0.72) * 4.6, 6.5, this.compact ? 20 : 32);
      nd.group = this.community.get(nd.id) ?? -1;
    });

    // Grüppchen als eigene Kreis-Packungen platzieren (Details: graph-engine-physics.ts).
    // Edges fließen in den struktur-bewussten Loben-Split (>12) ein.
    this.boundR = layoutCommunityPacks(this.nodes, this.packR, this.edges);

    this.edges.forEach((e) => {
      e.hl = 1;
    });
  }

  /** Positionen aus einem Cache übernehmen (Remount/Ansichtswechsel). */
  applyPositions(cache: Record<string, { x: number; y: number }>): void {
    let applied = 0;
    this.nodes.forEach((n) => {
      const p = cache[n.id];
      if (p) {
        n.x = p.x;
        n.y = p.y;
        applied += 1;
      }
    });
    // Ein gecachtes Layout ist schon "fertig": nur sanft nachsetzen lassen,
    // statt es mit voller Temperatur wieder aufzuschmelzen.
    if (applied > 0) this.alpha = Math.min(this.alpha, ALPHA_CACHED);
  }

  /** Aktuelle Positionen in einen Cache schreiben. */
  capturePositions(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    this.nodes.forEach((n) => {
      out[n.id] = { x: n.x, y: n.y };
    });
    return out;
  }

  // RAF-Schleife: rendert einen Frame und plant den nächsten NUR, solange `awake`
  // danach noch wahr ist. `frame()` selbst setzt `awake = false`, sobald Physik,
  // Kamera-Tween und Fokus-/Dimm-Übergänge zur Ruhe gekommen sind — die Schleife
  // stoppt dann komplett (kein Timer, keine CPU) statt "leer" weiterzulaufen.
  // Ein völlig ruhender Graph verbraucht dadurch keine RAF-Callbacks mehr; jede
  // Interaktion/Chrome-Änderung ruft `wake()`, das die Schleife bei Bedarf wieder
  // anstößt.
  private readonly loop = (): void => {
    this.frame();
    if (this.awake) {
      this.raf = requestAnimationFrame(this.loop);
    } else {
      this.raf = null;
    }
  };

  start(prewarm = true): void {
    if (this.raf) return;
    // Sync-Prewarm: Annealing auf der CPU austragen, nicht über RAF-Frames.
    // Early-Exit wenn Kräfte aus (alpha < ALPHA_MIN) und kinetische Energie
    // inkl. Kollisionen unter REST — dann braucht RAF nur noch den ersten
    // Render + Idle-Sleep, statt hunderte Annealing-Schritte bei ~60fps.
    if (prewarm) {
      const steps = Math.min(
        PREWARM_MAX,
        Math.round(PREWARM_BASE + this.nodes.length * PREWARM_PER_NODE),
      );
      for (let i = 0; i < steps; i++) {
        const ke = this.step();
        if (this.alpha < ALPHA_MIN && ke < REST) break;
      }
    }
    this.resize();
    this.fit(false);
    // Initial selection (opts.selectId) must honor focusOffsetX so the node
    // lands left of an open detail panel — fit() alone centers the whole graph
    // and can leave the focus under the panel. Instant (no tween) like fit(false).
    if (this.selectedId) {
      const nd = this.map.get(this.selectedId);
      if (nd) {
        nd.fixed = true;
        nd.vx = 0;
        nd.vy = 0;
        this.frameNode(nd, false);
      }
    }
    this.started = true;
    this.awake = true;
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.started = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.ro) this.ro.disconnect();
    this.reducedMotionMedia?.removeEventListener?.("change", this.onReducedMotionChange);
    this.reducedMotionMedia = null;
    const c = this.canvas;
    c.onpointerdown = c.onpointermove = c.onpointerup = c.onpointerleave = null;
    c.onpointercancel = null;
    c.onwheel = null;
  }

  /** Interaktion/Chrome-Änderung meldet "wieder aktiv werden": setzt `awake` und
   *  stößt die gestoppte RAF-Schleife neu an, falls sie gerade schläft. Vor dem
   *  ersten `start()` (oder nach `destroy()`) legt das bewusst KEINEN RAF an —
   *  reine State-Updates (z. B. `setHiddenCats()` vor dem Mount) sollen keine
   *  Schleife starten, die niemand rendert. */
  wake(): void {
    this.awake = true;
    if (this.started && this.raf == null) {
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  // --- Live-Zähler (Chrome-Panel: Knoten-/Kanten-Anzahl bei aktiven Filtern) ---
  /** Anzahl Knoten der aktuellen Ansicht (ganzer Graph oder Nachbarschaft, je
   *  nach `focusId`/`egoDepth`) — unabhängig von Kategorie-Chips. */
  get nodeCount(): number {
    return this.nodes.length;
  }
  /** Anzahl Kanten der aktuellen Ansicht (siehe `nodeCount`). */
  get edgeCount(): number {
    return this.edges.length;
  }
  /** Wie viele Knoten der aktuellen Ansicht NICHT über die Kategorie-Chips
   *  (bzw. den Isolierte-Chip) ausgeblendet sind. */
  visibleNodeCount(): number {
    let n = 0;
    this.nodes.forEach((node) => {
      if (this.hidden.has(node.category)) return;
      if (this.hideOrphans && node.deg === 0) return;
      n += 1;
    });
    return n;
  }
  /** Anzahl isolierter Knoten (Grad 0) in der aktuellen Ansicht — Badge für
   *  den Isolierte-Chip. */
  orphanCount(): number {
    let n = 0;
    this.nodes.forEach((node) => {
      if (node.deg === 0) n += 1;
    });
    return n;
  }
  /** Wie viele Kanten der aktuellen Ansicht an keinem Ende eine ausgeblendete
   *  Kategorie berühren (spiegelt die Dimm-Logik in `frame()`). */
  visibleEdgeCount(): number {
    let n = 0;
    this.edges.forEach((edge) => {
      const s = this.map.get(edge.sourceId);
      const t = this.map.get(edge.targetId);
      if (!s || !t || this.hidden.has(s.category) || this.hidden.has(t.category)) return;
      n += 1;
    });
    return n;
  }
  /** Knoten der aktuellen Ansicht je Kategorie gezählt — Basis für die
   *  optionalen Zähl-Badges auf den Filter-Chips. */
  categoryCounts(): Partial<Record<GraphNodeCategory, number>> {
    const counts: Partial<Record<GraphNodeCategory, number>> = {};
    this.nodes.forEach((node) => {
      counts[node.category] = (counts[node.category] ?? 0) + 1;
    });
    return counts;
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
  setHideOrphans(hide: boolean): void {
    this.hideOrphans = hide;
    this.wake();
  }
  setQuery(q: string): void {
    this.query = (q || "").trim().toLowerCase();
    this.wake();
  }
  select(id: string | null): void {
    // Select-pan tween wins over leftover wheel coast.
    this.cancelWheelCoast();
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
      this.frameNode(nd);
    }
    this.onSelect(nd);
    this.wake();
  }
  /** Drop any leftover wheel coast (reverse notch, select pan, grab). */
  private cancelWheelCoast(): void {
    this.wheelCoastLn = 0;
    this.wheelCoastSign = 0;
  }

  /** Apply a zoom factor about a canvas point (no tween/coast side effects). */
  private applyZoomAbout(f: number, px: number, py: number): void {
    const nz = clamp(this.zoom * f, MIN_ZOOM, MAX_ZOOM);
    if (nz === this.zoom) return;
    this.tx = px - (px - this.tx) * (nz / this.zoom);
    this.ty = py - (py - this.ty) * (nz / this.zoom);
    this.zoom = nz;
  }

  zoomBy(f: number, cx?: number, cy?: number): void {
    // Ein manueller Zoom-Eingriff gewinnt gegenüber einem laufenden Kamera-Tween.
    this.cameraAnim.cancel();
    this.cancelWheelCoast();
    const rect = this.canvas.getBoundingClientRect();
    const px = cx == null ? rect.width / 2 : cx;
    const py = cy == null ? rect.height / 2 : cy;
    this.applyZoomAbout(f, px, py);
    this.wake();
  }
  /** Kamera sanft (oder — reduced motion/anim=false — sofort) auf einen Zielzustand bringen. */
  private applyCamera(target: CameraState, animate: boolean): void {
    // Camera tween must win over leftover wheel coast (select/fit already cancel;
    // belt-and-suspenders so coast never fights mid-tween pan/zoom).
    this.cancelWheelCoast();
    if (!animate || this.reducedMotion) {
      this.cameraAnim.cancel();
      this.tx = target.tx;
      this.ty = target.ty;
      this.zoom = target.zoom;
      this.wake();
      return;
    }
    this.cameraAnim.start({ tx: this.tx, ty: this.ty, zoom: this.zoom }, target);
    this.wake();
  }
  /** Sanft zur Auswahl schwenken (Obsidian-Gefühl): Zoom bleibt erhalten, nur der
   *  Pan zentriert den Knoten — bei geöffnetem Detail-Panel per `focusOffsetX`
   *  leicht nach links versetzt, damit der Knoten nicht dahinter verschwindet. */
  private frameNode(node: SimNode, animate = true): void {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return;
    const cx = rect.width / 2 - this.focusOffsetX;
    const cy = rect.height / 2;
    this.applyCamera(
      { zoom: this.zoom, tx: cx - node.x * this.zoom, ty: cy - node.y * this.zoom },
      animate,
    );
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
    this.cancelWheelCoast();
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
      MIN_ZOOM,
      2.2,
    );
    const cx = (minX + maxX) / 2,
      cy = (minY + maxY) / 2;
    this.applyCamera({ zoom: z, tx: rect.width / 2 - cx * z, ty: rect.height / 2 - cy * z }, anim);
  }

  // --- Physik (Kräfte + Annealing: graph-engine-physics.ts) --------------------
  private step(): number {
    const { ke, alpha } = stepPhysics({
      nodes: this.nodes,
      edges: this.edges,
      byId: (id) => this.map.get(id),
      L: this.L,
      alpha: this.alpha,
      packR: this.packR,
      boundR: this.boundR,
    });
    this.alpha = alpha;
    // "Nicht berühren": Überlappungen nach der Integration hart auflösen, damit
    // sich Bubbles nie überdecken (Abstoßung allein garantiert das nicht). Die
    // (bereits pro Knoten normierte) Kollisions-Energie hält den Graph wach,
    // solange noch etwas entzerrt werden muss.
    return ke + this.resolveCollisions();
  }

  // "Nicht berühren": Bubble-Überlappungen hart auflösen (Details + Algorithmus in
  // `graph-collision.ts`). Rückgabe fließt in die Ruhe-Erkennung ein.
  private resolveCollisions(): number {
    return resolveNodeCollisions(this.nodes, COLLIDE_PAD, COLLIDE_MAX_ITERS, COLLIDE_PAD_INTER);
  }

  private byId(id: string): SimNode | undefined {
    return this.map.get(id);
  }

  /** Zeichenradius-Skala: unterhalb von NODE_SCALE_MAX identisch mit dem Zoom
   *  (→ garantiert überlappungsfrei), darüber gedeckelt für Lesbarkeit. */
  private nodeScale(): number {
    return clamp(this.zoom, MIN_ZOOM, NODE_SCALE_MAX);
  }

  // --- Frame ------------------------------------------------------------------
  private frame(): void {
    const cameraState = this.cameraAnim.step();
    if (cameraState) {
      this.tx = cameraState.tx;
      this.ty = cameraState.ty;
      this.zoom = cameraState.zoom;
    }
    let wheelCoasting = false;
    if (this.wheelCoastLn !== 0) {
      const step = this.wheelCoastLn * WHEEL_COAST_DECAY;
      this.wheelCoastLn -= step;
      if (Math.abs(this.wheelCoastLn) < 1e-4) this.cancelWheelCoast();
      this.applyZoomAbout(Math.exp(step), this.wheelCoastX, this.wheelCoastY);
      wheelCoasting = this.wheelCoastLn !== 0;
    }
    let moving = false;
    if (this.awake && !this.locked) {
      if (this.drag) {
        // Während des Ziehens läuft nur die Kollisionsauflösung: der gezogene
        // Knoten ist fixiert und schiebt überlappende Nachbarn beiseite, ohne
        // dass die volle Physik das Layout unter dem Cursor verrutschen lässt.
        this.physicsRestLatched = false;
        moving = this.resolveCollisions() > REST;
      } else if (this.alpha >= ALPHA_MIN) {
        this.physicsRestLatched = false;
        const ke = this.step();
        moving = ke > REST;
      } else if (!this.physicsRestLatched) {
        // ROUND 7: ausgekühlte Simulation — Rest-Kollisionen einmal austragen,
        // dann latched. Hover/Fokus weckt nur noch Highlight-Lerps, nicht die
        // Kollisions-Schleife (wake→settle-Regression Round 6).
        moving = this.resolveCollisions() > REST;
        if (!moving) this.physicsRestLatched = true;
      }
    }
    const focus = this.focusSet();
    // Reduced motion: Fokus-/Dimm-Übergänge springen direkt ans Ziel statt zu faden.
    const hlLerp = this.reducedMotion ? 1 : HL_LERP;
    let transitioning = false;
    this.nodes.forEach((n) => {
      let target = 1;
      if (this.hidden.has(n.category) || (this.hideOrphans && n.deg === 0)) target = 0.06;
      else if (focus) target = focus.has(n.id) ? 1 : 0.12;
      n.hl = lerp(n.hl, target, hlLerp);
      if (Math.abs(n.hl - target) > 0.01) transitioning = true;
    });
    this.edges.forEach((e) => {
      const s = this.byId(e.sourceId),
        t = this.byId(e.targetId);
      let target = 1;
      if (
        !s ||
        !t ||
        this.hidden.has(s.category) ||
        this.hidden.has(t.category) ||
        (this.hideOrphans && (s.deg === 0 || t.deg === 0))
      ) {
        target = 0.04;
      } else if (focus) target = focus.has(e.sourceId) && focus.has(e.targetId) ? 1 : 0.08;
      e.hl = lerp(e.hl, target, hlLerp);
      if (Math.abs(e.hl - target) > 0.01) transitioning = true;
    });
    this.render();
    if (this.mini) this.renderMini();
    if (
      !moving &&
      !transitioning &&
      !this.drag &&
      !this.cameraAnim.isAnimating() &&
      !wheelCoasting
    ) {
      this.awake = false;
    }
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

  // Zeichnen selbst lebt in `graph-engine-render.ts` (Modul-Disziplin + eigene
  // Zuständigkeit für Visuals): die Engine bündelt nur ihren aktuellen State.
  private render(): void {
    const ctx = this.ctx,
      c = this.canvas;
    const dpr = this.dpr || 1;
    const W = c.width / dpr,
      H = c.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderGraphScene({
      ctx,
      width: W,
      height: H,
      nodes: this.nodes,
      edges: this.edges,
      byId: (id) => this.byId(id),
      zoom: this.zoom,
      tx: this.tx,
      ty: this.ty,
      nodeScale: this.nodeScale(),
      chrome: this.chrome,
      catColors: this.catColors,
      hoverId: this.hoverId,
      selectedId: this.selectedId,
      focus: this.focusSet(),
      dotGrid: this.dotGrid,
    });
  }

  private renderMini(): void {
    const ctx = this.miniCtx,
      c = this.mini;
    if (!ctx || !c) return;
    const dpr = this.dpr || 1;
    const W = c.width / dpr,
      H = c.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rect = this.canvas.getBoundingClientRect();
    renderGraphMinimap({
      ctx,
      width: W,
      height: H,
      nodes: this.nodes,
      edges: this.edges,
      byId: (id) => this.byId(id),
      chrome: this.chrome,
      catColors: this.catColors,
      hidden: this.hidden,
      viewport: { tx: this.tx, ty: this.ty, zoom: this.zoom, rectW: rect.width, rectH: rect.height },
    });
  }

  // --- Interaktion ------------------------------------------------------------
  private pick(cx: number, cy: number): SimNode | null {
    let best: SimNode | null = null,
      bestD = Infinity;
    for (const n of this.nodes) {
      if (this.hidden.has(n.category)) continue;
      if (this.hideOrphans && n.deg === 0) continue;
      const sx = n.x * this.zoom + this.tx,
        sy = n.y * this.zoom + this.ty;
      const r = n.r * this.nodeScale() + 4;
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
      // Ein manueller Grab/Drag gewinnt gegenüber einem laufenden Kamera-Tween
      // und gegenüber Rest-Wheel-Coast (Inertia-Cancel).
      this.cameraAnim.cancel();
      this.cancelWheelCoast();
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
        // Nach echtem Ziehen die Simulation kurz wieder aufwärmen, damit sich
        // die Nachbarschaft neu ordnet (ein Klick ohne Bewegung heizt nicht).
        if (moved >= 5) this.alpha = Math.max(this.alpha, ALPHA_DRAG);
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
      // Kontinuierlicher Faktor statt fester Stufen: Maus-Notches (großes deltaY)
      // zoomen spürbar, Trackpad-Gesten (kleine, feine deltaY) fein — beides um
      // den Cursor herum, damit der Punkt unter der Maus stehen bleibt.
      // ROUND 10: apply most immediately, coast a sliver; reverse delta cancels coast.
      this.cameraAnim.cancel();
      const rawLn = -e.deltaY * WHEEL_SENSITIVITY;
      const sign = Math.sign(rawLn) || this.wheelCoastSign;
      if (this.wheelCoastSign && sign && sign !== this.wheelCoastSign) {
        this.cancelWheelCoast();
      }
      const factor = clamp(Math.exp(rawLn), WHEEL_FACTOR_MIN, WHEEL_FACTOR_MAX);
      const ln = Math.log(factor);
      const immediate = Math.exp(ln * (1 - WHEEL_COAST_KEEP));
      this.applyZoomAbout(immediate, cx, cy);
      this.wheelCoastLn += ln * WHEEL_COAST_KEEP;
      this.wheelCoastX = cx;
      this.wheelCoastY = cy;
      this.wheelCoastSign = sign;
      this.wake();
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
