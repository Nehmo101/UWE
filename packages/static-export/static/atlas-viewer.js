/**
 * Static Atlas viewer for UWE portal exports.
 * Loads atlas/data.json and renders a read-only canvas map with drill-down.
 */
(() => {
  // Solid tile-layer fills — same palette as the single-file editor runtime.
  const TILE_FILL = {
    grassland: "#a9c47f",
    coast: "#9fc0d2",
    hills: "#c2a878",
    desert: "#dcc47c",
    forest: "#7a9463",
    mountains: "#b4a487",
    swamp: "#8a9b78",
    snow: "#dde6f0",
  };

  const BIOME_FILL = {
    forest: "rgba(74,103,65,0.28)",
    mountains: "rgba(122,107,82,0.24)",
    hills: "rgba(154,136,96,0.20)",
    grassland: "rgba(164,196,130,0.24)",
    desert: "rgba(220,196,130,0.30)",
    swamp: "rgba(94,120,80,0.32)",
    coast: "rgba(168,196,212,0.38)",
    snow: "rgba(220,228,240,0.38)",
  };

  const BIOME_STROKE = {
    forest: "rgba(40,80,30,0.55)",
    mountains: "rgba(90,75,50,0.55)",
    hills: "rgba(110,95,65,0.50)",
    grassland: "rgba(80,120,50,0.45)",
    desert: "rgba(160,130,60,0.50)",
    swamp: "rgba(40,80,40,0.55)",
    coast: "rgba(60,110,160,0.55)",
    snow: "rgba(120,150,200,0.50)",
  };

  // Fallback only — the export injects the canonical registry into
  // data.builtinGlyphs (from @uwe/atlas/glyphs); see resolveGlyphs().
  const BUILTIN_GLYPHS = [
    { key: "mountain", pathData: "M12 2 L22 20 L2 20 Z M7 20 L12 10 L17 20", color: "#7a6b52" },
    { key: "mountain_snow", pathData: "M12 2 L22 20 L2 20 Z M9 11 L12 6 L15 11 Z", color: "#a8b8c4" },
    { key: "tree", pathData: "M12 3 L19 17 L5 17 Z M12 17 L12 22 M10 22 L14 22", color: "#4a6741" },
    { key: "city", pathData: "M7 22 L7 12 L9 12 L9 10 L11 10 L11 8 L13 8 L13 10 L15 10 L15 12 L17 12 L17 22 Z M10 22 L10 16 L14 16 L14 22", color: "#1a1008" },
    { key: "village", pathData: "M12 4 L20 11 L20 22 L4 22 L4 11 Z M4 11 L12 4 L20 11 M9 22 L9 15 L15 15 L15 22", color: "#6b4a2a" },
    { key: "ruin", pathData: "M5 22 L5 12 L8 12 L8 8 M8 8 L10 10 M16 8 L16 12 L19 12 L19 22 M10 14 L14 14 L14 22 L10 22 Z", color: "#8b7355" },
    { key: "castle", pathData: "M4 22 L4 14 L6 14 L6 12 L8 12 L8 14 L10 14 L10 12 L14 12 L14 14 L16 14 L16 12 L18 12 L18 14 L20 14 L20 22 Z M10 22 L10 17 L14 17 L14 22", color: "#1a1008" },
    { key: "water", pathData: "M2 12 Q6 8 10 12 Q14 16 18 12 Q20 10 22 12 M2 16 Q6 12 10 16 Q14 20 18 16 Q20 14 22 16", color: "#a8c4d4" },
  ];

  const LEVEL_LABELS = {
    globe: "Globus",
    continent: "Kontinent",
    landscape: "Landschaft",
    city: "Stadt",
  };

  function worldToCanvas(nx, ny, panX, panY, zoom, w, h) {
    return [nx * w * zoom + panX, ny * h * zoom + panY];
  }

  function canvasToWorld(cx, cy, panX, panY, zoom, w, h) {
    return [
      Math.max(0, Math.min(1, (cx - panX) / zoom / w)),
      Math.max(0, Math.min(1, (cy - panY) / zoom / h)),
    ];
  }

  function pointInPolygon(p, ring) {
    const [px, py] = p;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  function distToSegment(p, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  function pathLength(points) {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1][0] - points[i][0];
      const dy = points[i + 1][1] - points[i][1];
      total += Math.hypot(dx, dy);
    }
    return total;
  }

  function pointAtDistance(points, d) {
    if (points.length === 0) return { point: [0, 0], rotation: 0 };
    if (points.length === 1) return { point: points[0], rotation: 0 };
    const total = pathLength(points);
    if (total <= 0) return { point: points[0], rotation: 0 };
    const clamped = Math.max(0, Math.min(d, total));
    let walked = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (walked + len >= clamped) {
        const t = len > 0 ? (clamped - walked) / len : 0;
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        return { point: [x, y], rotation: Math.atan2(b[1] - a[1], b[0] - a[0]) };
      }
      walked += len;
    }
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    return { point: last, rotation: Math.atan2(last[1] - prev[1], last[0] - prev[0]) };
  }

  function layoutCharactersOnPath(text, path, letterSpacing, reverse) {
    const points = reverse ? [...path].reverse() : path;
    const chars = [...text.toUpperCase().replace(/\s+/g, " ")];
    if (chars.length === 0 || points.length < 2) return [];
    const total = pathLength(points);
    const blockWidth = Math.max(letterSpacing, (chars.length - 1) * letterSpacing);
    const start = Math.max(0, (total - blockWidth) / 2);
    return chars.map((char, index) => {
      const { point, rotation } = pointAtDistance(points, start + index * letterSpacing);
      return { char, x: point[0], y: point[1], rotation };
    });
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // Flowing rounded tile blobs — mirrors @uwe/atlas paintTerrainBlobs so the
  // static viewer shows the same terrain layer as the editor runtime.
  function paintTerrainBlobs(ctx, opts) {
    const { cols, rows, getCell, tileRect, fillFor, radiusRatio = 0.4 } = opts;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const biome = getCell(c, r);
        if (!biome) continue;
        const { x, y, w, h } = tileRect(c, r);
        const radius = Math.min(w, h) * radiusRatio;
        ctx.fillStyle = fillFor(biome);
        roundedRectPath(ctx, x, y, w, h, radius);
        ctx.fill();
        const rightSame = getCell(c + 1, r) === biome;
        const bottomSame = getCell(c, r + 1) === biome;
        const diagSame = getCell(c + 1, r + 1) === biome;
        if (rightSame) ctx.fillRect(x + w - radius, y, radius * 2, h);
        if (bottomSame) ctx.fillRect(x, y + h - radius, w, radius * 2);
        if (rightSame && bottomSame && diagSame) {
          ctx.fillRect(x + w - radius, y + h - radius, radius * 2, radius * 2);
        }
      }
    }
  }

  function drawSvgPath(ctx, d) {
    const cmds = d.match(/[MLHVZQCSA][^MLHVZQCSA]*/gi) || [];
    let x = 0;
    let y = 0;
    for (const cmd of cmds) {
      const op = cmd[0].toUpperCase();
      const args = cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
      switch (op) {
        case "M": x = args[0] || 0; y = args[1] || 0; ctx.moveTo(x, y); break;
        case "L": x = args[0] || x; y = args[1] || y; ctx.lineTo(x, y); break;
        case "H": x = args[0] || x; ctx.lineTo(x, y); break;
        case "V": y = args[0] || y; ctx.lineTo(x, y); break;
        case "Z": ctx.closePath(); break;
        case "Q": ctx.quadraticCurveTo(args[0] || x, args[1] || y, args[2] || x, args[3] || y); x = args[2] || x; y = args[3] || y; break;
        case "C": ctx.bezierCurveTo(args[0] || x, args[1] || y, args[2] || x, args[3] || y, args[4] || x, args[5] || y); x = args[4] || x; y = args[5] || y; break;
        default: break;
      }
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  class AtlasStaticViewer {
    constructor(rootEl, data) {
      this.rootEl = rootEl;
      this.data = data;
      this.preset = data.preset;
      this.pageLinks = data.pageLinks || {};
      this.viewport = { panX: 0, panY: 0, zoom: 1 };
      this.panning = false;
      this.panStart = { x: 0, y: 0, vpX: 0, vpY: 0 };
      this.hovered = null;
      this.canvas = null;
      this.ctx = null;
      this.nodeId = data.rootNodeId || (data.nodes[0] && data.nodes[0].id);
      this.paletteItems = data.paletteItems || {};
      // Preload AI/upload image stamps (approved-only, inlined by the export).
      this.stampImages = {};
      for (const [id, item] of Object.entries(this.paletteItems)) {
        if (!item || !item.imageData) continue;
        const img = new Image();
        img.onload = () => this.render();
        img.src = `data:${item.mimeType || "image/png"};base64,${item.imageData}`;
        this.stampImages[id] = img;
      }
      this.buildDom();
      this.bindEvents();
      this.syncFromHash();
      this.resize();
      this.render();
    }

    buildDom() {
      this.rootEl.innerHTML = `
        <div class="atlas-static-shell">
          <header class="atlas-static-header">
            <a class="atlas-static-home" href="../">← Wiki</a>
            <nav class="atlas-static-breadcrumb" data-atlas-breadcrumb></nav>
            <h1 class="atlas-static-title" data-atlas-title></h1>
          </header>
          <div class="atlas-static-toolbar">
            <button type="button" data-atlas-zoom-out title="Verkleinern">−</button>
            <button type="button" data-atlas-zoom-reset title="Zoom zurücksetzen">100%</button>
            <button type="button" data-atlas-zoom-in title="Vergrößern">+</button>
            <span class="atlas-static-hint">Ziehen = Schwenken · Klick = Zoomen / Wiki</span>
          </div>
          <div class="atlas-static-canvas-wrap">
            <canvas data-atlas-canvas aria-label="Atlas-Karte"></canvas>
            <div class="atlas-static-decor" data-atlas-decor></div>
          </div>
          <p class="atlas-static-tooltip" data-atlas-tooltip hidden></p>
        </div>
      `;
      this.canvas = this.rootEl.querySelector("[data-atlas-canvas]");
      this.ctx = this.canvas.getContext("2d");
      this.breadcrumbEl = this.rootEl.querySelector("[data-atlas-breadcrumb]");
      this.titleEl = this.rootEl.querySelector("[data-atlas-title]");
      this.tooltipEl = this.rootEl.querySelector("[data-atlas-tooltip]");
      this.decorEl = this.rootEl.querySelector("[data-atlas-decor]");
    }

    bindEvents() {
      this.rootEl.querySelector("[data-atlas-zoom-in]").addEventListener("click", () => this.zoomBy(1.25));
      this.rootEl.querySelector("[data-atlas-zoom-out]").addEventListener("click", () => this.zoomBy(0.8));
      this.rootEl.querySelector("[data-atlas-zoom-reset]").addEventListener("click", () => {
        this.viewport = { panX: 0, panY: 0, zoom: 1 };
        this.render();
      });

      this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
      this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
      this.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
      this.canvas.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
      window.addEventListener("hashchange", () => this.syncFromHash());
      window.addEventListener("resize", () => this.resize());
    }

    syncFromHash() {
      const match = window.location.hash.match(/^#node=([^&]+)/);
      if (match && this.data.nodes.some((n) => n.id === match[1])) {
        this.nodeId = match[1];
      }
      this.viewport = { panX: 0, panY: 0, zoom: 1 };
      this.updateChrome();
      this.render();
    }

    navigateToNode(nodeId) {
      this.nodeId = nodeId;
      window.location.hash = `node=${nodeId}`;
      this.viewport = { panX: 0, panY: 0, zoom: 1 };
      this.updateChrome();
      this.render();
    }

    getNode() {
      return this.data.nodes.find((n) => n.id === this.nodeId) || null;
    }

    getParentChain() {
      const chain = [];
      let current = this.getNode();
      while (current && current.parentId) {
        const parent = this.data.nodes.find((n) => n.id === current.parentId);
        if (!parent) break;
        chain.unshift(parent);
        current = parent;
      }
      return chain;
    }

    getParentSilhouette() {
      const node = this.getNode();
      if (!node || !node.parentFeatureId) return null;
      const feature = this.data.features.find((f) => f.id === node.parentFeatureId);
      if (!feature || feature.geometry?.type !== "Polygon") return null;
      return feature.geometry.rings || null;
    }

    getNodeFeatures() {
      return this.data.features.filter((f) => f.nodeId === this.nodeId);
    }

    getNodeObjects() {
      return this.data.objects.filter((o) => o.nodeId === this.nodeId);
    }

    updateChrome() {
      const node = this.getNode();
      if (!node) return;
      const chain = this.getParentChain();
      const crumbs = chain
        .map(
          (item) =>
            `<a href="#node=${encodeURIComponent(item.id)}">${escapeHtml(item.title)}</a>`,
        )
        .join('<span class="atlas-static-sep">/</span>');
      this.breadcrumbEl.innerHTML = crumbs
        ? `${crumbs}<span class="atlas-static-sep">/</span><span>${escapeHtml(node.title)}</span>`
        : `<span>${escapeHtml(node.title)}</span>`;
      const levelLabel = LEVEL_LABELS[node.level] || node.level;
      this.titleEl.textContent = `${node.title} · ${levelLabel}`;

      if (this.preset.decorations?.compassRose || this.preset.decorations?.scaleBar) {
        this.decorEl.innerHTML = `
          ${this.preset.decorations.compassRose ? `<div class="atlas-static-compass" aria-hidden="true"><svg viewBox="0 0 80 80" width="72" height="72"><circle cx="40" cy="40" r="36" fill="#f2e8c9" stroke="#1a1008" stroke-width="1.5"/><polygon points="40,8 35,36 40,30 45,36" fill="#1a1008"/><polygon points="40,72 35,44 40,50 45,44" fill="#8b1a10"/><text x="40" y="5" text-anchor="middle" font-size="9" font-family="serif" fill="#1a1008" font-weight="bold">N</text></svg></div>` : ""}
          ${this.preset.decorations.scaleBar ? `<div class="atlas-static-scale"><span>0 — 100 ${escapeHtml(this.preset.decorations.scaleUnit || "km")}</span></div>` : ""}
        `;
      }
    }

    resize() {
      const wrap = this.canvas.parentElement;
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.max(320, rect.width) * dpr;
      this.canvas.height = Math.max(420, rect.height) * dpr;
      this.canvas.style.width = `${Math.max(320, rect.width)}px`;
      this.canvas.style.height = `${Math.max(420, rect.height)}px`;
      this.render();
    }

    zoomBy(factor) {
      this.viewport.zoom = Math.max(0.25, Math.min(8, this.viewport.zoom * factor));
      this.render();
    }

    onWheel(e) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomBy(factor);
    }

    getCanvasPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }

    onPointerDown(e) {
      this.canvas.setPointerCapture(e.pointerId);
      const [cx, cy] = this.getCanvasPos(e);
      this.panning = true;
      this.panStart = { x: cx, y: cy, vpX: this.viewport.panX, vpY: this.viewport.panY };
      this.clickStart = { x: cx, y: cy, t: Date.now() };
    }

    onPointerMove(e) {
      const [cx, cy] = this.getCanvasPos(e);
      if (this.panning) {
        this.viewport.panX = this.panStart.vpX + (cx - this.panStart.x);
        this.viewport.panY = this.panStart.vpY + (cy - this.panStart.y);
        this.render();
        return;
      }
      const [wx, wy] = canvasToWorld(
        cx, cy,
        this.viewport.panX, this.viewport.panY, this.viewport.zoom,
        this.canvas.clientWidth, this.canvas.clientHeight,
      );
      this.hovered = this.hitTest(wx, wy);
      this.render();
    }

    onPointerUp(e) {
      if (!this.panning) return;
      this.panning = false;
      this.canvas.releasePointerCapture(e.pointerId);
      const [cx, cy] = this.getCanvasPos(e);
      const moved = Math.hypot(cx - this.clickStart.x, cy - this.clickStart.y);
      if (moved < 6 && Date.now() - this.clickStart.t < 400) {
        const [wx, wy] = canvasToWorld(
          cx, cy,
          this.viewport.panX, this.viewport.panY, this.viewport.zoom,
          this.canvas.clientWidth, this.canvas.clientHeight,
        );
        this.handleClick(this.hitTest(wx, wy));
      }
    }

    handleClick(hit) {
      if (!hit) return;
      if (hit.childNodeId) {
        this.navigateToNode(hit.childNodeId);
        return;
      }
      if (hit.linkedPageId && this.pageLinks[hit.linkedPageId]) {
        window.location.href = this.pageLinks[hit.linkedPageId];
      }
    }

    hitTest(wx, wy) {
      const features = this.getNodeFeatures();
      const objects = this.getNodeObjects();
      const W = this.canvas.clientWidth;
      const H = this.canvas.clientHeight;
      const thresh = 10 / (this.viewport.zoom * Math.max(W, H));

      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        const dx = o.x - wx;
        const dy = o.y - wy;
        if (Math.hypot(dx, dy) < thresh * 2) {
          return { linkedPageId: o.linkedPageId };
        }
      }

      for (let i = features.length - 1; i >= 0; i--) {
        const f = features[i];
        const geo = f.geometry || {};
        if (geo.type === "Point" || geo.type === "LabelAnchor") {
          const coord = geo.coordinates;
          if (!coord) continue;
          if (Math.hypot(coord[0] - wx, coord[1] - wy) < thresh * 2) {
            return { childNodeId: f.childNodeId, linkedPageId: f.linkedPageId };
          }
        }
      }

      for (let i = features.length - 1; i >= 0; i--) {
        const f = features[i];
        const geo = f.geometry || {};
        if (geo.type === "Polygon") {
          for (const ring of geo.rings || []) {
            if (pointInPolygon([wx, wy], ring)) {
              return { childNodeId: f.childNodeId, linkedPageId: f.linkedPageId };
            }
          }
        } else if (geo.type === "Path") {
          const coords = geo.coordinates || [];
          for (let k = 0; k < coords.length - 1; k++) {
            if (distToSegment([wx, wy], coords[k], coords[k + 1]) < thresh) {
              return { linkedPageId: f.linkedPageId };
            }
          }
        }
      }
      return null;
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const dpr = window.devicePixelRatio || 1;
      const W = this.canvas.clientWidth;
      const H = this.canvas.clientHeight;
      const { panX, panY, zoom } = this.viewport;
      const preset = this.preset;
      const w2c = (nx, ny) => worldToCanvas(nx, ny, panX, panY, zoom, W, H);

      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = preset.colors.parchment;
      ctx.fillRect(0, 0, W, H);

      // Terrain tile layer (flowing blobs) — map-level, rendered on every node
      // view exactly like the single-file editor runtime.
      const tl = this.data.tileLayer;
      if (tl && tl.cells) {
        const cols = tl.cols || 64;
        const rows = tl.rows || 40;
        paintTerrainBlobs(ctx, {
          cols,
          rows,
          getCell: (c, r) => tl.cells[`${c},${r}`],
          tileRect: (c, r) => {
            const [x, y] = w2c(c / cols, r / rows);
            const [x1, y1] = w2c((c + 1) / cols, (r + 1) / rows);
            return { x, y, w: x1 - x, h: y1 - y };
          },
          fillFor: (biome) => TILE_FILL[biome] || "#ccc",
          radiusRatio: 0.4,
        });
      }

      const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3 * zoom, W / 2, H / 2, W * 0.75);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(80,50,20,0.18)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const silhouette = this.getParentSilhouette();
      if (silhouette && silhouette.length) {
        ctx.save();
        ctx.beginPath();
        for (const ring of silhouette) {
          if (!ring.length) continue;
          const [sx, sy] = w2c(ring[0][0], ring[0][1]);
          ctx.moveTo(sx, sy);
          for (let i = 1; i < ring.length; i++) {
            const [px, py] = w2c(ring[i][0], ring[i][1]);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
        }
        ctx.strokeStyle = preset.colors.ink;
        ctx.lineWidth = 2.5 * zoom;
        ctx.globalAlpha = 0.15;
        ctx.setLineDash([8 * zoom, 5 * zoom]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = preset.colors.ink;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      ctx.strokeStyle = preset.colors.ink;
      ctx.lineWidth = 2 * zoom;
      const [bx0, by0] = w2c(0, 0);
      const [bx1, by1] = w2c(1, 1);
      ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);

      const features = [...this.getNodeFeatures()].sort((a, b) => (a.layer || 0) - (b.layer || 0));

      for (const feat of features) {
        const geo = feat.geometry || {};
        ctx.save();

        if (geo.type === "Polygon") {
          const rings = geo.rings || [];
          ctx.beginPath();
          for (const ring of rings) {
            if (!ring.length) continue;
            const [sx, sy] = w2c(ring[0][0], ring[0][1]);
            ctx.moveTo(sx, sy);
            for (let i = 1; i < ring.length; i++) {
              const [px, py] = w2c(ring[i][0], ring[i][1]);
              ctx.lineTo(px, py);
            }
            ctx.closePath();
          }

          if (feat.kind === "biome") {
            const bk = (feat.style && feat.style.biomeKind) || "forest";
            ctx.fillStyle = BIOME_FILL[bk] || BIOME_FILL.forest;
            ctx.fill();
            ctx.strokeStyle = BIOME_STROKE[bk] || BIOME_STROKE.forest;
            ctx.lineWidth = 1.5 * zoom;
            ctx.stroke();
          } else {
            ctx.fillStyle = feat.labelColor === "red" ? "rgba(139,26,16,0.18)" : "rgba(26,16,8,0.12)";
            ctx.fill();
            ctx.strokeStyle = preset.colors.ink;
            ctx.lineWidth = 1.5 * zoom;
            ctx.stroke();
            if (feat.childNodeId && rings[0] && rings[0].length) {
              let cx2 = 0;
              let cy2 = 0;
              for (const [rx, ry] of rings[0]) { cx2 += rx; cy2 += ry; }
              cx2 /= rings[0].length;
              cy2 /= rings[0].length;
              const [bx, by] = w2c(cx2, cy2);
              ctx.beginPath();
              ctx.arc(bx, by, 8 * zoom, 0, Math.PI * 2);
              ctx.fillStyle = "#3b82f6";
              ctx.fill();
              ctx.fillStyle = "#fff";
              ctx.font = `bold ${Math.round(11 * zoom)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("↓", bx, by);
            }
          }
        } else if (geo.type === "Path") {
          const coords = geo.coordinates || [];
          if (coords.length >= 2) {
            if (feat.kind === "vine") {
              // Ranke/Weltenwurzel — kompakte lokale Annäherung an
              // @uwe/atlas vine.ts (dieser Viewer bündelt die Engine nicht;
              // volle Parität inkl. Coil/Tendrils/Wolken ist Backlog).
              const vs = feat.style || {};
              const t0 = vs.taperStart != null ? vs.taperStart : 0.9;
              const t1 = vs.taperEnd != null ? vs.taperEnd : 0.15;
              const hgt = vs.height != null ? vs.height : 0.7;
              const off = 0.05 * hgt;
              const strokeVine = (dx, dy, color, mul) => {
                for (let i = 0; i < coords.length - 1; i++) {
                  const t = coords.length > 2 ? i / (coords.length - 2) : 0;
                  const w = (t0 * (1 - t) + t1 * t) * 9 * zoom * mul;
                  const [sx, sy] = w2c(coords[i][0] + dx, coords[i][1] + dy);
                  const [ex, ey] = w2c(coords[i + 1][0] + dx, coords[i + 1][1] + dy);
                  ctx.beginPath();
                  ctx.moveTo(sx, sy);
                  ctx.lineTo(ex, ey);
                  ctx.strokeStyle = color;
                  ctx.lineWidth = Math.max(0.6, w);
                  ctx.stroke();
                }
              };
              ctx.lineCap = "round";
              strokeVine(off, off, "rgba(26,16,8,0.18)", 0.75);
              strokeVine(0, 0, "#5c4326", 1);
            } else if (feat.kind === "road") {
              ctx.beginPath();
              const [sx, sy] = w2c(coords[0][0], coords[0][1]);
              ctx.moveTo(sx, sy);
              for (let i = 1; i < coords.length; i++) {
                const [px, py] = w2c(coords[i][0], coords[i][1]);
                ctx.lineTo(px, py);
              }
              ctx.strokeStyle = preset.colors.road;
              ctx.lineWidth = 2 * zoom;
              ctx.setLineDash([8 * zoom, 4 * zoom]);
              ctx.stroke();
              ctx.setLineDash([]);
            } else {
              for (let i = 0; i < coords.length - 1; i++) {
                const t = coords.length > 2 ? i / (coords.length - 2) : 0;
                const w = 2.2 * zoom * (1 - t * 0.65) + 0.8 * zoom * (t * 0.65);
                const [sx, sy] = w2c(coords[i][0], coords[i][1]);
                const [ex, ey] = w2c(coords[i + 1][0], coords[i + 1][1]);
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
                ctx.strokeStyle = preset.colors.inkAccent;
                ctx.lineWidth = w;
                ctx.stroke();
              }
            }
          }
        } else if (geo.type === "Point" || geo.type === "LabelAnchor") {
          const coord = geo.coordinates;
          if (!coord) { ctx.restore(); continue; }
          const [px, py] = w2c(coord[0], coord[1]);
          const labelText = feat.labelText || geo.text || "Label";
          const inkColor = feat.labelColor === "red" ? preset.colors.inkAccent : preset.colors.ink;

          if (geo.type === "LabelAnchor" && geo.pathCoordinates && geo.pathCoordinates.length >= 2) {
            ctx.font = `bold ${Math.round(13 * zoom)}px ${preset.typography.labelRegion}`;
            ctx.fillStyle = inkColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            // Constant spacing in world units — font and spacing both scale
            // with zoom, keeping the label compact at every zoom level.
            const placements = layoutCharactersOnPath(
              labelText,
              geo.pathCoordinates,
              0.0085,
              geo.pathReversed === true,
            );
            for (const placement of placements) {
              const [cx, cy] = w2c(placement.x, placement.y);
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(placement.rotation);
              ctx.fillText(placement.char, 0, 0);
              ctx.restore();
            }
          } else if (geo.type === "LabelAnchor" || feat.kind === "label") {
            ctx.font = `${Math.round(14 * zoom)}px ${preset.typography.labelCity}`;
            ctx.fillStyle = inkColor;
            ctx.textAlign = "center";
            ctx.fillText(labelText, px, py);
          } else {
            ctx.beginPath();
            ctx.arc(px, py, 5 * zoom, 0, Math.PI * 2);
            ctx.fillStyle = preset.colors.inkAccent;
            ctx.fill();
          }
        }
        ctx.restore();
      }

      const glyphs =
        this.data.builtinGlyphs && this.data.builtinGlyphs.length
          ? this.data.builtinGlyphs
          : BUILTIN_GLYPHS;
      for (const obj of this.getNodeObjects()) {
        // Resolve via the exported palette map (DB ids → builtin glyph key or
        // inline image stamp); fall back to a direct key match for hand-made
        // data.json fixtures.
        const paletteItem = this.paletteItems[obj.paletteItemId];
        const [ox, oy] = w2c(obj.x, obj.y);
        const size = 24 * zoom * obj.scale;

        const stampImage = paletteItem && paletteItem.imageData ? this.stampImages[obj.paletteItemId] : null;
        if (stampImage && stampImage.complete && stampImage.naturalWidth > 0) {
          ctx.save();
          ctx.translate(ox, oy);
          ctx.rotate((obj.rotation * Math.PI) / 180);
          ctx.drawImage(stampImage, -size / 2, -size / 2, size, size);
          ctx.restore();
          continue;
        }

        const glyphKey = paletteItem ? paletteItem.builtinGlyphKey : obj.paletteItemId;
        const glyph = glyphs.find((g) => g.key === glyphKey);
        if (!glyph) continue;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate((obj.rotation * Math.PI) / 180);
        const scale = size / 24;
        ctx.scale(scale, scale);
        ctx.translate(-12, -12);
        ctx.strokeStyle = glyph.color || preset.colors.ink;
        ctx.lineWidth = 1.5 / scale;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        drawSvgPath(ctx, glyph.pathData);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  function init() {
    const mount = document.querySelector("[data-atlas-viewer]");
    if (!mount) return;
    fetch("data.json")
      .then((r) => {
        if (!r.ok) throw new Error("Atlas data not found");
        return r.json();
      })
      .then((data) => {
        if (!data.nodes || data.nodes.length === 0) {
          mount.innerHTML = "<p class=\"atlas-static-empty\">Keine Atlas-Daten verfügbar.</p>";
          return;
        }
        new AtlasStaticViewer(mount, data);
      })
      .catch(() => {
        mount.innerHTML = "<p class=\"atlas-static-empty\">Atlas konnte nicht geladen werden.</p>";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
