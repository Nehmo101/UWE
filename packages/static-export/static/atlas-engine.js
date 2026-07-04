/* AUTO-GENERATED from @uwe/atlas — do not edit by hand.
   Regenerate: pnpm --filter @uwe/static-export build:atlas-engine */

// ../atlas/src/geometry.ts
function worldToCanvas(nx, ny, panX, panY, zoom, w, h) {
  return [nx * w * zoom + panX, ny * h * zoom + panY];
}
function canvasToWorld(cx, cy, panX, panY, zoom, w, h) {
  return [
    Math.max(0, Math.min(1, (cx - panX) / zoom / w)),
    Math.max(0, Math.min(1, (cy - panY) / zoom / h))
  ];
}
function pointInPolygon(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) {
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
function centroid(ring) {
  if (!ring || !ring.length) return [0.5, 0.5];
  let x = 0;
  let y = 0;
  for (const [a, b] of ring) {
    x += a;
    y += b;
  }
  return [x / ring.length, y / ring.length];
}
function translateGeometry(geo, dx, dy) {
  const shift = ([a, b]) => [a + dx, b + dy];
  if (geo.type === "Point") {
    return { ...geo, coordinates: shift(geo.coordinates) };
  }
  if (geo.type === "LabelAnchor") {
    const moved = { ...geo, coordinates: shift(geo.coordinates) };
    if (geo.pathCoordinates) moved.pathCoordinates = geo.pathCoordinates.map(shift);
    return moved;
  }
  if (geo.type === "Path") {
    return { ...geo, coordinates: geo.coordinates.map(shift) };
  }
  return { ...geo, rings: geo.rings.map((r) => r.map(shift)) };
}

// ../atlas/src/prng.ts
function mulberry32(seed) {
  let a = seed | 0;
  return function rand() {
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStringToSeed(value) {
  let h = 0;
  for (const ch of String(value)) {
    h = h * 31 + ch.charCodeAt(0) >>> 0;
  }
  return h;
}

// ../atlas/src/constants.ts
var AtlasNodeLevel = {
  globe: "globe",
  continent: "continent",
  landscape: "landscape",
  city: "city"
};
var AtlasFeatureKind = {
  region: "region",
  river: "river",
  road: "road",
  biome: "biome",
  relief: "relief",
  label: "label",
  pin: "pin",
  vine: "vine"
};
var AtlasLabelColor = {
  black: "black",
  red: "red"
};
var AtlasPaletteSource = {
  builtin: "builtin",
  ai: "ai",
  upload: "upload"
};
var AtlasPaletteReviewStatus = {
  pending: "pending",
  approved: "approved"
};
var BiomeKind = {
  forest: "forest",
  mountains: "mountains",
  hills: "hills",
  grassland: "grassland",
  desert: "desert",
  swamp: "swamp",
  coast: "coast",
  snow: "snow"
};
var LAYER_Z = {
  background: 0,
  biome: 10,
  relief: 20,
  rivers: 30,
  roads: 40,
  objects: 50,
  labels: 60,
  overlay: 70
};

// ../atlas/src/style-presets.ts
var TOLKIEN_INK = {
  id: "tolkien-ink",
  label: "Tolkien Ink",
  description: "Aged parchment with black and red calligraphic ink — classic fantasy hand-drawn cartography.",
  colors: {
    parchment: "#f2e8c9",
    ink: "#1a1008",
    inkAccent: "#8b1a10",
    water: "#a8c4d4",
    land: "#e8ddb5",
    forest: "#4a6741",
    mountain: "#7a6b52",
    road: "#6b4a2a"
  },
  typography: {
    labelRegion: "Uncial Antiqua, Cinzel Decorative, serif",
    labelCity: "MedievalSharp, IM Fell English, serif",
    title: "Uncial Antiqua, Cinzel Decorative, serif",
    baseSizePx: 14
  },
  decorations: {
    compassRose: true,
    compassOffsetDeg: 0,
    scaleBar: true,
    scaleUnit: "leagues",
    lineWeightScale: 1
  }
};
var STYLE_PRESETS = {
  [TOLKIEN_INK.id]: TOLKIEN_INK
};
function resolveStylePreset(id) {
  if (id && id in STYLE_PRESETS) {
    return STYLE_PRESETS[id];
  }
  return TOLKIEN_INK;
}

// ../atlas/src/glyphs.ts
var ATLAS_GLYPH_CATEGORIES = [
  {
    key: "relief",
    label: "Relief",
    description: "Höhen & Landformen — Berge, Hügel, Vulkane, Klippen."
  },
  {
    key: "biome",
    label: "Biom",
    description: "Vegetation & Gewässer — Wälder, Grasland, Sümpfe, Wüsten, Seen."
  },
  {
    key: "pin",
    label: "Marker",
    description: "Orte & Bauwerke — Städte, Burgen, Türme, Brücken, Tempel."
  }
];
var BUILTIN_GLYPHS = [
  // --- Relief — Höhen & Landformen -----------------------------------------
  {
    key: "mountain",
    name: "Berg",
    kind: "relief",
    pathData: "M12 2 L22 20 L2 20 Z M7 20 L12 10 L17 20",
    color: "#7a6b52"
  },
  {
    key: "mountain_snow",
    name: "Schneeberg",
    kind: "relief",
    pathData: "M12 2 L22 20 L2 20 Z M9 11 L12 6 L15 11 Z",
    color: "#a8b8c4"
  },
  {
    key: "hill",
    name: "Hügel",
    kind: "relief",
    pathData: "M2 19 Q7 10 12 19 M10 19 Q15 11 20 19",
    color: "#8a7a5c"
  },
  {
    key: "volcano",
    name: "Vulkan",
    kind: "relief",
    pathData: "M4 21 L9 8 L15 8 L20 21 M9 8 Q12 10 15 8 M11 8 Q9 4 12 2 Q15 4 13 8",
    color: "#8a5a4a"
  },
  {
    key: "mountain_range",
    name: "Gebirgskette",
    kind: "relief",
    pathData: "M1 21 L6 11 L10 17 L14 8 L18 16 L23 21 Z M6 11 L4 16 M14 8 L12 14",
    color: "#6e6048"
  },
  {
    key: "cliff",
    name: "Klippe",
    kind: "relief",
    pathData: "M3 21 L3 10 L13 10 L13 6 L21 6 L21 21 M3 14 L13 14 M13 12 L21 12",
    color: "#7a6a52"
  },
  {
    key: "rock",
    name: "Fels",
    kind: "relief",
    pathData: "M4 20 Q5 12 11 12 Q13 9 16 12 Q20 13 20 20 Z M9 16 L11 13 M14 18 L16 14",
    color: "#7a6a52"
  },
  {
    key: "cloud",
    name: "Wolke",
    kind: "relief",
    pathData: "M5 16 Q2 16 2 13 Q2 10 5 10 Q6 6 10 6 Q14 6 15 9 Q19 8 20 12 Q21 16 17 16 Z",
    color: "#a8b8c4"
  },
  // --- Biome — Vegetation & Gewässer ---------------------------------------
  {
    key: "tree",
    name: "Wald",
    kind: "biome",
    pathData: "M12 3 L19 17 L5 17 Z M12 17 L12 22 M10 22 L14 22",
    color: "#4a6741"
  },
  {
    key: "water",
    name: "See/Meer",
    kind: "biome",
    pathData: "M2 12 Q6 8 10 12 Q14 16 18 12 Q20 10 22 12 M2 16 Q6 12 10 16 Q14 20 18 16 Q20 14 22 16",
    color: "#a8c4d4"
  },
  {
    key: "pine",
    name: "Nadelwald",
    kind: "biome",
    pathData: "M12 2 L9 8 L11 8 L8 13 L10.5 13 L7 18 L17 18 L13.5 13 L16 13 L13 8 L15 8 Z M12 18 L12 22",
    color: "#3f5d39"
  },
  {
    key: "grass",
    name: "Grasland",
    kind: "biome",
    pathData: "M3 20 L21 20 M5 20 Q3 14 5 10 M9 20 Q7 14 9 10 M12 20 Q11 13 13 10 M16 20 Q14 14 16 10 M19 20 Q18 14 20 11",
    color: "#6f8a3a"
  },
  {
    key: "swamp",
    name: "Sumpf",
    kind: "biome",
    pathData: "M2 17 Q6 15 10 17 Q14 19 18 17 Q20 16 22 17 M2 20 Q6 18 10 20 Q14 22 18 20 Q20 19 22 20 M8 17 L8 10 M8 12 L6 10 M8 12 L10 10 M15 18 L15 11",
    color: "#5e7850"
  },
  {
    key: "desert",
    name: "Wüste",
    kind: "biome",
    pathData: "M2 18 Q8 12 13 17 Q18 22 22 17 M2 21 Q5 19 9 20 M16 6 Q18.5 6 18.5 8.5 Q18.5 11 16 11 Q13.5 11 13.5 8.5 Q13.5 6 16 6",
    color: "#c8a85a"
  },
  // --- Biome — Mythische Vegetation (Vine-Feature) --------------------------
  {
    key: "beanstalk",
    name: "Bohnenranke",
    kind: "biome",
    pathData: "M12 21 C8 17 16 13 12 9 C9 6 14 4 12 2 M12 13 Q15 12 16 14 Q14 16 12 13 M12 17 Q9 16 8 18 Q10 20 12 17",
    color: "#4a6741"
  },
  {
    key: "giant_root",
    name: "Weltenwurzel",
    kind: "biome",
    pathData: "M12 3 L12 10 M12 10 C9 12 8 16 6 21 M12 10 C15 12 16 16 18 21 M12 10 C11 14 13 17 12 21 M6 21 L4 19 M18 21 L20 19",
    color: "#6b4a2a"
  },
  // --- Pin — Orte & Bauwerke -----------------------------------------------
  {
    key: "city",
    name: "Stadt",
    kind: "pin",
    pathData: "M7 22 L7 12 L9 12 L9 10 L11 10 L11 8 L13 8 L13 10 L15 10 L15 12 L17 12 L17 22 Z M10 22 L10 16 L14 16 L14 22",
    color: "#1a1008"
  },
  {
    key: "village",
    name: "Dorf",
    kind: "pin",
    pathData: "M12 4 L20 11 L20 22 L4 22 L4 11 Z M4 11 L12 4 L20 11 M9 22 L9 15 L15 15 L15 22",
    color: "#6b4a2a"
  },
  {
    key: "ruin",
    name: "Ruine",
    kind: "pin",
    pathData: "M5 22 L5 12 L8 12 L8 8 M8 8 L10 10 M16 8 L16 12 L19 12 L19 22 M10 14 L14 14 L14 22 L10 22 Z",
    color: "#8b7355"
  },
  {
    key: "castle",
    name: "Burg",
    kind: "pin",
    pathData: "M4 22 L4 14 L6 14 L6 12 L8 12 L8 14 L10 14 L10 12 L14 12 L14 14 L16 14 L16 12 L18 12 L18 14 L20 14 L20 22 Z M10 22 L10 17 L14 17 L14 22",
    color: "#1a1008"
  },
  {
    key: "tower",
    name: "Turm",
    kind: "pin",
    pathData: "M9 22 L9 7 L15 7 L15 22 M9 7 L9 4 L10.5 4 L10.5 5.5 L13.5 5.5 L13.5 4 L15 4 L15 7 M9 22 L15 22 M9 13 L15 13 M11 22 L11 17 Q12 15.5 13 17 L13 22",
    color: "#2a1d10"
  },
  {
    key: "bridge",
    name: "Brücke",
    kind: "pin",
    pathData: "M2 16 Q12 6 22 16 M3 16 L3 19 M21 16 L21 19 M3 19 L21 19 M2 21 Q7 20 12 21 Q17 22 22 21",
    color: "#6b4a2a"
  },
  {
    key: "harbor",
    name: "Hafen",
    kind: "pin",
    pathData: "M12 3 Q14 3 14 5 Q14 7 12 7 Q10 7 10 5 Q10 3 12 3 M12 7 L12 20 M8 10 L16 10 M12 20 Q5 20 5 13 M12 20 Q19 20 19 13",
    color: "#1a3a4a"
  },
  {
    key: "temple",
    name: "Tempel",
    kind: "pin",
    pathData: "M3 9 L12 4 L21 9 Z M4 11 L20 11 M5 11 L5 18 M9 11 L9 18 M15 11 L15 18 M19 11 L19 18 M4 18 L20 18 M2 21 L22 21",
    color: "#2a1d10"
  },
  // --- Pin — Canvas-of-Kings-Erweiterung -----------------------------------
  {
    key: "tent",
    name: "Zelt",
    kind: "pin",
    pathData: "M12 4 L21 20 L3 20 Z M12 4 L12 20 M9 20 L12 15 L15 20",
    color: "#8a5a3a"
  },
  {
    key: "stall",
    name: "Marktstand",
    kind: "pin",
    pathData: "M4 10 L6 5 L18 5 L20 10 Z M5 10 L5 20 M19 10 L19 20 M5 20 L19 20 M4 10 L20 10 M9 20 L9 14 L15 14 L15 20",
    color: "#6b4a2a"
  },
  {
    key: "wall",
    name: "Stadtmauer",
    kind: "pin",
    pathData: "M3 20 L3 12 L6 12 L6 10 L9 10 L9 12 L12 12 L12 10 L15 10 L15 12 L18 12 L18 10 L21 10 L21 20 Z M3 16 L21 16",
    color: "#5a5044"
  },
  {
    key: "gate",
    name: "Tor",
    kind: "pin",
    pathData: "M5 20 L5 10 Q5 5 12 5 Q19 5 19 10 L19 20 M9 20 L9 12 Q9 9 12 9 Q15 9 15 12 L15 20 M4 10 L20 10",
    color: "#4a4038"
  },
  {
    key: "root_knot",
    name: "Wurzelknoten",
    kind: "pin",
    pathData: "M9 21 L9 12 Q9 8 12 8 Q15 8 15 12 L15 21 M9 21 Q7 21 5 19 M15 21 Q17 21 19 19 M9 15 Q12 13 15 15 M6 21 L18 21",
    color: "#5a4a32"
  }
];
var BUILTIN_GLYPH_KEYS = BUILTIN_GLYPHS.map(
  (glyph) => glyph.key
);
var GLYPHS_BY_KEY = new Map(
  BUILTIN_GLYPHS.map((glyph) => [glyph.key, glyph])
);
function getGlyphByKey(key) {
  if (!key) return void 0;
  return GLYPHS_BY_KEY.get(key);
}
function listGlyphsByCategory(category) {
  return BUILTIN_GLYPHS.filter((glyph) => glyph.kind === category);
}
function groupGlyphsByCategory() {
  return ATLAS_GLYPH_CATEGORIES.map((category) => ({
    category,
    glyphs: listGlyphsByCategory(category.key)
  }));
}
var BIOME_SCATTER_GLYPH = {
  forest: "tree",
  mountains: "mountain",
  hills: "rock",
  swamp: "tree",
  desert: "rock",
  grassland: "tree",
  coast: null,
  snow: "mountain"
};

// ../atlas/src/draw-model.ts
var DRAW_LAYERS = [
  "background",
  "biome",
  "relief",
  "rivers",
  "roads",
  "objects",
  "labels",
  "overlay"
];
function emptyDrawLayerMap() {
  return {
    background: [],
    biome: [],
    relief: [],
    rivers: [],
    roads: [],
    objects: [],
    labels: [],
    overlay: [],
    scatteredGlyphs: [],
    reliefShadings: []
  };
}

// ../atlas/src/terrain.ts
function makePrng(seed) {
  let s = seed | 0;
  return () => {
    s = s + 1831565813 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function distToSegment2(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function inExclusion(x, y, exclusions) {
  for (const ex of exclusions) {
    const half = ex.width / 2;
    if (half <= 0) continue;
    const pts = ex.path;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      if (distToSegment2(x, y, ax, ay, bx, by) < half) return true;
    }
  }
  return false;
}
var BIOME_GLYPH = {
  forest: "tree",
  mountains: "mountain",
  hills: "mountain",
  grassland: null,
  desert: null,
  swamp: "tree",
  coast: "water",
  snow: "mountain_snow"
};
var BASE_DENSITY = 80;
function ringBbox(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}
function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}
function scatterGlyphsInPolygon(polygon, biomeKind, density, seed = 1337, exclusions) {
  const glyphKey = BIOME_GLYPH[biomeKind];
  if (!glyphKey || density <= 0) return [];
  const outerRing = polygon.rings[0];
  if (!outerRing || outerRing.length < 3) return [];
  const holeRings = polygon.rings.slice(1);
  const rng = makePrng(seed);
  const [minX, minY, maxX, maxY] = ringBbox(outerRing);
  const area = ringArea(outerRing);
  const targetCount = Math.max(1, Math.round(BASE_DENSITY * density * area));
  const results = [];
  const maxAttempts = targetCount * 8;
  let attempts = 0;
  while (results.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    if (!pointInRing(x, y, outerRing)) continue;
    const inHole = holeRings.some(
      (hr) => pointInRing(x, y, hr)
    );
    if (inHole) continue;
    if (exclusions && exclusions.length && inExclusion(x, y, exclusions)) continue;
    const scale = 0.55 + rng() * 0.6;
    const rotation = (rng() - 0.5) * 20;
    results.push({
      id: `sg-${seed}-${results.length}`,
      glyphKey,
      x,
      y,
      scale,
      rotation
    });
  }
  return results;
}
function scatterGlyphsAlongPath(path, biomeKind, spacing, heightMetadata, seed = 42) {
  const glyphKey = BIOME_GLYPH[biomeKind];
  if (!glyphKey || spacing <= 0) return [];
  const coords = path.coordinates;
  if (coords.length < 2) return [];
  const rng = makePrng(seed);
  const results = [];
  let accumulated = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i];
    const [bx, by] = coords[i + 1];
    const segLen = Math.hypot(bx - ax, by - ay);
    if (segLen === 0) continue;
    const ux = (bx - ax) / segLen;
    const uy = (by - ay) / segLen;
    const px = -uy;
    const py = ux;
    let d = accumulated === 0 ? spacing / 2 : spacing - accumulated;
    while (d <= segLen) {
      const t = d / segLen;
      const h0 = heightMetadata?.[i] ?? 0.5;
      const h1 = heightMetadata?.[i + 1] ?? 0.5;
      const height = h0 + (h1 - h0) * t;
      const jitter = (rng() - 0.5) * spacing * 0.4;
      const x = ax + ux * d + px * jitter;
      const y = ay + uy * d + py * jitter;
      const scale = 0.5 + height * 0.8 + rng() * 0.2;
      const rotation = (rng() - 0.5) * 15;
      results.push({
        id: `sp-${seed}-${results.length}`,
        glyphKey,
        x,
        y,
        scale,
        rotation
      });
      d += spacing;
    }
    accumulated = segLen - (d - spacing);
  }
  return results;
}
var BIOME_SHADING = {
  mountains: {
    highlight: "rgba(255,248,230,0.55)",
    shadow: "rgba(60,45,20,0.40)",
    opacity: 0.45
  },
  hills: {
    highlight: "rgba(245,240,210,0.40)",
    shadow: "rgba(80,65,35,0.30)",
    opacity: 0.32
  },
  forest: {
    highlight: "rgba(200,230,180,0.20)",
    shadow: "rgba(30,60,20,0.25)",
    opacity: 0.22
  },
  swamp: {
    highlight: "rgba(180,210,160,0.20)",
    shadow: "rgba(20,50,30,0.35)",
    opacity: 0.28
  },
  grassland: {
    highlight: "rgba(220,245,200,0.18)",
    shadow: "rgba(50,80,30,0.18)",
    opacity: 0.18
  },
  desert: {
    highlight: "rgba(255,240,180,0.30)",
    shadow: "rgba(160,120,40,0.28)",
    opacity: 0.28
  },
  coast: {
    highlight: "rgba(200,230,255,0.30)",
    shadow: "rgba(30,80,120,0.28)",
    opacity: 0.26
  },
  snow: {
    highlight: "rgba(240,248,255,0.50)",
    shadow: "rgba(100,130,170,0.35)",
    opacity: 0.38
  }
};
function buildReliefShading(polygon, biomeKind) {
  const outerRing = polygon.rings[0] ?? [];
  const [minX, minY, maxX, maxY] = ringBbox(outerRing);
  const colors = BIOME_SHADING[biomeKind];
  return {
    bbox: [minX, minY, maxX, maxY],
    biomeKind,
    highlightColor: colors.highlight,
    shadowColor: colors.shadow,
    opacity: colors.opacity
  };
}

// ../atlas/src/serialization.ts
var AtlasParseError = class extends Error {
  constructor(message) {
    super(`[atlas] ${message}`);
    this.name = "AtlasParseError";
  }
};
function isCoordinate(v) {
  return Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number";
}
function assertCoordinate(v, path) {
  if (!isCoordinate(v)) {
    throw new AtlasParseError(`expected [number, number] at ${path}, got ${JSON.stringify(v)}`);
  }
  return v;
}
function assertCoordinateArray(v, path) {
  if (!Array.isArray(v) || v.length === 0) {
    throw new AtlasParseError(`expected non-empty coordinate array at ${path}`);
  }
  return v.map((c, i) => assertCoordinate(c, `${path}[${i}]`));
}
function isBBox(v) {
  return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number");
}
function parsePoint(raw) {
  return {
    type: "Point",
    coordinates: assertCoordinate(raw.coordinates, "coordinates"),
    ...typeof raw.z === "number" ? { z: raw.z } : {}
  };
}
function parsePath(raw) {
  return {
    type: "Path",
    coordinates: assertCoordinateArray(raw.coordinates, "coordinates"),
    ...typeof raw.closed === "boolean" ? { closed: raw.closed } : {}
  };
}
function parsePolygon(raw) {
  if (!Array.isArray(raw.rings) || raw.rings.length === 0) {
    throw new AtlasParseError("Polygon must have at least one ring");
  }
  return {
    type: "Polygon",
    rings: raw.rings.map(
      (ring, i) => assertCoordinateArray(ring, `rings[${i}]`)
    )
  };
}
function parseLabelAnchor(raw) {
  if (typeof raw.text !== "string") {
    throw new AtlasParseError("LabelAnchor.text must be a string");
  }
  return {
    type: "LabelAnchor",
    coordinates: assertCoordinate(raw.coordinates, "coordinates"),
    text: raw.text,
    ...typeof raw.rotation === "number" ? { rotation: raw.rotation } : {},
    ...Array.isArray(raw.pathCoordinates) ? { pathCoordinates: assertCoordinateArray(raw.pathCoordinates, "pathCoordinates") } : {},
    ...typeof raw.pathReversed === "boolean" ? { pathReversed: raw.pathReversed } : {}
  };
}
function parseGeometry(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new AtlasParseError(`expected geometry object, got ${typeof raw}`);
  }
  const obj = raw;
  switch (obj.type) {
    case "Point":
      return parsePoint(obj);
    case "Path":
      return parsePath(obj);
    case "Polygon":
      return parsePolygon(obj);
    case "LabelAnchor":
      return parseLabelAnchor(obj);
    default:
      throw new AtlasParseError(
        `unknown geometry type: ${String(obj.type)}`
      );
  }
}
function serializeGeometry(geometry) {
  return geometry;
}
function parseFeatureGeometry(raw) {
  if (typeof raw !== "object" || raw === null) {
    throw new AtlasParseError("expected feature geometry object");
  }
  const obj = raw;
  const geometry = parseGeometry(obj.geometry);
  return {
    geometry,
    ...typeof obj.crs === "string" ? { crs: obj.crs } : {},
    ...isBBox(obj.bbox) ? { bbox: obj.bbox } : {}
  };
}
function parseExtent(raw) {
  if (typeof raw !== "object" || raw === null) {
    throw new AtlasParseError("expected extent object");
  }
  const obj = raw;
  if (!isBBox(obj.bbox)) {
    throw new AtlasParseError("extent.bbox must be [minX, minY, maxX, maxY]");
  }
  const result = { bbox: obj.bbox };
  if (obj.silhouette != null) {
    const sil = parseGeometry(obj.silhouette);
    if (sil.type !== "Polygon") {
      throw new AtlasParseError("extent.silhouette must be a Polygon geometry");
    }
    result.silhouette = sil;
  }
  return result;
}
function tryParseGeometry(raw) {
  try {
    return parseGeometry(raw);
  } catch {
    return null;
  }
}

// ../atlas/src/doc.ts
var SCHEMA_VERSION = 2;
function emptyTileLayer() {
  return { cols: 64, rows: 40, tile: 32, cells: {} };
}
function migrateDoc(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new AtlasParseError("Atlas-Doc ist leer oder ungültig.");
  }
  const d = { ...doc };
  if (!d.schemaVersion) d.schemaVersion = SCHEMA_VERSION;
  d.nodes = d.nodes ?? [];
  d.features = d.features ?? [];
  d.objects = d.objects ?? [];
  d.pageLinks = d.pageLinks ?? {};
  d.tileLayer = d.tileLayer ?? emptyTileLayer();
  d.tileLayer.cells = d.tileLayer.cells ?? {};
  return d;
}
function serializeDoc(doc, extra) {
  const clean = (arr) => (arr ?? []).map(({ _key, ...rest }) => rest);
  return {
    schemaVersion: SCHEMA_VERSION,
    worldSlug: doc.worldSlug,
    map: doc.map,
    rootNodeId: doc.rootNodeId,
    pageLinks: doc.pageLinks,
    nodes: doc.nodes,
    features: clean(doc.features),
    objects: clean(doc.objects),
    tileLayer: doc.tileLayer,
    ...extra ?? {}
  };
}

// ../atlas/src/canvas-render.ts
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
function drawCompassRose(ctx, opts) {
  const { x, y, radius: r, ink, accent, parchment } = opts;
  if (r <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = parchment;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, r * 0.045);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(0.5, r * 0.02);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const cardinal = i % 2 === 0;
    const len = cardinal ? r * 0.9 : r * 0.5;
    const half = cardinal ? r * 0.14 : r * 0.09;
    const a = -Math.PI / 2 + i * Math.PI / 4;
    const tipX = x + Math.cos(a) * len;
    const tipY = y + Math.sin(a) * len;
    const lx = x + Math.cos(a - Math.PI / 2) * half;
    const ly = y + Math.sin(a - Math.PI / 2) * half;
    const rx = x + Math.cos(a + Math.PI / 2) * half;
    const ry = y + Math.sin(a + Math.PI / 2) * half;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(lx, ly);
    ctx.lineTo(rx, ry);
    ctx.closePath();
    ctx.fillStyle = i === 4 ? accent : ink;
    ctx.fill();
  }
  ctx.fillStyle = ink;
  ctx.font = `bold ${Math.max(8, Math.round(r * 0.3))}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("N", x, y - r * 0.98);
}
function drawScaleBar(ctx, opts) {
  const { x, y, width, height, segments = 4, ink, parchment, label, font } = opts;
  if (width <= 0 || height <= 0 || segments < 1) return;
  const segW = width / segments;
  for (let i = 0; i < segments; i++) {
    ctx.fillStyle = i % 2 === 0 ? ink : parchment;
    ctx.fillRect(x + i * segW, y, segW, height);
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, height * 0.12);
  ctx.strokeRect(x, y, width, height);
  if (label) {
    ctx.fillStyle = ink;
    ctx.font = font ?? `${Math.max(8, Math.round(height * 1.4))}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, x + width / 2, y + height + Math.max(2, height * 0.4));
  }
}
var VINE_TRUNK_BASE_PX = 9;
var VINE_OUTLINE_PX = 2.6;
function strokePolyline(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}
function strokeTaperedTrunk(ctx, pts, widths, base, extraPx) {
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.lineWidth = Math.max(0.6, widths[i] * base) + extraPx;
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    ctx.stroke();
  }
}
function drawVine(ctx, layout, opts) {
  const { spine, widths, coil, tendrils, shadow, aura } = layout;
  if (spine.length < 2) return;
  const { project, zoom, selected } = opts;
  const p = (pts) => pts.map(project);
  const base = VINE_TRUNK_BASE_PX * (opts.thickness ?? 1) * zoom * (selected ? 1.15 : 1);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const shadowPts = p(shadow);
  ctx.strokeStyle = opts.shadow;
  ctx.lineWidth = Math.max(1, base * 0.75);
  strokePolyline(ctx, shadowPts);
  const spinePts = p(spine);
  if (opts.outline) {
    const outlinePx = VINE_OUTLINE_PX * zoom;
    ctx.strokeStyle = opts.outline;
    strokeTaperedTrunk(ctx, spinePts, widths, base, outlinePx);
    ctx.lineWidth = Math.max(0.8, 1.4 * zoom) + outlinePx;
    strokePolyline(ctx, p(coil));
    for (const t of tendrils) strokePolyline(ctx, p(t));
  }
  ctx.strokeStyle = opts.trunk;
  strokeTaperedTrunk(ctx, spinePts, widths, base, 0);
  ctx.strokeStyle = opts.coil;
  ctx.lineWidth = Math.max(0.8, 1.4 * zoom);
  strokePolyline(ctx, p(coil));
  for (const t of tendrils) strokePolyline(ctx, p(t));
  const c = project(aura.center);
  const edge = project([aura.center[0] + aura.radius, aura.center[1]]);
  const pr = Math.hypot(edge[0] - c[0], edge[1] - c[1]);
  if (pr > 1) {
    ctx.strokeStyle = opts.coil;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = Math.max(0.6, 1 * zoom);
    for (const f of [1, 0.66]) {
      ctx.beginPath();
      ctx.arc(c[0], c[1], pr * f, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function drawSvgPath(ctx, d) {
  const cmds = d.match(/[MLHVZQC][^MLHVZQC]*/gi) || [];
  let x = 0;
  let y = 0;
  for (const cmd of cmds) {
    const op = cmd[0].toUpperCase();
    const a = cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    switch (op) {
      case "M":
        x = a[0];
        y = a[1];
        ctx.moveTo(x, y);
        break;
      case "L":
        x = a[0];
        y = a[1];
        ctx.lineTo(x, y);
        break;
      case "H":
        x = a[0];
        ctx.lineTo(x, y);
        break;
      case "V":
        y = a[0];
        ctx.lineTo(x, y);
        break;
      case "Z":
        ctx.closePath();
        break;
      case "Q":
        ctx.quadraticCurveTo(a[0], a[1], a[2], a[3]);
        x = a[2];
        y = a[3];
        break;
      case "C":
        ctx.bezierCurveTo(a[0], a[1], a[2], a[3], a[4], a[5]);
        x = a[4];
        y = a[5];
        break;
      default:
        break;
    }
  }
}

// ../atlas/src/path-smoothing.ts
var DEFAULT_SEGMENTS = 8;
var MIN_SEGMENTS = 1;
var MAX_SEGMENTS = 64;
var DEFAULT_TENSION = 0.5;
function clamp(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}
function controlPoint(points, index, closed) {
  const n = points.length;
  if (closed) {
    return points[(index % n + n) % n];
  }
  if (index < 0) {
    const p0 = points[0];
    const p1 = points[1];
    return [2 * p0[0] - p1[0], 2 * p0[1] - p1[1]];
  }
  if (index > n - 1) {
    const pn = points[n - 1];
    const pn1 = points[n - 2];
    return [2 * pn[0] - pn1[0], 2 * pn[1] - pn1[1]];
  }
  return points[index];
}
function smoothPath(points, options = {}) {
  if (points.length < 3) {
    return points.map((p) => [p[0], p[1]]);
  }
  const segments = clamp(
    Math.round(options.segments ?? DEFAULT_SEGMENTS),
    MIN_SEGMENTS,
    MAX_SEGMENTS
  );
  const tension = clamp(options.tension ?? DEFAULT_TENSION, 0, 1);
  const closed = options.closed ?? false;
  const n = points.length;
  const segmentCount = closed ? n : n - 1;
  const result = [];
  for (let i = 0; i < segmentCount; i++) {
    const p0 = controlPoint(points, i - 1, closed);
    const p1 = controlPoint(points, i, closed);
    const p2 = controlPoint(points, i + 1, closed);
    const p3 = controlPoint(points, i + 2, closed);
    const m1x = tension * (p2[0] - p0[0]);
    const m1y = tension * (p2[1] - p0[1]);
    const m2x = tension * (p3[0] - p1[0]);
    const m2y = tension * (p3[1] - p1[1]);
    const startJ = i === 0 ? 0 : 1;
    for (let j = startJ; j <= segments; j++) {
      const t = j / segments;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      const x = h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x;
      const y = h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y;
      result.push([x, y]);
    }
  }
  return result;
}
function sampleTaperedWidths(points, startWidth, endWidth) {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [startWidth];
  const widths = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    widths[i] = startWidth + (endWidth - startWidth) * t;
  }
  return widths;
}

// ../atlas/src/vine.ts
var COIL_AMP = 0.022;
var COIL_TURNS = 6;
var SHADOW_OFFSET = 0.05;
var AURA_RADIUS = 0.09;
var AURA_CLOUDS = 5;
function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
function clampCoord(c) {
  return [clamp01(c[0]), clamp01(c[1])];
}
function perpendicularAt(spine, i) {
  const prev = spine[Math.max(0, i - 1)];
  const next = spine[Math.min(spine.length - 1, i + 1)];
  const tx = next[0] - prev[0];
  const ty = next[1] - prev[1];
  const len = Math.hypot(tx, ty) || 1;
  return [-ty / len, tx / len];
}
function buildVineLayout(points, options = {}) {
  if (!points || points.length < 2) {
    return {
      spine: [],
      widths: [],
      coil: [],
      tendrils: [],
      shadow: [],
      aura: { center: [0, 0], radius: 0, clouds: [] }
    };
  }
  const taperStart = options.taperStart ?? 0.9;
  const taperEnd = options.taperEnd ?? 0.15;
  const coil = clamp01(options.coil ?? 0.6);
  const tendrilCount = Math.max(0, Math.round(options.tendrils ?? 3));
  const height = clamp01(options.height ?? 0.7);
  const seed = options.seed ?? 1;
  const segments = options.smoothSegments ?? 16;
  const spine = smoothPath(points, { segments, tension: 0.5 }).map(clampCoord);
  const n = spine.length;
  const widths = sampleTaperedWidths(spine, taperStart, taperEnd);
  const coilLine = new Array(n);
  for (let i = 0; i < n; i++) {
    const phase = i / Math.max(1, n - 1) * COIL_TURNS * Math.PI * 2;
    const amp = widths[i] * coil * COIL_AMP;
    const [px, py] = perpendicularAt(spine, i);
    const s = Math.sin(phase) * amp;
    coilLine[i] = clampCoord([spine[i][0] + px * s, spine[i][1] + py * s]);
  }
  const off = SHADOW_OFFSET * height;
  const shadow = spine.map(
    (c) => clampCoord([c[0] + off, c[1] + off])
  );
  const rng = mulberry32(seed);
  const tendrils = [];
  for (let k = 0; k < tendrilCount; k++) {
    const t = (k + 1) / (tendrilCount + 1);
    const idx = Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
    const [px, py] = perpendicularAt(spine, idx);
    const side = rng() < 0.5 ? 1 : -1;
    let step = widths[idx] * (0.02 + rng() * 0.02) + 8e-3;
    let a = Math.atan2(py * side, px * side);
    let cx = spine[idx][0];
    let cy = spine[idx][1];
    const curl = [clampCoord([cx, cy])];
    for (let j = 0; j < 6; j++) {
      a += side * 0.5;
      cx += Math.cos(a) * step;
      cy += Math.sin(a) * step;
      step *= 0.8;
      curl.push(clampCoord([cx, cy]));
    }
    tendrils.push(curl);
  }
  const tip = spine[n - 1];
  const radius = AURA_RADIUS * (0.4 + height * 0.6);
  const clouds = [];
  for (let i = 0; i < AURA_CLOUDS; i++) {
    const a = i / AURA_CLOUDS * Math.PI * 2;
    const rr = radius * (0.7 + 0.3 * (i % 2 === 0 ? 1 : 0.6));
    clouds.push(clampCoord([tip[0] + Math.cos(a) * rr, tip[1] + Math.sin(a) * rr]));
  }
  return {
    spine,
    widths,
    coil: coilLine,
    tendrils,
    shadow,
    aura: { center: clampCoord(tip), radius, clouds }
  };
}

// ../atlas/src/procedural.ts
function makePrng2(seed) {
  let s = seed | 0;
  return () => {
    s = s + 1831565813 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function randInt(rng, max) {
  return Math.floor(rng() * max);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
var DEFAULT_BOUNDS = { minX: 0.05, minY: 0.05, maxX: 0.95, maxY: 0.95 };
function clamp2(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function inRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}
function makeBlobPolygon(cx, cy, baseRadius, jitter, steps, rng) {
  const coords = [];
  for (let i = 0; i < steps; i++) {
    const angle = i / steps * Math.PI * 2;
    const r = baseRadius + (rng() - 0.5) * 2 * jitter;
    coords.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  coords.push(coords[0]);
  return { type: "Polygon", rings: [coords] };
}
function makeRiverPath(startX, startY, rng, bounds) {
  const steps = 5 + randInt(rng, 4);
  const coords = [[startX, startY]];
  let x = startX;
  let y = startY;
  const dirX = (rng() - 0.5) * 0.1;
  const dirY = 0.06 + rng() * 0.06;
  for (let i = 0; i < steps; i++) {
    x = clamp2(x + dirX + (rng() - 0.5) * 0.06, bounds.minX, bounds.maxX);
    y = clamp2(y + dirY + (rng() - 0.5) * 0.03, bounds.minY, bounds.maxY);
    coords.push([x, y]);
  }
  return { type: "Path", coordinates: coords };
}
function buildVoronoiApprox(seedPoints, pointIdx, bounds, gridN, rng) {
  const [cx, cy] = seedPoints[pointIdx];
  const owned = [];
  const step = (bounds.maxX - bounds.minX) / gridN;
  for (let gi = 0; gi <= gridN; gi++) {
    for (let gj = 0; gj <= gridN; gj++) {
      const gx = bounds.minX + gi * step;
      const gy = bounds.minY + gj * step;
      let nearest = 0;
      let nearestDist = Infinity;
      for (let k = 0; k < seedPoints.length; k++) {
        const [sx, sy] = seedPoints[k];
        const d = (gx - sx) ** 2 + (gy - sy) ** 2;
        if (d < nearestDist) {
          nearestDist = d;
          nearest = k;
        }
      }
      if (nearest === pointIdx) {
        owned.push([gx, gy]);
      }
    }
  }
  if (owned.length < 3) {
    const jitter = (rng() * 0.05 + 0.06) * (bounds.maxX - bounds.minX);
    return makeBlobPolygon(cx, cy, jitter, jitter * 0.3, 8, rng);
  }
  const hull = convexHull(owned);
  if (hull.length < 3) {
    const jitter = 0.07 * (bounds.maxX - bounds.minX);
    return makeBlobPolygon(cx, cy, jitter, jitter * 0.3, 8, rng);
  }
  hull.push(hull[0]);
  return { type: "Polygon", rings: [hull] };
}
function convexHull(points) {
  if (points.length < 3) return [...points];
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] < points[start][0]) start = i;
  }
  const hull = [];
  let cur = start;
  do {
    hull.push(points[cur]);
    let next = (cur + 1) % points.length;
    for (let i = 0; i < points.length; i++) {
      if (cross2d(points[cur], points[next], points[i]) < 0) {
        next = i;
      }
    }
    cur = next;
  } while (cur !== start && hull.length <= points.length + 1);
  return hull;
}
function cross2d(c, a, b) {
  return (a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0]);
}
function generateDraft(seed, promptHints, bounds) {
  const b = bounds ?? DEFAULT_BOUNDS;
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const rng = makePrng2(seed);
  const regionCount = clamp2(promptHints?.regionCount ?? 3 + randInt(rng, 3), 1, 8);
  const riverCount = clamp2(promptHints?.riverCount ?? 1 + randInt(rng, 3), 0, 5);
  const cityCount = clamp2(promptHints?.cityCount ?? 2 + randInt(rng, 4), 0, 8);
  const features = [];
  let idx = 0;
  function nextId(kind) {
    return `draft-${seed}-${kind}-${idx++}`;
  }
  const coastSteps = 20 + randInt(rng, 12);
  const coastCx = lerp(b.minX, b.maxX, 0.48 + (rng() - 0.5) * 0.08);
  const coastCy = lerp(b.minY, b.maxY, 0.48 + (rng() - 0.5) * 0.08);
  const coastRadius = bw * 0.38 + rng() * bw * 0.06;
  const coastJitter = coastRadius * 0.18;
  const coastPoly = makeBlobPolygon(coastCx, coastCy, coastRadius, coastJitter, coastSteps, rng);
  features.push({
    id: nextId("coastline"),
    kind: "coastline",
    atlasKind: "region",
    geometry: coastPoly,
    labelHint: "",
    biome: promptHints?.biome ?? BiomeKind.coast
  });
  const seedPoints = [];
  for (let i = 0; i < regionCount; i++) {
    seedPoints.push([
      inRange(rng, b.minX + bw * 0.1, b.maxX - bw * 0.1),
      inRange(rng, b.minY + bh * 0.1, b.maxY - bh * 0.1)
    ]);
  }
  const gridN = 18;
  const rngForRegions = makePrng2(seed + 1);
  for (let i = 0; i < regionCount; i++) {
    const poly = buildVoronoiApprox(seedPoints, i, b, gridN, rngForRegions);
    features.push({
      id: nextId("region"),
      kind: "region",
      atlasKind: "region",
      geometry: poly,
      labelHint: `Region ${i + 1}`,
      meta: { seedPointIndex: i }
    });
  }
  const ridgeCount = 1 + randInt(rng, 3);
  for (let r = 0; r < ridgeCount; r++) {
    const sx = inRange(rng, b.minX + bw * 0.15, b.maxX - bw * 0.15);
    const sy = inRange(rng, b.minY + bh * 0.1, b.maxY - bh * 0.5);
    const steps = 3 + randInt(rng, 4);
    const coords = [[sx, sy]];
    let x = sx;
    let y = sy;
    for (let s = 0; s < steps; s++) {
      x = clamp2(x + (rng() - 0.5) * 0.14, b.minX, b.maxX);
      y = clamp2(y + rng() * 0.1 + 0.02, b.minY, b.maxY);
      coords.push([x, y]);
    }
    features.push({
      id: nextId("mountain"),
      kind: "mountain",
      atlasKind: "relief",
      geometry: { type: "Path", coordinates: coords },
      labelHint: `Gebirgskamm ${r + 1}`,
      biome: BiomeKind.mountains
    });
  }
  const forestCount = 1 + randInt(rng, 3);
  for (let f = 0; f < forestCount; f++) {
    const fcx = inRange(rng, b.minX + bw * 0.1, b.maxX - bw * 0.1);
    const fcy = inRange(rng, b.minY + bh * 0.1, b.maxY - bh * 0.1);
    const fr = inRange(rng, bw * 0.06, bw * 0.14);
    const fsteps = 10 + randInt(rng, 6);
    const fpoly = makeBlobPolygon(fcx, fcy, fr, fr * 0.25, fsteps, rng);
    features.push({
      id: nextId("forest"),
      kind: "forest",
      atlasKind: "biome",
      geometry: fpoly,
      labelHint: `Wald ${f + 1}`,
      biome: BiomeKind.forest
    });
  }
  const rngRivers = makePrng2(seed + 2);
  for (let rv = 0; rv < riverCount; rv++) {
    const rx = inRange(rngRivers, b.minX + bw * 0.15, b.maxX - bw * 0.15);
    const ry = inRange(rngRivers, b.minY + bh * 0.05, b.minY + bh * 0.4);
    features.push({
      id: nextId("river"),
      kind: "river",
      atlasKind: "river",
      geometry: makeRiverPath(rx, ry, rngRivers, b),
      labelHint: `Fluss ${rv + 1}`
    });
  }
  const rngCities = makePrng2(seed + 3);
  for (let c = 0; c < cityCount; c++) {
    const cx2 = inRange(rngCities, b.minX + bw * 0.1, b.maxX - bw * 0.1);
    const cy2 = inRange(rngCities, b.minY + bh * 0.1, b.maxY - bh * 0.1);
    features.push({
      id: nextId("city"),
      kind: "city",
      atlasKind: "pin",
      geometry: { type: "Point", coordinates: [cx2, cy2] },
      labelHint: `Ort ${c + 1}`
    });
  }
  return {
    seed,
    features,
    promptHints,
    bounds: b
  };
}
function rerollDraft(previous, newSeed, lockedFeatureIds) {
  const lockedSet = new Set(lockedFeatureIds ?? []);
  const lockedFeatures = previous.features.filter((f) => lockedSet.has(f.id));
  const fresh = generateDraft(newSeed, previous.promptHints, previous.bounds);
  const freshFiltered = fresh.features.filter((f) => {
    return !lockedSet.has(f.id);
  });
  const merged = [
    ...lockedFeatures.map((f) => ({ ...f, locked: true })),
    ...freshFiltered
  ];
  return {
    seed: newSeed,
    features: merged,
    promptHints: previous.promptHints,
    bounds: previous.bounds
  };
}
function proceduralDraft(seed) {
  const rand = mulberry32(typeof seed === "number" ? seed : hashStringToSeed(seed));
  const cx = 0.3 + rand() * 0.4;
  const cy = 0.3 + rand() * 0.4;
  const r = 0.12 + rand() * 0.1;
  const ring = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2;
    const jitter = 0.7 + rand() * 0.6;
    ring.push([cx + Math.cos(a) * r * jitter, cy + Math.sin(a) * r * jitter]);
  }
  const biomes = [
    BiomeKind.forest,
    BiomeKind.hills,
    BiomeKind.grassland,
    BiomeKind.swamp
  ];
  const biomeKind = biomes[Math.floor(rand() * biomes.length)];
  const river = [
    [rand() * 0.3, 0.05],
    [cx, cy],
    [rand() * 0.3 + 0.6, 0.95]
  ];
  return {
    seed,
    features: [
      {
        kind: "biome",
        geometry: { type: "Polygon", rings: [ring] },
        style: { biomeKind, density: 1 + rand() }
      },
      {
        kind: "river",
        geometry: { type: "Path", coordinates: river },
        style: { smooth: true }
      }
    ]
  };
}

// ../atlas/src/stamp-prompt.ts
var ATLAS_STAMP_STYLE_PROMPT = "tolkien-style ink line art, fantasy cartography map stamp, black ink on transparent background, medieval illuminated manuscript style, highly detailed pen and ink illustration, no color fill, pure line art, transparent background, isolated map symbol, stamp style, DnD map icon";
function assembleStampPrompt(keyword) {
  const trimmed = keyword.trim();
  if (!trimmed) return ATLAS_STAMP_STYLE_PROMPT;
  return `${trimmed}, ${ATLAS_STAMP_STYLE_PROMPT}`;
}

// ../atlas/src/label-layout.ts
function segmentLength(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}
function pathLength(points) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += segmentLength(points[i], points[i + 1]);
  }
  return total;
}
function pointAtDistance(points, d) {
  if (points.length === 0) {
    return { point: [0, 0], rotation: 0 };
  }
  if (points.length === 1) {
    return { point: points[0], rotation: 0 };
  }
  const total = pathLength(points);
  if (total <= 0) {
    return { point: points[0], rotation: 0 };
  }
  const clamped = Math.max(0, Math.min(d, total));
  let walked = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = segmentLength(a, b);
    if (walked + len >= clamped) {
      const t = len > 0 ? (clamped - walked) / len : 0;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const rotation = Math.atan2(b[1] - a[1], b[0] - a[0]);
      return { point: [x, y], rotation };
    }
    walked += len;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    point: last,
    rotation: Math.atan2(last[1] - prev[1], last[0] - prev[0])
  };
}
function layoutCharactersOnPath(text, path, letterSpacing = 0.012, reverse = false) {
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

// ../atlas/src/stamp-variation.ts
function makePrng3(seed) {
  let s = seed | 0;
  return () => {
    s = s + 1831565813 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var DEFAULT_SCALE_MIN = 0.7;
var DEFAULT_SCALE_MAX = 1.3;
var DEFAULT_ROTATE_MIN = -15;
var DEFAULT_ROTATE_MAX = 15;
var MIN_POSITIVE_SCALE = 1e-6;
function clamp3(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}
function ordered(a, b) {
  return a <= b ? [a, b] : [b, a];
}
function randomStampVariation(seed, options) {
  const [scaleMin, scaleMax] = ordered(
    options?.scaleMin ?? DEFAULT_SCALE_MIN,
    options?.scaleMax ?? DEFAULT_SCALE_MAX
  );
  const [rotateMin, rotateMax] = ordered(
    options?.rotateMin ?? DEFAULT_ROTATE_MIN,
    options?.rotateMax ?? DEFAULT_ROTATE_MAX
  );
  const rng = makePrng3(seed);
  const rawScale = scaleMin + rng() * (scaleMax - scaleMin);
  const rawRotation = rotateMin + rng() * (rotateMax - rotateMin);
  const scale = Math.max(
    MIN_POSITIVE_SCALE,
    clamp3(rawScale, scaleMin, scaleMax)
  );
  const rotation = clamp3(rawRotation, rotateMin, rotateMax);
  return { scale, rotation };
}
function stampSeedFromKey(key) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// ../atlas/src/path-attachments.ts
function makePrng4(seed) {
  let s = seed | 0;
  return () => {
    s = s + 1831565813 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var KIND_GLYPH = {
  trees: "tree",
  houses: "village",
  towers: "castle"
};
function clamp012(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
function toCoordinates(path) {
  return Array.isArray(path) ? path : path.coordinates;
}
function generatePathAttachments(path, options) {
  const { kind, spacing } = options;
  const side = options.side ?? "both";
  const offset = options.offset ?? 0.02;
  const jitter = options.jitter ?? 0.25;
  const seed = options.seed ?? 7;
  if (spacing <= 0) return [];
  const coords = toCoordinates(path);
  if (coords.length < 2) return [];
  const glyphKey = KIND_GLYPH[kind];
  const rng = makePrng4(seed);
  const signs = side === "both" ? [1, -1] : side === "right" ? [1] : [-1];
  const rotationRange = kind === "towers" ? 5 : 12;
  const results = [];
  let accumulated = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i];
    const [bx, by] = coords[i + 1];
    const segLen = Math.hypot(bx - ax, by - ay);
    if (segLen === 0) continue;
    const ux = (bx - ax) / segLen;
    const uy = (by - ay) / segLen;
    const px = -uy;
    const py = ux;
    let d = accumulated === 0 ? spacing / 2 : spacing - accumulated;
    while (d <= segLen) {
      const along = (rng() - 0.5) * spacing * jitter;
      const cx = ax + ux * (d + along);
      const cy = ay + uy * (d + along);
      for (const sign of signs) {
        const scale = 0.8 + rng() * 0.4;
        const rotation = (rng() - 0.5) * 2 * rotationRange;
        const x = clamp012(cx + px * offset * sign);
        const y = clamp012(cy + py * offset * sign);
        results.push({ glyphKey, x, y, scale, rotation });
      }
      d += spacing;
    }
    accumulated = segLen - (d - spacing);
  }
  return results;
}

// ../atlas/src/export-grid.ts
var EPSILON = 1e-9;
function clamp4(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}
function buildGridLines(rect, spec) {
  if (spec.cellSize <= 0) return [];
  if (rect.width <= 0 || rect.height <= 0) return [];
  return spec.kind === "hex" ? buildHexLines(rect, spec.cellSize) : buildSquareLines(rect, spec.cellSize);
}
function buildSquareLines(rect, cellSize) {
  const minX = rect.x;
  const minY = rect.y;
  const maxX = rect.x + rect.width;
  const maxY = rect.y + rect.height;
  const lines = [];
  const colCount = Math.floor(rect.width / cellSize + EPSILON);
  for (let k = 0; k <= colCount; k++) {
    const x = clamp4(minX + k * cellSize, minX, maxX);
    lines.push({ x1: x, y1: minY, x2: x, y2: maxY });
  }
  const rowCount = Math.floor(rect.height / cellSize + EPSILON);
  for (let k = 0; k <= rowCount; k++) {
    const y = clamp4(minY + k * cellSize, minY, maxY);
    lines.push({ x1: minX, y1: y, x2: maxX, y2: y });
  }
  return lines;
}
function buildHexLines(rect, size) {
  const minX = rect.x;
  const minY = rect.y;
  const maxX = rect.x + rect.width;
  const maxY = rect.y + rect.height;
  const hexWidth = Math.sqrt(3) * size;
  const vStep = 1.5 * size;
  const lines = [];
  const rowCount = Math.ceil(rect.height / vStep) + 2;
  const colCount = Math.ceil(rect.width / hexWidth) + 2;
  for (let r = -1; r <= rowCount; r++) {
    const cy = minY + r * vStep;
    if (cy + size < minY || cy - size > maxY) continue;
    const rowOffset = (r & 1) === 0 ? 0 : hexWidth / 2;
    for (let c = -1; c <= colCount; c++) {
      const cx = minX + c * hexWidth + rowOffset;
      if (cx + hexWidth / 2 < minX || cx - hexWidth / 2 > maxX) continue;
      appendHex(lines, cx, cy, size, minX, minY, maxX, maxY);
    }
  }
  return lines;
}
function appendHex(lines, cx, cy, size, minX, minY, maxX, maxY) {
  const xs = [];
  const ys = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (90 + 60 * i);
    xs.push(clamp4(cx + size * Math.cos(angle), minX, maxX));
    ys.push(clamp4(cy + size * Math.sin(angle), minY, maxY));
  }
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    const x1 = xs[i];
    const y1 = ys[i];
    const x2 = xs[j];
    const y2 = ys[j];
    if (x1 === x2 && y1 === y2) continue;
    lines.push({ x1, y1, x2, y2 });
  }
}
export {
  ATLAS_GLYPH_CATEGORIES,
  ATLAS_STAMP_STYLE_PROMPT,
  AtlasFeatureKind,
  AtlasLabelColor,
  AtlasNodeLevel,
  AtlasPaletteReviewStatus,
  AtlasPaletteSource,
  AtlasParseError,
  BIOME_SCATTER_GLYPH,
  BUILTIN_GLYPHS,
  BUILTIN_GLYPH_KEYS,
  BiomeKind,
  DRAW_LAYERS,
  LAYER_Z,
  SCHEMA_VERSION,
  STYLE_PRESETS,
  TOLKIEN_INK,
  assembleStampPrompt,
  buildGridLines,
  buildReliefShading,
  buildVineLayout,
  canvasToWorld,
  centroid,
  distToSegment,
  drawCompassRose,
  drawScaleBar,
  drawSvgPath,
  drawVine,
  emptyDrawLayerMap,
  generateDraft,
  generatePathAttachments,
  getGlyphByKey,
  groupGlyphsByCategory,
  hashStringToSeed,
  layoutCharactersOnPath,
  listGlyphsByCategory,
  migrateDoc,
  mulberry32,
  paintTerrainBlobs,
  parseExtent,
  parseFeatureGeometry,
  parseGeometry,
  pathLength,
  pointAtDistance,
  pointInPolygon,
  proceduralDraft,
  randomStampVariation,
  rerollDraft,
  resolveStylePreset,
  roundedRectPath,
  sampleTaperedWidths,
  scatterGlyphsAlongPath,
  scatterGlyphsInPolygon,
  serializeDoc,
  serializeGeometry,
  smoothPath,
  stampSeedFromKey,
  translateGeometry,
  tryParseGeometry,
  worldToCanvas
};
