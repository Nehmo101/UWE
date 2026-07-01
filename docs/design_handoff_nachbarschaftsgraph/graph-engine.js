// UWE Nachbarschafts-Graph — kräftefreier, fließender Canvas-Graph im Parchment-OS-Stil.
// Physik-Simulation (Abstoßung + Feder + Zentrierung) die nach Interaktion sanft
// ausklingt und dann ruht ("bewegt sich nur bei Interaktion"). Rendering: Canvas 2D,
// mit Obsidian-artigem Fokus (Hover hebt Nachbarn hervor, dimmt den Rest).

const REP = 2900;      // Abstoßungsstärke
const SPRING = 0.018;  // Federkonstante
const GRAV = 0.0065;   // Zentrierungskraft
const DAMP = 0.86;     // Dämpfung → System kommt zur Ruhe
const REST = 0.045;    // Schwelle "in Ruhe"

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export class GraphEngine {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cats = opts.cats;
    this.compact = !!opts.compact;
    this.onSelect = opts.onSelect || (() => {});
    this.onHover = opts.onHover || (() => {});
    this.mini = opts.mini || null;
    this.miniCtx = this.mini ? this.mini.getContext("2d") : null;
    this.dotGrid = opts.dotGrid !== false;

    // Datensatz aufbauen (ggf. Ego-Netz um focusId)
    const built = buildDataset(opts.nodes, opts.edges, opts.focusId, opts.egoDepth);
    this.nodes = built.nodes;
    this.edges = built.edges;
    this.adj = built.adj;

    // Zustand
    this.tx = 0; this.ty = 0; this.zoom = 1;
    this.hoverId = null;
    this.selectedId = opts.focusId && !opts.egoDepth ? null : (opts.selectId || null);
    this.query = "";
    this.hidden = new Set();     // ausgeblendete Kategorien
    this.locked = false;
    this.awake = true;
    this.raf = null;
    this.L = this.compact ? 78 : 96;  // Ziel-Kantenlänge

    this._initLayout();
    this._bind();
  }

  // --- Layout-Init: Knoten dicht am Ursprung, fließen dann auseinander ---------
  _initLayout() {
    const n = this.nodes.length;
    this.nodes.forEach((nd, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = 26 + Math.random() * 30;
      nd.x = Math.cos(a) * r + (Math.random() - 0.5) * 8;
      nd.y = Math.sin(a) * r + (Math.random() - 0.5) * 8;
      nd.vx = 0; nd.vy = 0;
      nd.fixed = false;
      nd.hl = 1;      // Sichtbarkeits-/Fokus-Alpha (lerp)
      nd.deg = this.adj[nd.id] ? this.adj[nd.id].size : 0;
      // Radius skaliert klar mit dem Grad (Anzahl anliegender Kanten):
      // wenige Verbindungen → klein, viele → deutlich größer.
      nd.r = clamp(5 + Math.pow(nd.deg, 0.72) * 4.6, 6.5, this.compact ? 20 : 32);
    });
    this.edges.forEach((e) => { e.hl = 1; });
  }

  start() {
    if (this.raf) return;
    // vorab ein paar Schritte, damit der erste Frame nicht chaotisch ist
    for (let i = 0; i < 40; i++) this._step();
    this._resize();
    this.fit(false);
    this.awake = true;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this._frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this._ro) this._ro.disconnect();
    const c = this.canvas;
    c.onpointerdown = c.onpointermove = c.onpointerup = c.onpointerleave = c.onwheel = null;
  }

  wake() { this.awake = true; }

  // --- Öffentliche Steuerung ---------------------------------------------------
  setHiddenCats(set) { this.hidden = new Set(set); this.wake(); }
  toggleCat(cat) {
    if (this.hidden.has(cat)) this.hidden.delete(cat); else this.hidden.add(cat);
    this.wake();
  }
  setQuery(q) { this.query = (q || "").trim().toLowerCase(); this.wake(); }
  select(id) {
    this.selectedId = id;
    const nd = this.nodes.find((n) => n.id === id) || null;
    this.onSelect(nd);
    this.wake();
  }
  zoomBy(f, cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    cx = cx == null ? rect.width / 2 : cx;
    cy = cy == null ? rect.height / 2 : cy;
    const nz = clamp(this.zoom * f, 0.35, 3.2);
    this.tx = cx - (cx - this.tx) * (nz / this.zoom);
    this.ty = cy - (cy - this.ty) * (nz / this.zoom);
    this.zoom = nz;
    this.wake();
  }
  toggleLock() {
    this.locked = !this.locked;
    this.nodes.forEach((n) => { n.fixed = this.locked; if (this.locked) { n.vx = 0; n.vy = 0; } });
    this.wake();
    return this.locked;
  }
  fit(_anim = true) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodes.forEach((n) => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    const pad = this.compact ? 46 : 80;
    const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1);
    const z = clamp(Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h), 0.35, 2.2);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    this.zoom = z;
    this.tx = rect.width / 2 - cx * z;
    this.ty = rect.height / 2 - cy * z;
    this.wake();
  }

  // --- Physik ------------------------------------------------------------------
  _step() {
    const ns = this.nodes;
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      let fx = 0, fy = 0;
      for (let j = 0; j < ns.length; j++) {
        if (i === j) continue;
        const b = ns[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        const d = Math.sqrt(d2);
        // größere Knoten stoßen stärker ab → mehr Platz für Hubs
        const f = REP * (0.55 + (a.r + b.r) / 42) / d2;
        fx += (dx / d) * f; fy += (dy / d) * f;
      }
      fx -= a.x * GRAV; fy -= a.y * GRAV;
      a._fx = fx; a._fy = fy;
    }
    this.edges.forEach((e) => {
      const s = this._byId(e.sourceId), t = this._byId(e.targetId);
      if (!s || !t) return;
      const dx = t.x - s.x, dy = t.y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      // Ruhelänge inkl. Knotenradien, damit dicke Knoten nicht überlappen
      const rest = this.L + s.r + t.r;
      const f = SPRING * (d - rest);
      const ux = dx / d, uy = dy / d;
      s._fx += ux * f; s._fy += uy * f;
      t._fx -= ux * f; t._fy -= uy * f;
    });
    let ke = 0;
    ns.forEach((a) => {
      if (a.fixed) { a.vx = 0; a.vy = 0; return; }
      a.vx = (a.vx + a._fx) * DAMP;
      a.vy = (a.vy + a._fy) * DAMP;
      a.x += a.vx; a.y += a.vy;
      ke += a.vx * a.vx + a.vy * a.vy;
    });
    return ke / Math.max(ns.length, 1);
  }

  _byId(id) { return this._map ? this._map.get(id) : (this._map = new Map(this.nodes.map((n) => [n.id, n]))).get(id); }

  // --- Frame -------------------------------------------------------------------
  _frame() {
    let moving = false;
    if (this.awake && !this.locked && !this.drag) {
      const ke = this._step();
      moving = ke > REST;
    }
    const focus = this._focusSet();
    let transitioning = false;
    this.nodes.forEach((n) => {
      let target = 1;
      if (this.hidden.has(n.category)) target = 0.06;
      else if (focus) target = focus.has(n.id) ? 1 : 0.12;
      n.hl = lerp(n.hl, target, 0.16);
      if (Math.abs(n.hl - target) > 0.01) transitioning = true;
    });
    this.edges.forEach((e) => {
      const s = this._byId(e.sourceId), t = this._byId(e.targetId);
      let target = 1;
      if (!s || !t || this.hidden.has(s.category) || this.hidden.has(t.category)) target = 0.04;
      else if (focus) target = (focus.has(e.sourceId) && focus.has(e.targetId)) ? 1 : 0.08;
      e.hl = lerp(e.hl, target, 0.16);
      if (Math.abs(e.hl - target) > 0.01) transitioning = true;
    });
    this._render();
    if (this.mini) this._renderMini();
    if (!moving && !transitioning && !this.drag) this.awake = false;
  }

  _focusSet() {
    if (this.query) {
      const s = new Set();
      this.nodes.forEach((n) => { if (n.title.toLowerCase().includes(this.query)) s.add(n.id); });
      return s.size ? s : new Set(["__none__"]);
    }
    const id = this.hoverId || this.selectedId;
    if (!id) return null;
    const s = new Set([id]);
    (this.adj[id] || new Set()).forEach((nb) => s.add(nb));
    return s;
  }

  // --- Rendering ---------------------------------------------------------------
  _resize() {
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));
    this._dpr = dpr;
    if (this.mini) {
      const mr = this.mini.getBoundingClientRect();
      this.mini.width = Math.max(1, Math.round(mr.width * dpr));
      this.mini.height = Math.max(1, Math.round(mr.height * dpr));
    }
  }

  _render() {
    const ctx = this.ctx, c = this.canvas;
    const dpr = this._dpr || 1;
    const W = c.width / dpr, H = c.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Pergament-Grund + weicher radialer Akzent-Wash
    ctx.fillStyle = "#f1e8d4";
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
    g.addColorStop(0, "rgba(194,98,43,0.05)");
    g.addColorStop(0.6, "rgba(241,232,212,0)");
    g.addColorStop(1, "rgba(33,29,23,0.05)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sehr feines Punkteraster (Nicken an die alte Ansicht, aber ruhig)
    if (this.dotGrid) {
      const step = 34 * this.zoom;
      if (step > 12) {
        const ox = ((this.tx % step) + step) % step;
        const oy = ((this.ty % step) + step) % step;
        ctx.fillStyle = "rgba(33,29,23,0.08)";
        for (let x = ox; x < W; x += step) {
          for (let y = oy; y < H; y += step) {
            ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }

    const s2 = (n) => [n.x * this.zoom + this.tx, n.y * this.zoom + this.ty];

    // Kanten (weich gebogen, Farbverlauf zwischen den Knotenfarben)
    ctx.lineCap = "round";
    this.edges.forEach((e) => {
      const s = this._byId(e.sourceId), t = this._byId(e.targetId);
      if (!s || !t) return;
      const [x1, y1] = s2(s), [x2, y2] = s2(t);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const nx = -(y2 - y1), ny = (x2 - x1);
      const nl = Math.hypot(nx, ny) || 1;
      const bend = 0.12;
      const cpx = mx + (nx / nl) * nl * bend, cpy = my + (ny / nl) * nl * bend;
      const a = e.hl;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, this._catColor(s.category));
      grad.addColorStop(1, this._catColor(t.category));
      ctx.strokeStyle = grad;
      ctx.globalAlpha = clamp(0.14 + a * (this._focusSet() ? 0.62 : 0.14), 0.03, 0.85);
      ctx.lineWidth = (0.9 + a * 1.5) * Math.min(this.zoom, 1.4);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Kanten-Label nur für hervorgehobene Kanten bei genug Zoom
    if (this._focusSet() && this.zoom > 0.7) {
      ctx.font = `600 ${11}px "Space Mono", monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      this.edges.forEach((e) => {
        if (e.hl < 0.7) return;
        const s = this._byId(e.sourceId), t = this._byId(e.targetId);
        const [x1, y1] = s2(s), [x2, y2] = s2(t);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const w = ctx.measureText(e.label).width;
        ctx.globalAlpha = clamp(e.hl, 0, 1);
        ctx.fillStyle = "rgba(251,246,234,0.9)";
        ctx.fillRect(mx - w / 2 - 5, my - 8, w + 10, 16);
        ctx.fillStyle = "#574e40";
        ctx.fillText(e.label, mx, my + 1);
      });
      ctx.globalAlpha = 1;
    }

    // Knoten
    const showAllLabels = this.zoom > 1.35;
    this.nodes.forEach((n) => {
      const [x, y] = s2(n);
      const col = this._catColor(n.category);
      const r = n.r * clamp(this.zoom, 0.6, 1.6);
      const sel = n.id === this.selectedId;
      const hov = n.id === this.hoverId;
      const a = clamp(n.hl, 0.06, 1);

      // Glow bei Auswahl/Hover
      if ((sel || hov) && a > 0.5) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(x, y, r + 9, 0, Math.PI * 2);
        ctx.fillStyle = this._hexA(col, 0.22); ctx.fill();
      }
      ctx.globalAlpha = a;
      // Ring (Pergamentfarben) zur Trennung von den Kanten
      ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#f1e8d4"; ctx.fill();
      // Füllung
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
      // Tinten-Kontur (Auswahl kräftiger)
      ctx.lineWidth = sel ? 2.4 : 1.3;
      ctx.strokeStyle = sel ? "#211d17" : this._hexA("#211d17", 0.35);
      ctx.stroke();

      // Sichtbarkeits-Punkt (Nur-GM = Terracotta, Portal = Teal)
      if (n.visibility === "dm_only" || n.visibility === "private") {
        ctx.beginPath(); ctx.arc(x + r * 0.72, y - r * 0.72, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#c2622b"; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = "#f1e8d4"; ctx.stroke();
      }

      // Label
      const bigEnough = n.deg >= 3 || n.category === "session";
      const showLabel = a > 0.35 && (showAllLabels || bigEnough || sel || hov || (this._focusSet() && a > 0.6));
      if (showLabel) {
        const label = n.title.length > 26 ? n.title.slice(0, 25) + "…" : n.title;
        ctx.font = `${sel ? 700 : 400} 12px "Space Mono", monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        const ly = y + r + 5;
        const tw = ctx.measureText(label).width;
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(241,232,212,0.82)";
        ctx.fillRect(x - tw / 2 - 3, ly - 1, tw + 6, 15);
        ctx.fillStyle = sel ? "#211d17" : "#3d3832";
        ctx.fillText(label, x, ly);
      }
      ctx.globalAlpha = 1;
    });
    ctx.globalAlpha = 1;
  }

  _renderMini() {
    const ctx = this.miniCtx, c = this.mini, dpr = this._dpr || 1;
    const W = c.width / dpr, H = c.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(33,29,23,0.04)";
    ctx.fillRect(0, 0, W, H);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodes.forEach((n) => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    const pad = 10;
    const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1);
    const z = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
    const m = (n) => [pad + (n.x - minX) * z, pad + (n.y - minY) * z];
    this._miniTf = { z, minX, minY, pad };
    this.edges.forEach((e) => {
      const s = this._byId(e.sourceId), t = this._byId(e.targetId);
      if (!s || !t) return;
      const [x1, y1] = m(s), [x2, y2] = m(t);
      ctx.strokeStyle = "rgba(33,29,23,0.12)"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
    this.nodes.forEach((n) => {
      const [x, y] = m(n);
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = this.hidden.has(n.category) ? "rgba(33,29,23,0.15)" : this._catColor(n.category);
      ctx.fill();
    });
    // Viewport-Rechteck
    const rect = this.canvas.getBoundingClientRect();
    const wx0 = (-this.tx) / this.zoom, wy0 = (-this.ty) / this.zoom;
    const wx1 = (rect.width - this.tx) / this.zoom, wy1 = (rect.height - this.ty) / this.zoom;
    const [vx0, vy0] = [pad + (wx0 - minX) * z, pad + (wy0 - minY) * z];
    const [vx1, vy1] = [pad + (wx1 - minX) * z, pad + (wy1 - minY) * z];
    ctx.strokeStyle = "#c2622b"; ctx.lineWidth = 1.2;
    ctx.strokeRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  }

  _catColor(cat) { return (this.cats[cat] && this.cats[cat].color) || "#7a7060"; }
  _hexA(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // --- Interaktion -------------------------------------------------------------
  _pick(cx, cy) {
    // nächster Knoten unter Screen-Punkt
    let best = null, bestD = Infinity;
    for (const n of this.nodes) {
      if (this.hidden.has(n.category)) continue;
      const sx = n.x * this.zoom + this.tx, sy = n.y * this.zoom + this.ty;
      const r = n.r * clamp(this.zoom, 0.6, 1.6) + 4;
      const d = Math.hypot(cx - sx, cy - sy);
      if (d < r && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  _bind() {
    const c = this.canvas;
    let down = null, moved = 0;
    const pos = (e) => {
      const rect = c.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };
    c.style.touchAction = "none";
    c.onpointerdown = (e) => {
      c.setPointerCapture(e.pointerId);
      const [cx, cy] = pos(e);
      const hit = this._pick(cx, cy);
      down = { cx, cy, tx: this.tx, ty: this.ty, hit };
      moved = 0;
      if (hit) { this.drag = hit; hit.fixed = true; }
      this.wake();
    };
    c.onpointermove = (e) => {
      const [cx, cy] = pos(e);
      if (down) {
        moved += Math.abs(cx - down.cx) + Math.abs(cy - down.cy);
        if (this.drag) {
          this.drag.x = (cx - this.tx) / this.zoom;
          this.drag.y = (cy - this.ty) / this.zoom;
          this.drag.vx = 0; this.drag.vy = 0;
        } else {
          this.tx = down.tx + (cx - down.cx);
          this.ty = down.ty + (cy - down.cy);
        }
        this.wake();
        return;
      }
      const hit = this._pick(cx, cy);
      const id = hit ? hit.id : null;
      if (id !== this.hoverId) { this.hoverId = id; this.onHover(hit); this.wake(); }
      c.style.cursor = hit ? "pointer" : "grab";
    };
    const end = (e) => {
      if (down && this.drag) { if (!this.locked) this.drag.fixed = false; }
      if (down && moved < 5) {
        // Klick
        if (down.hit) this.select(down.hit.id);
        else this.select(null);
      }
      this.drag = null; down = null;
      this.wake();
      try { c.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    c.onpointerup = end;
    c.onpointerleave = (e) => {
      if (this.hoverId) { this.hoverId = null; this.onHover(null); this.wake(); }
      if (down) end(e);
    };
    c.onwheel = (e) => {
      e.preventDefault();
      const [cx, cy] = pos(e);
      this.zoomBy(e.deltaY < 0 ? 1.12 : 0.89, cx, cy);
    };

    this._ro = new ResizeObserver(() => { this._resize(); this.wake(); });
    this._ro.observe(c);
  }
}

// Ego-Netz um focusId (Tiefe egoDepth) oder ganzer Graph.
function buildDataset(nodes, edges, focusId, egoDepth) {
  const adjAll = {};
  edges.forEach((e) => {
    (adjAll[e.sourceId] || (adjAll[e.sourceId] = new Set())).add(e.targetId);
    (adjAll[e.targetId] || (adjAll[e.targetId] = new Set())).add(e.sourceId);
  });
  let keep;
  if (focusId && egoDepth) {
    keep = new Set([focusId]);
    let frontier = [focusId];
    for (let d = 0; d < egoDepth; d++) {
      const next = [];
      frontier.forEach((id) => (adjAll[id] || new Set()).forEach((nb) => {
        if (!keep.has(nb)) { keep.add(nb); next.push(nb); }
      }));
      frontier = next;
    }
  } else {
    keep = new Set(nodes.map((n) => n.id));
  }
  const outNodes = nodes.filter((n) => keep.has(n.id)).map((n) => ({ ...n }));
  const outEdges = edges.filter((e) => keep.has(e.sourceId) && keep.has(e.targetId)).map((e) => ({ ...e }));
  const adj = {};
  outEdges.forEach((e) => {
    (adj[e.sourceId] || (adj[e.sourceId] = new Set())).add(e.targetId);
    (adj[e.targetId] || (adj[e.targetId] = new Set())).add(e.sourceId);
  });
  outNodes.forEach((n) => { if (!adj[n.id]) adj[n.id] = new Set(); });
  return { nodes: outNodes, edges: outEdges, adj };
}
