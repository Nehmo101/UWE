/**
 * @uwe/atlas — portierte Engine als Reintext-ES-Modul (Migrations-Meilenstein M0).
 *
 * Framework-agnostisch: kein DOM (außer Canvas2D-Context-Parametern), kein React,
 * kein Prisma. Eine Quelle für Editor (Atlas.dc.html, editor-Modus) und Portal
 * (Atlas.dc.html, view-Modus) — beide importieren dieselbe Datei, keine Kopien.
 *
 * Entspricht inhaltlich: packages/atlas/src/{glyphs,geometry,path-smoothing,
 * path-attachments,label-layout,terrain,export-grid,procedural,stamp-variation,
 * serialization,style-presets}.ts — hier zu einer Datei konsolidiert, weil die
 * Ziel-Architektur "eine Datei" lautet.
 */

// ===========================================================================
// Style-Presets (style-presets.ts)
// ===========================================================================

export const TOLKIEN_INK = {
  id: "tolkien-ink",
  label: "Tolkien Ink",
  colors: {
    parchment: "#f2e8c9", ink: "#1a1008", inkAccent: "#8b1a10",
    water: "#a8c4d4", land: "#e8ddb5", forest: "#4a6741", mountain: "#7a6b52", road: "#6b4a2a",
  },
  typography: {
    labelRegion: "Newsreader, Georgia, serif",
    labelCity: "Newsreader, Georgia, serif",
    baseSizePx: 14,
  },
  decorations: { compassRose: true, scaleBar: true, scaleUnit: "leagues", lineWeightScale: 1 },
};

export const STYLE_PRESETS = { [TOLKIEN_INK.id]: TOLKIEN_INK };

export function resolveStylePreset(id) {
  return (id && STYLE_PRESETS[id]) || TOLKIEN_INK;
}

// ===========================================================================
// Glyphen-Registry (glyphs.ts) — inkl. CoK-Erweiterung (Fels/Zelt/Stand/Mauer/Tor)
// ===========================================================================

export const ATLAS_GLYPH_CATEGORIES = [
  { key: "relief", label: "Relief", description: "Höhen & Landformen." },
  { key: "biome", label: "Biom", description: "Vegetation & Gewässer." },
  { key: "pin", label: "Marker", description: "Orte & Bauwerke." },
];

export const BUILTIN_GLYPHS = [
  { key: "mountain", name: "Berg", kind: "relief", pathData: "M12 2 L22 20 L2 20 Z M7 20 L12 10 L17 20", color: "#7a6b52" },
  { key: "rock", name: "Fels", kind: "relief", pathData: "M4 20 Q5 12 11 12 Q13 9 16 12 Q20 13 20 20 Z M9 16 L11 13 M14 18 L16 14", color: "#7a6a52" },
  { key: "tree", name: "Wald", kind: "biome", pathData: "M12 3 L19 17 L5 17 Z M12 17 L12 22 M10 22 L14 22", color: "#4a6741" },
  { key: "pine", name: "Nadelwald", kind: "biome", pathData: "M12 2 L9 8 L11 8 L8 13 L10.5 13 L7 18 L17 18 L13.5 13 L16 13 L13 8 L15 8 Z M12 18 L12 22", color: "#3f5d39" },
  { key: "tent", name: "Zelt", kind: "pin", pathData: "M12 4 L21 20 L3 20 Z M12 4 L12 20 M9 20 L12 15 L15 20", color: "#8a5a3a" },
  { key: "stall", name: "Marktstand", kind: "pin", pathData: "M4 10 L6 5 L18 5 L20 10 Z M5 10 L5 20 M19 10 L19 20 M5 20 L19 20 M4 10 L20 10 M9 20 L9 14 L15 14 L15 20", color: "#6b4a2a" },
  { key: "wall", name: "Stadtmauer", kind: "pin", pathData: "M3 20 L3 12 L6 12 L6 10 L9 10 L9 12 L12 12 L12 10 L15 10 L15 12 L18 12 L18 10 L21 10 L21 20 Z M3 16 L21 16", color: "#5a5044" },
  { key: "gate", name: "Tor", kind: "pin", pathData: "M5 20 L5 10 Q5 5 12 5 Q19 5 19 10 L19 20 M9 20 L9 12 Q9 9 12 9 Q15 9 15 12 L15 20 M4 10 L20 10", color: "#4a4038" },
  { key: "tower", name: "Turm", kind: "pin", pathData: "M9 22 L9 7 L15 7 L15 22 M9 7 L9 4 L10.5 4 L10.5 5.5 L13.5 5.5 L13.5 4 L15 4 L15 7 M9 22 L15 22 M9 13 L15 13", color: "#2a1d10" },
  { key: "castle", name: "Burg", kind: "pin", pathData: "M4 22 L4 14 L6 14 L6 12 L8 12 L8 14 L10 14 L10 12 L14 12 L14 14 L16 14 L16 12 L18 12 L18 14 L20 14 L20 22 Z M10 22 L10 17 L14 17 L14 22", color: "#1a1008" },
  { key: "city", name: "Stadt", kind: "pin", pathData: "M7 22 L7 12 L9 12 L9 10 L11 10 L11 8 L13 8 L13 10 L15 10 L15 12 L17 12 L17 22 Z M10 22 L10 16 L14 16 L14 22", color: "#1a1008" },
  { key: "village", name: "Dorf", kind: "pin", pathData: "M12 4 L20 11 L20 22 L4 22 L4 11 Z M4 11 L12 4 L20 11 M9 22 L9 15 L15 15 L15 22", color: "#6b4a2a" },
  { key: "ruin", name: "Ruine", kind: "pin", pathData: "M5 22 L5 12 L8 12 L8 8 M8 8 L10 10 M16 8 L16 12 L19 12 L19 22 M10 14 L14 14 L14 22 L10 22 Z", color: "#8b7355" },
  { key: "bridge", name: "Brücke", kind: "pin", pathData: "M2 16 Q12 6 22 16 M3 16 L3 19 M21 16 L21 19 M3 19 L21 19", color: "#6b4a2a" },
  { key: "harbor", name: "Hafen", kind: "pin", pathData: "M12 3 Q14 3 14 5 Q14 7 12 7 Q10 7 10 5 Q10 3 12 3 M12 7 L12 20 M8 10 L16 10 M12 20 Q5 20 5 13 M12 20 Q19 20 19 13", color: "#1a3a4a" },
  { key: "temple", name: "Tempel", kind: "pin", pathData: "M3 9 L12 4 L21 9 Z M4 11 L20 11 M5 11 L5 18 M9 11 L9 18 M15 11 L15 18 M19 11 L19 18 M4 18 L20 18", color: "#2a1d10" },
];

const GLYPHS_BY_KEY = new Map(BUILTIN_GLYPHS.map((g) => [g.key, g]));
export function getGlyphByKey(key) { return key ? GLYPHS_BY_KEY.get(key) : undefined; }
export function listGlyphsByCategory(cat) { return BUILTIN_GLYPHS.filter((g) => g.kind === cat); }

/** Terrain-Biom -> bevorzugter Streu-Glyph (terrain.js scatterGlyphsInPolygon). */
export const BIOME_SCATTER_GLYPH = {
  forest: "tree", mountains: "mountain", hills: "rock", swamp: "tree",
  desert: "rock", grassland: "tree", coast: null, snow: "mountain",
};

// ===========================================================================
// Geometrie (geometry.ts)
// ===========================================================================

export function worldToCanvas(nx, ny, panX, panY, zoom, w, h) {
  return [nx * w * zoom + panX, ny * h * zoom + panY];
}
export function canvasToWorld(cx, cy, panX, panY, zoom, w, h) {
  return [Math.max(0, Math.min(1, (cx - panX) / zoom / w)), Math.max(0, Math.min(1, (cy - panY) / zoom / h))];
}
export function pointInPolygon(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
export function centroid(ring) {
  if (!ring || !ring.length) return [0.5, 0.5];
  let x = 0, y = 0;
  for (const [a, b] of ring) { x += a; y += b; }
  return [x / ring.length, y / ring.length];
}
export function translateGeometry(geo, dx, dy) {
  if (geo.type === "Point" || geo.type === "LabelAnchor") {
    const c = geo.coordinates; const g = { ...geo, coordinates: [c[0] + dx, c[1] + dy] };
    if (geo.pathCoordinates) g.pathCoordinates = geo.pathCoordinates.map(([a, b]) => [a + dx, b + dy]);
    return g;
  }
  if (geo.type === "Path") return { ...geo, coordinates: geo.coordinates.map(([a, b]) => [a + dx, b + dy]) };
  if (geo.type === "Polygon") return { ...geo, rings: (geo.rings || []).map((r) => r.map(([a, b]) => [a + dx, b + dy])) };
  return geo;
}

// ===========================================================================
// SVG-Pfad-Zeichner für Glyphen (minimaler Canvas2D-Parser: M L H V Z Q C)
// ===========================================================================

export function drawSvgPath(ctx, d) {
  const cmds = d.match(/[MLHVZQC][^MLHVZQC]*/gi) || [];
  let x = 0, y = 0;
  for (const cmd of cmds) {
    const op = cmd[0].toUpperCase();
    const a = cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    switch (op) {
      case "M": x = a[0]; y = a[1]; ctx.moveTo(x, y); break;
      case "L": x = a[0]; y = a[1]; ctx.lineTo(x, y); break;
      case "H": x = a[0]; ctx.lineTo(x, y); break;
      case "V": y = a[0]; ctx.lineTo(x, y); break;
      case "Z": ctx.closePath(); break;
      case "Q": ctx.quadraticCurveTo(a[0], a[1], a[2], a[3]); x = a[2]; y = a[3]; break;
      case "C": ctx.bezierCurveTo(a[0], a[1], a[2], a[3], a[4], a[5]); x = a[4]; y = a[5]; break;
      default: break;
    }
  }
}

// ===========================================================================
// Pfad-Glättung (path-smoothing.ts) — Catmull-Rom -> Polylinie
// ===========================================================================

export function smoothPath(points, opts) {
  const segments = (opts && opts.segments) || 12;
  if (points.length < 3) return points;
  const out = [];
  const p = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    for (let s = 0; s < segments; s++) {
      const u = s / segments, u2 = u * u, u3 = u2 * u;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
      out.push([x, y]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function pathLength(points) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  return total;
}

export function pointAtDistance(points, d) {
  if (points.length === 0) return { point: [0, 0], rotation: 0 };
  if (points.length === 1) return { point: points[0], rotation: 0 };
  const total = pathLength(points);
  if (total <= 0) return { point: points[0], rotation: 0 };
  const clamped = Math.max(0, Math.min(d, total));
  let walked = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (walked + len >= clamped) {
      const t = len > 0 ? (clamped - walked) / len : 0;
      return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], rotation: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    walked += len;
  }
  const last = points[points.length - 1], prev = points[points.length - 2];
  return { point: last, rotation: Math.atan2(last[1] - prev[1], last[0] - prev[0]) };
}

// ===========================================================================
// Label-Layout (label-layout.ts) — Zeichen entlang eines Pfades
// ===========================================================================

export function layoutCharactersOnPath(text, path, letterSpacing, reverse) {
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

// ===========================================================================
// Deterministischer PRNG (mulberry32) — Grundlage für Seed-Reproduzierbarkeit
// ===========================================================================

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

// ===========================================================================
// Terrain-Streuung (terrain.js) — Glyphen im Polygon deterministisch verteilen
// ===========================================================================

export function scatterGlyphsInPolygon(rings, biomeKind, density, seed) {
  const ring = rings[0];
  if (!ring || ring.length < 3) return [];
  const glyphKey = BIOME_SCATTER_GLYPH[biomeKind];
  if (!glyphKey) return [];
  const rand = mulberry32(typeof seed === "number" ? seed : hashString(seed));
  let minx = 1, miny = 1, maxx = 0, maxy = 0;
  for (const [a, b] of ring) { minx = Math.min(minx, a); maxx = Math.max(maxx, a); miny = Math.min(miny, b); maxy = Math.max(maxy, b); }
  const n = Math.floor((maxx - minx) * (maxy - miny) * 220 * density);
  const out = [];
  for (let i = 0; i < n; i++) {
    const nx = minx + rand() * (maxx - minx), ny = miny + rand() * (maxy - miny);
    if (!pointInPolygon([nx, ny], ring)) continue;
    out.push({ x: nx, y: ny, scale: 0.7 + rand() * 0.5, rotation: rand() * 360, glyphKey });
  }
  return out;
}

// ===========================================================================
// Pfad-Säume (path-attachments.ts) — Objekte entlang eines Flusses/Weges
// ===========================================================================

export function generatePathAttachments(coords, opts) {
  const { kind = "trees", spacing = 0.06, side = "both", offset = 0.025, seed = 1 } = opts || {};
  const rand = mulberry32(seed);
  const glyphKey = kind === "trees" ? "tree" : kind === "rocks" ? "rock" : "tree";
  const total = pathLength(coords);
  const out = [];
  for (let d = 0; d < total; d += spacing * (0.85 + rand() * 0.3)) {
    const { point, rotation } = pointAtDistance(coords, d);
    const nrm = rotation + Math.PI / 2;
    const sides = side === "both" ? [-1, 1] : side === "left" ? [-1] : [1];
    for (const s of sides) {
      if (side === "both" && rand() < 0.35) continue; // Lücken, wirkt organischer
      out.push({
        x: point[0] + Math.cos(nrm) * offset * s,
        y: point[1] + Math.sin(nrm) * offset * s,
        scale: 0.7 + rand() * 0.5, rotation: rand() * 360, glyphKey,
      });
    }
  }
  return out;
}

// ===========================================================================
// Export-Gitter (export-grid.ts) — Quadrat/Hex-Linien für PNG-Export-Overlay
// ===========================================================================

export function buildGridLines(rect, opts) {
  const { kind = "square", cellSize = 40 } = opts || {};
  const lines = [];
  if (kind === "square") {
    for (let x = rect.x; x <= rect.x + rect.width; x += cellSize) lines.push({ x1: x, y1: rect.y, x2: x, y2: rect.y + rect.height });
    for (let y = rect.y; y <= rect.y + rect.height; y += cellSize) lines.push({ x1: rect.x, y1: y, x2: rect.x + rect.width, y2: y });
  } else if (kind === "hex") {
    const w = cellSize * Math.sqrt(3), h = cellSize * 1.5;
    for (let row = 0; row * h <= rect.height + h; row++) {
      for (let col = 0; col * w <= rect.width + w; col++) {
        const cx = rect.x + col * w + (row % 2) * (w / 2), cy = rect.y + row * h;
        for (let i = 0; i < 6; i++) {
          const a1 = (Math.PI / 180) * (60 * i - 30), a2 = (Math.PI / 180) * (60 * (i + 1) - 30);
          lines.push({ x1: cx + cellSize * Math.cos(a1), y1: cy + cellSize * Math.sin(a1), x2: cx + cellSize * Math.cos(a2), y2: cy + cellSize * Math.sin(a2) });
        }
      }
    }
  }
  return lines;
}

// ===========================================================================
// Stempel-Variation (stamp-variation.ts)
// ===========================================================================

export function randomStampVariation(seed, opts) {
  const { scaleMin = 0.7, scaleMax = 1.4, rotateMin = -180, rotateMax = 180 } = opts || {};
  const rand = mulberry32(seed >>> 0);
  return { scale: scaleMin + rand() * (scaleMax - scaleMin), rotation: rotateMin + rand() * (rotateMax - rotateMin) };
}

// ===========================================================================
// Prozeduraler Entwurf (procedural.ts) — deterministisch per Seed
// (vereinfachte Regressions-/Demo-Fassung: ein Biom-Blob + ein Fluss)
// ===========================================================================

export function proceduralDraft(seed) {
  const rand = mulberry32(typeof seed === "number" ? seed : hashString(seed));
  const cx = 0.3 + rand() * 0.4, cy = 0.3 + rand() * 0.4, r = 0.12 + rand() * 0.1;
  const ring = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, jitter = 0.7 + rand() * 0.6;
    ring.push([cx + Math.cos(a) * r * jitter, cy + Math.sin(a) * r * jitter]);
  }
  const biomes = ["forest", "hills", "grassland", "swamp"];
  const biomeKind = biomes[Math.floor(rand() * biomes.length)];
  const river = [[rand() * 0.3, 0.05], [cx, cy], [rand() * 0.3 + 0.6, 0.95]];
  return {
    seed,
    features: [
      { kind: "biome", geometry: { type: "Polygon", rings: [ring] }, style: { biomeKind, density: 1 + rand() } },
      { kind: "river", geometry: { type: "Path", coordinates: river }, style: { smooth: true } },
    ],
  };
}

// ===========================================================================
// Serialisierung & Migration (serialization.ts)
// ===========================================================================

export const SCHEMA_VERSION = 2;

/** v1 (kein schemaVersion, Bestand heute) -> v2 (+ additiver tileLayer). Robust. */
export function migrateDoc(doc) {
  if (!doc || typeof doc !== "object") throw new Error("Atlas-Doc ist leer oder ungültig.");
  const d = { ...doc };
  if (!d.schemaVersion) d.schemaVersion = SCHEMA_VERSION;
  d.nodes = d.nodes || [];
  d.features = d.features || [];
  d.objects = d.objects || [];
  d.pageLinks = d.pageLinks || {};
  d.tileLayer = d.tileLayer || { cols: 64, rows: 40, tile: 32, cells: {} };
  d.tileLayer.cells = d.tileLayer.cells || {};
  return d;
}

export function serializeDoc(doc, extra) {
  const clean = (arr) => arr.map(({ _key, ...rest }) => rest);
  return {
    schemaVersion: SCHEMA_VERSION, worldSlug: doc.worldSlug, map: doc.map,
    rootNodeId: doc.rootNodeId, pageLinks: doc.pageLinks, nodes: doc.nodes,
    features: clean(doc.features), objects: clean(doc.objects), tileLayer: doc.tileLayer,
    ...(extra || {}),
  };
}

// ===========================================================================
// Terrain-Blob-Renderer (neu, M1) — fließende, abgerundete Tile-Verschmelzung
// im Stil von Canvas of Kings, statt harter Tile-Quadrate.
//
// Prinzip (klassisches "Blob-Tile"-Verfahren): jedes Tile wird als abgerundetes
// Rechteck gezeichnet. Teilt ein Nachbar-Tile dasselbe Biom, wird die Lücke
// zwischen den beiden Rundungen mit einem schmalen Brücken-Rechteck geschlossen
// (rechts + unten reicht: jede innere Kante/Ecke wird dadurch von genau einem
// der beiden/vier beteiligten Tiles einmal "gebrückt"). So verschmelzen
// gleichfarbige Tiles zu einer organischen Fläche, während echte Biom-Grenzen
// automatisch rund bleiben.
// ===========================================================================

/** Manueller Rounded-Rect-Pfad (kompatibler als ctx.roundRect in älteren Browsern). */
export function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Zeichnet den kompletten Tile-Layer mit fließenden Kanten.
 * @param ctx Canvas2D-Context (bereits transformiert/skaliert)
 * @param opts.cols/rows Tile-Grid-Größe
 * @param opts.getCell (c,r) => biomeKind|undefined
 * @param opts.tileRect (c,r) => {x,y,w,h} in Canvas-CSS-px
 * @param opts.fillFor  biomeKind => CSS-Farbe
 * @param opts.radiusRatio 0..0.5 — Rundungsradius relativ zur Tile-Kante (Default 0.4)
 */
export function paintTerrainBlobs(ctx, opts) {
  const { cols, rows, getCell, tileRect, fillFor, radiusRatio = 0.4 } = opts;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const biome = getCell(c, r);
      if (!biome) continue;
      const { x, y, w, h } = tileRect(c, r);
      const radius = Math.min(w, h) * radiusRatio;
      const color = fillFor(biome);
      ctx.fillStyle = color;

      roundedRectPath(ctx, x, y, w, h, radius);
      ctx.fill();

      const rightSame = getCell(c + 1, r) === biome;
      const bottomSame = getCell(c, r + 1) === biome;
      const diagSame = getCell(c + 1, r + 1) === biome;

      if (rightSame) { ctx.fillRect(x + w - radius, y, radius * 2, h); }
      if (bottomSame) { ctx.fillRect(x, y + h - radius, w, radius * 2); }
      // Innere Ecke nur schließen, wenn alle drei Nachbarn (rechts/unten/diagonal)
      // zum selben Biom gehören — sonst bleibt die konkave Rundung sichtbar,
      // was gerade den "fließenden" statt eckigen Übergang zwischen Biomen erzeugt.
      if (rightSame && bottomSame && diagSame) { ctx.fillRect(x + w - radius, y + h - radius, radius * 2, radius * 2); }
    }
  }
}
