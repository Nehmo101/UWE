/* AUTO-GENERATED from @uwe/atlas — do not edit by hand.
   Regenerate: pnpm --filter @uwe/static-export build:atlas-engine */
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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
  vine: "vine",
  plot: "plot"
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
var PARCHMENT_CLASSIC = {
  id: "pergament-klassik",
  label: "Pergament Klassik",
  description: "Helles, neutrales Pergament mit blauen Wasserwegen und warmem Braun — der zeitlose Schulatlas-Look.",
  colors: {
    parchment: "#f6efdb",
    ink: "#2b2118",
    inkAccent: "#3f6f9a",
    water: "#9dc0d6",
    land: "#efe6c8",
    forest: "#557347",
    mountain: "#8a7a5e",
    road: "#7a5a34"
  },
  typography: { ...TOLKIEN_INK.typography },
  decorations: { ...TOLKIEN_INK.decorations }
};
var NIGHT_CHART = {
  id: "nachtkarte",
  label: "Nachtkarte",
  description: "Dunkles Kartenblatt mit heller Tinte und kühlem Wasser — Kriegsrat bei Kerzenlicht.",
  colors: {
    parchment: "#232732",
    ink: "#e6e2d2",
    inkAccent: "#d9a44a",
    water: "#3d5a74",
    land: "#2c313e",
    forest: "#3d5a45",
    mountain: "#5a5a68",
    road: "#a08a63"
  },
  typography: { ...TOLKIEN_INK.typography },
  decorations: { ...TOLKIEN_INK.decorations }
};
var WINTER_CAMPAIGN = {
  id: "winterfeldzug",
  label: "Winterfeldzug",
  description: "Kalte, entsättigte Töne, eisiges Wasser und schneegraues Land — Kampagnen im tiefen Winter.",
  colors: {
    parchment: "#eef0ee",
    ink: "#2a303a",
    inkAccent: "#8a3a2a",
    water: "#a9c6d9",
    land: "#e2e7e4",
    forest: "#4f6a58",
    mountain: "#8b93a0",
    road: "#6f6354"
  },
  typography: { ...TOLKIEN_INK.typography },
  decorations: { ...TOLKIEN_INK.decorations, scaleUnit: "days" }
};
var STYLE_PRESETS = {
  [TOLKIEN_INK.id]: TOLKIEN_INK,
  [PARCHMENT_CLASSIC.id]: PARCHMENT_CLASSIC,
  [NIGHT_CHART.id]: NIGHT_CHART,
  [WINTER_CAMPAIGN.id]: WINTER_CAMPAIGN
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

// ../atlas/src/elevation.ts
var DEFAULT_PARALLAX_STRENGTH = 0.35;
var DEFAULT_CONTOUR_STEPS = 5;
var CONTOUR_MAJOR_EVERY = 5;
var VERTICAL_SCALE = 6;
var PARALLAX_FACTOR = 0.08;
var LIGHT_X = -0.5;
var LIGHT_Y = -0.5;
var LIGHT_Z = Math.SQRT1_2;
var HILLSHADE_GAIN = 1.35;
var HILLSHADE_MAX_ALPHA = 0.42;
var HIGHLIGHT_RGB = [255, 250, 235];
var SHADOW_RGB = [45, 35, 20];
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function cellElevation(grid, col, row) {
  const { cols, rows, elevation } = grid;
  if (!elevation || cols <= 0 || rows <= 0) return 0;
  const c = col < 0 ? 0 : col >= cols ? cols - 1 : col;
  const r = row < 0 ? 0 : row >= rows ? rows - 1 : row;
  const v = elevation[`${c},${r}`];
  return typeof v === "number" && Number.isFinite(v) ? clamp01(v) : 0;
}
function hasElevation(grid) {
  const { elevation } = grid;
  if (!elevation) return false;
  for (const key of Object.keys(elevation)) {
    const v = elevation[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return true;
  }
  return false;
}
function sampleElevation(grid, nx, ny) {
  const { cols, rows } = grid;
  if (!grid.elevation || cols <= 0 || rows <= 0) return 0;
  const gx = clamp01(nx) * cols - 0.5;
  const gy = clamp01(ny) * rows - 0.5;
  const c0 = Math.floor(gx);
  const r0 = Math.floor(gy);
  const tx = gx - c0;
  const ty = gy - r0;
  const v00 = cellElevation(grid, c0, r0);
  const v10 = cellElevation(grid, c0 + 1, r0);
  const v01 = cellElevation(grid, c0, r0 + 1);
  const v11 = cellElevation(grid, c0 + 1, r0 + 1);
  const top = v00 + (v10 - v00) * tx;
  const bottom = v01 + (v11 - v01) * tx;
  return top + (bottom - top) * ty;
}
function sampleElevationAlongPath(grid, coords) {
  return coords.map(([x, y]) => sampleElevation(grid, x, y));
}
var DEFAULT_LIGHT_DIRECTION = "nw";
function normalizeLightDirection(value) {
  return value === "ne" || value === "sw" || value === "se" ? value : DEFAULT_LIGHT_DIRECTION;
}
function lightDirectionSigns(dir) {
  const d = normalizeLightDirection(dir);
  return [d === "ne" || d === "se" ? -1 : 1, d === "sw" || d === "se" ? -1 : 1];
}
function buildHillshadeRGBA(grid, options = {}) {
  const { cols, rows } = grid;
  const out = new Uint8ClampedArray(Math.max(0, cols) * Math.max(0, rows) * 4);
  if (!grid.elevation || cols <= 0 || rows <= 0) return out;
  const [sx, sy] = lightDirectionSigns(options.lightDir);
  const lightX = LIGHT_X * sx;
  const lightY = LIGHT_Y * sy;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dzdx = (cellElevation(grid, c + 1, r) - cellElevation(grid, c - 1, r)) / 2 * VERTICAL_SCALE;
      const dzdy = (cellElevation(grid, c, r + 1) - cellElevation(grid, c, r - 1)) / 2 * VERTICAL_SCALE;
      if (dzdx === 0 && dzdy === 0) continue;
      const invLen = 1 / Math.hypot(dzdx, dzdy, 1);
      const shade = (-dzdx * lightX - dzdy * lightY + LIGHT_Z) * invLen;
      const delta = shade - LIGHT_Z;
      if (delta === 0) continue;
      const alpha = Math.min(1, Math.abs(delta) * HILLSHADE_GAIN) * HILLSHADE_MAX_ALPHA;
      const [cr, cg, cb] = delta > 0 ? HIGHLIGHT_RGB : SHADOW_RGB;
      const i = (r * cols + c) * 4;
      out[i] = cr;
      out[i + 1] = cg;
      out[i + 2] = cb;
      out[i + 3] = Math.round(alpha * 255);
    }
  }
  return out;
}
function ptKey(p) {
  return `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
}
function chainSegments(segments) {
  const adj = /* @__PURE__ */ new Map();
  const used = new Array(segments.length).fill(false);
  segments.forEach((seg, i) => {
    for (const pt of seg) {
      const key = ptKey(pt);
      const entry = adj.get(key);
      if (entry) entry.segs.push(i);
      else adj.set(key, { pt, segs: [i] });
    }
  });
  const lines = [];
  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    const line = [segments[start][0], segments[start][1]];
    for (const dir of [1, -1]) {
      for (; ; ) {
        const tip = dir === 1 ? line[line.length - 1] : line[0];
        const entry = adj.get(ptKey(tip));
        const nextIdx = entry?.segs.find((i) => !used[i]);
        if (nextIdx === void 0) break;
        used[nextIdx] = true;
        const [a, b] = segments[nextIdx];
        const next = ptKey(a) === ptKey(tip) ? b : a;
        if (dir === 1) line.push(next);
        else line.unshift(next);
      }
    }
    lines.push(line);
  }
  return lines;
}
function buildContourLines(grid, steps = DEFAULT_CONTOUR_STEPS) {
  const { cols, rows } = grid;
  const n = Math.max(2, Math.min(24, Math.round(steps)));
  if (!grid.elevation || cols < 2 || rows < 2 || !hasElevation(grid)) return [];
  const nodeX = (c) => (c + 0.5) / cols;
  const nodeY = (r) => (r + 0.5) / rows;
  const result = [];
  for (let li = 1; li < n; li++) {
    const level = li / n;
    const segments = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const tl = cellElevation(grid, c, r);
        const tr = cellElevation(grid, c + 1, r);
        const br = cellElevation(grid, c + 1, r + 1);
        const bl = cellElevation(grid, c, r + 1);
        const idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const lerp2 = (a, b) => (level - a) / (b - a);
        const top = [nodeX(c) + lerp2(tl, tr) / cols, nodeY(r)];
        const right = [nodeX(c + 1), nodeY(r) + lerp2(tr, br) / rows];
        const bottom = [nodeX(c) + lerp2(bl, br) / cols, nodeY(r + 1)];
        const left = [nodeX(c), nodeY(r) + lerp2(tl, bl) / rows];
        const push = (a, b) => segments.push([a, b]);
        switch (idx) {
          case 1:
            push(left, bottom);
            break;
          case 2:
            push(bottom, right);
            break;
          case 3:
            push(left, right);
            break;
          case 4:
            push(top, right);
            break;
          case 5: {
            const centerAbove = (tl + tr + br + bl) / 4 > level;
            if (centerAbove) {
              push(top, left);
              push(bottom, right);
            } else {
              push(top, right);
              push(left, bottom);
            }
            break;
          }
          case 6:
            push(top, bottom);
            break;
          case 7:
            push(top, left);
            break;
          case 8:
            push(top, left);
            break;
          case 9:
            push(top, bottom);
            break;
          case 10: {
            const centerAbove = (tl + tr + br + bl) / 4 > level;
            if (centerAbove) {
              push(top, right);
              push(left, bottom);
            } else {
              push(top, left);
              push(bottom, right);
            }
            break;
          }
          case 11:
            push(top, right);
            break;
          case 12:
            push(left, right);
            break;
          case 13:
            push(bottom, right);
            break;
          case 14:
            push(left, bottom);
            break;
        }
      }
    }
    if (!segments.length) continue;
    const major = li % CONTOUR_MAJOR_EVERY === 0;
    for (const points of chainSegments(segments)) {
      if (points.length >= 2) result.push({ level, major, points });
    }
  }
  return result;
}
function parallaxCanvasOffset(e, canvasX, canvasY, centerX, centerY, strength) {
  if (!(e > 0) || !(strength > 0)) return [0, 0];
  const k = clamp01(e) * clamp01(strength) * PARALLAX_FACTOR;
  return [(canvasX - centerX) * k, (canvasY - centerY) * k];
}
function elevationShadowOffset(e, zoom, lightDir) {
  const d = clamp01(e) * zoom;
  const [sx, sy] = lightDirectionSigns(lightDir);
  return [d * 10 * sx, d * 7 * sy];
}
function normalizeElevationCells(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  const out = {};
  let any = false;
  for (const [key, raw] of Object.entries(value)) {
    if (!/^\d+,\d+$/.test(key)) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
    out[key] = clamp01(raw);
    any = true;
  }
  return any ? out : void 0;
}
function normalizeParallaxStrength(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_PARALLAX_STRENGTH;
  return clamp01(value);
}
function normalizeContourSteps(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONTOUR_STEPS;
  return Math.max(2, Math.min(24, Math.round(value)));
}

// ../atlas/src/plot-fill.ts
var BASE_PLOT_DENSITY = 42;
function ringBbox2(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}
function ringArea2(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(area / 2);
}
function pointInRing2(px, py, ring) {
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
function distToSegment3(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function inExclusion2(x, y, exclusions) {
  for (const ex of exclusions) {
    const half = ex.width / 2;
    if (half <= 0) continue;
    for (let i = 0; i < ex.path.length - 1; i++) {
      const [ax, ay] = ex.path[i];
      const [bx, by] = ex.path[i + 1];
      if (distToSegment3(x, y, ax, ay, bx, by) < half) return true;
    }
  }
  return false;
}
function pickAsset(assets, roll) {
  const weights = assets.map((asset) => Math.max(0, asset.weight ?? 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return assets[0];
  let cursor = roll * total;
  for (let i = 0; i < assets.length; i++) {
    cursor -= weights[i];
    if (cursor <= 0) return assets[i];
  }
  return assets[assets.length - 1];
}
function polygonArea(rings) {
  const outer = rings[0];
  if (!outer) return 0;
  const holes = rings.slice(1).reduce((sum, ring) => sum + ringArea2(ring), 0);
  return Math.max(0, ringArea2(outer) - holes);
}
function fillPlotWithGouacheAssets(polygon, options) {
  const assets = options.assets.filter((asset) => asset.gouacheKey && (asset.weight ?? 1) > 0);
  const density = options.density ?? 1;
  if (assets.length === 0 || density <= 0) return [];
  const outer = polygon.rings[0];
  if (!outer || outer.length < 3) return [];
  const holes = polygon.rings.slice(1);
  const area = polygonArea(polygon.rings);
  if (area <= 0) return [];
  const seed = options.seed ?? 1337;
  const rng = mulberry32(seed);
  const [minX, minY, maxX, maxY] = ringBbox2(outer);
  const targetCount = Math.max(1, Math.round(BASE_PLOT_DENSITY * density * area));
  const maxAttempts = targetCount * 10;
  const results = [];
  let attempts = 0;
  while (results.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    if (!pointInRing2(x, y, outer)) continue;
    if (holes.some((ring) => pointInRing2(x, y, ring))) continue;
    if (options.exclusions?.length && inExclusion2(x, y, options.exclusions)) continue;
    const asset = pickAsset(assets, rng());
    const scaleMin = asset.scaleMin ?? 0.78;
    const scaleMax = asset.scaleMax ?? 1.22;
    const rotateMin = asset.rotateMin ?? -12;
    const rotateMax = asset.rotateMax ?? 12;
    const style = { gouache: asset.gouacheKey };
    if (asset.lineWidth != null) style.lineWidth = asset.lineWidth;
    if (asset.blur != null) style.blur = asset.blur;
    results.push({
      id: `${options.idPrefix ?? `plot-${seed}`}-${results.length}`,
      paletteItemId: options.paletteItemId,
      x,
      y,
      scale: scaleMin + rng() * (scaleMax - scaleMin),
      rotation: rotateMin + rng() * (rotateMax - rotateMin),
      layer: options.layer ?? 50,
      visibility: options.visibility ?? "dm_only",
      style
    });
  }
  return results;
}

// ../atlas/src/assets-toolkit.ts
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
function darken(h, f) {
  const [r, g, b] = hexRgb(h);
  return `rgb(${Math.round(r * (1 - f))},${Math.round(g * (1 - f))},${Math.round(b * (1 - f))})`;
}
function lighten(h, f) {
  const [r, g, b] = hexRgb(h);
  return `rgb(${Math.round(r + (255 - r) * f)},${Math.round(g + (255 - g) * f)},${Math.round(b + (255 - b) * f)})`;
}
function shadow(ctx, x, y, rx) {
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#2a1e0c";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function rectFn(x, y, w, h) {
  return (c) => {
    c.beginPath();
    c.rect(x, y, w, h);
  };
}
function polyFn(pts) {
  return (c) => {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  };
}
function ellipseFn(cx, cy, rx, ry) {
  return (c) => {
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };
}
function blobFn(pts) {
  return (c) => {
    const n = pts.length;
    c.beginPath();
    c.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (let i = 0; i < n; i++) {
      const cur = pts[i];
      const nx = pts[(i + 1) % n];
      c.quadraticCurveTo(cur[0], cur[1], (cur[0] + nx[0]) / 2, (cur[1] + nx[1]) / 2);
    }
    c.closePath();
  };
}
function iblob(cx, cy, rx, ry, rng, jag = 0.24, n = 12) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const k = 1 + (rng() - 0.5) * 2 * jag;
    p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return p;
}
function paint(ctx, pf, fill, lw, edgeColor) {
  ctx.save();
  ctx.fillStyle = fill;
  pf(ctx);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = edgeColor ?? darken(fill, 0.42);
  ctx.lineWidth = Math.max(0.5, lw);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  pf(ctx);
  ctx.stroke();
  ctx.restore();
}

// ../atlas/src/assets-batch4.ts
var GOUACHE_ASSETS_BATCH4 = [
  { key: "g_giant_mushroom", name: "Titanenpilz", category: "flora" },
  { key: "g_smithy", name: "Schmiede", category: "structure" },
  { key: "g_wizard_tower", name: "Zauberturm", category: "landmark" },
  { key: "g_dragon_perch", name: "Drachenhorst", category: "landmark" },
  { key: "g_waterfall", name: "Wasserfall", category: "landmark" },
  { key: "g_shipwreck", name: "Schiffswrack", category: "vehicle" },
  { key: "g_hot_spring", name: "Heiße Quelle", category: "prop" },
  { key: "g_shrine", name: "Wegschrein", category: "prop" }
];
var BATCH4_RECIPES = {
  g_giant_mushroom: (ctx, s, rng, lw) => {
    shadow(ctx, s * 0.05, s * 0.03, s * 0.62);
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.17, 0);
      c.quadraticCurveTo(-s * 0.22, -s * 0.55, -s * 0.04, -s * 0.94);
      c.lineTo(s * 0.14, -s * 0.94);
      c.quadraticCurveTo(s * 0.05, -s * 0.5, s * 0.19, 0);
      c.closePath();
    }, "#d8cdb0", lw, "#8a7d5c");
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten("#d8cdb0", 0.32);
    ctx.beginPath();
    ctx.ellipse(-s * 0.06, -s * 0.5, s * 0.05, s * 0.36, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    paint(ctx, ellipseFn(s * 0.04, -s * 0.92, s * 0.46, s * 0.13), "#c4b699", lw * 0.6, "#8a7d5c");
    ctx.save();
    ctx.strokeStyle = "#8a7d5c";
    ctx.lineWidth = Math.max(0.5, lw * 0.4);
    ctx.globalAlpha = 0.7;
    for (const dx of [-0.32, -0.14, 0.22, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(s * 0.04, -s * 0.92);
      ctx.lineTo(s * (0.04 + dx), -s * 0.92 + Math.abs(dx) * s * 0.24);
      ctx.stroke();
    }
    ctx.restore();
    paint(ctx, blobFn(iblob(s * 0.04, -s * 1.04, s * 0.6, s * 0.28, rng, 0.12, 14)), "#7d6b8f", lw, "#4e4060");
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = lighten("#7d6b8f", 0.3);
    ctx.beginPath();
    ctx.ellipse(-s * 0.16, -s * 1.15, s * 0.24, s * 0.1, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#d9d2e2";
    for (const [dx, dy, r] of [[-0.28, -1.07, 0.05], [0.06, -1.17, 0.06], [0.34, -1.02, 0.04]]) {
      ctx.beginPath();
      ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    paint(ctx, rectFn(s * 0.3, -s * 0.13, s * 0.05, s * 0.13), "#d8cdb0", lw * 0.5, "#8a7d5c");
    paint(ctx, blobFn(iblob(s * 0.325, -s * 0.15, s * 0.1, s * 0.05, () => 0.5, 0.06, 8)), "#7d6b8f", lw * 0.5, "#4e4060");
  },
  g_smithy: (ctx, s, rng, lw) => {
    const w = s * 0.95, h = s * 0.55;
    shadow(ctx, 0, s * 0.04, s * 0.62);
    paint(ctx, rectFn(-w / 2, -h, w, h), "#b09a72", lw, "#6f5c3c");
    paint(ctx, rectFn(-s * 0.3, -h * 1.9, s * 0.16, h * 0.95), "#9a9488", lw, "#5f5a4d");
    paint(ctx, polyFn([[-w * 0.62, -h + 1], [-w * 0.05, -h * 1.6], [w * 0.62, -h + 1]]), "#6e5a44", lw);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten("#b09a72", 0.3);
    ctx.fillRect(-w / 2 + s * 0.04, -h + s * 0.05, s * 0.16, s * 0.12);
    ctx.restore();
    paint(ctx, rectFn(s * 0.08, -h * 0.62, s * 0.3, h * 0.62), "#2f2a24", lw * 0.6, "#4a4030");
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#c96a2f";
    ctx.beginPath();
    ctx.ellipse(s * 0.23, -h * 0.26, s * 0.1, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0c35c";
    ctx.beginPath();
    ctx.ellipse(s * 0.23, -h * 0.25, s * 0.05, s * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    paint(ctx, polyFn([[-s * 0.38, -s * 0.16], [-s * 0.18, -s * 0.16], [-s * 0.24, -s * 0.1], [-s * 0.22, -s * 0.02], [-s * 0.34, -s * 0.02], [-s * 0.32, -s * 0.1]]), "#4a4636", lw * 0.6, "#2f2a24");
    ctx.save();
    ctx.fillStyle = "#8f8a84";
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      const x = -s * 0.22 + t * s * 0.18 + (rng() - 0.5) * s * 0.06;
      const y = -h * 1.98 - t * s * 0.28;
      const r = s * (0.06 + t * 0.05);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  g_wizard_tower: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.48);
    paint(ctx, polyFn([[-s * 0.3, 0], [-s * 0.2, -s * 1.05], [s * 0.2, -s * 1.05], [s * 0.3, 0]]), "#8f8a9c", lw, "#565064");
    ctx.save();
    ctx.strokeStyle = "#565064";
    ctx.lineWidth = Math.max(0.6, lw * 0.5);
    for (let i = 1; i <= 3; i++) {
      const hw = s * (0.3 - 0.024 * i * 4);
      ctx.beginPath();
      ctx.moveTo(-hw, -s * i * 0.25);
      ctx.lineTo(hw, -s * i * 0.25);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten("#8f8a9c", 0.3);
    ctx.fillRect(-s * 0.16, -s, s * 0.07, s * 0.92);
    ctx.restore();
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.09, 0);
      c.lineTo(-s * 0.09, -s * 0.16);
      c.quadraticCurveTo(0, -s * 0.3, s * 0.09, -s * 0.16);
      c.lineTo(s * 0.09, 0);
      c.closePath();
    }, "#3a3226", lw * 0.6, "#57492f");
    paint(ctx, rectFn(-s * 0.3, -s * 1.12, s * 0.6, s * 0.09), "#6f665a", lw * 0.6);
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#f0c35c";
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.28, s * 0.42, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    paint(ctx, (c) => {
      c.beginPath();
      c.arc(0, -s * 1.12, s * 0.24, Math.PI, 0);
      c.closePath();
    }, "#f0c35c", lw, "#9a4a22");
    ctx.save();
    ctx.strokeStyle = "#9a4a22";
    ctx.lineWidth = Math.max(0.5, lw * 0.45);
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.36);
    ctx.lineTo(0, -s * 1.12);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#e6f2f7";
    ctx.globalAlpha = 0.85;
    for (const dx of [-0.4, 0.36, 0.12]) {
      const x = dx * s + (rng() - 0.5) * s * 0.08;
      const y = -s * (1.34 + rng() * 0.2);
      ctx.beginPath();
      ctx.arc(x, y, s * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  g_dragon_perch: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.04, s * 0.6);
    paint(ctx, polyFn([[-s * 0.5, 0], [-s * 0.34, -s * 0.42], [-s * 0.4, -s * 0.62], [-s * 0.22, -s * 0.9], [s * 0.24, -s * 0.9], [s * 0.36, -s * 0.55], [s * 0.3, -s * 0.36], [s * 0.5, 0]]), "#8f8774", lw, "#5f5846");
    paint(ctx, polyFn([[s * 0.05, 0], [s * 0.24, -s * 0.9], [s * 0.36, -s * 0.55], [s * 0.3, -s * 0.36], [s * 0.5, 0]]), "#766e5c", lw * 0.5, "#5f5846");
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = lighten("#8f8774", 0.3);
    ctx.beginPath();
    ctx.ellipse(-s * 0.18, -s * 0.55, s * 0.09, s * 0.22, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    paint(ctx, ellipseFn(0, -s * 0.92, s * 0.34, s * 0.13), "#7a5230", lw, "#4a3320");
    ctx.save();
    ctx.strokeStyle = "#4a3320";
    ctx.lineWidth = Math.max(0.6, lw * 0.55);
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const x = Math.cos(a) * s * 0.3, y = -s * 0.92 + Math.sin(a) * s * 0.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * s * 0.2, y - rng() * s * 0.08);
      ctx.stroke();
    }
    ctx.restore();
    paint(ctx, ellipseFn(0, -s * 0.94, s * 0.2, s * 0.07), "#57492f", lw * 0.5, "#3a3226");
    paint(ctx, ellipseFn(s * 0.02, -s * 1, s * 0.09, s * 0.12), "#e0d6b4", lw * 0.6, "#8a6f3a");
    ctx.save();
    ctx.fillStyle = "#b0a179";
    for (const [dx, dy] of [[-0.01, -1.04], [0.05, -0.98]]) {
      ctx.beginPath();
      ctx.arc(dx * s, dy * s, s * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  g_waterfall: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.55);
    paint(ctx, blobFn(iblob(0, -s * 0.04, s * 0.52, s * 0.15, rng, 0.14, 10)), "#7290a2", lw * 0.6, "#46606e");
    paint(ctx, polyFn([[-s * 0.62, 0], [-s * 0.56, -s * 0.85], [-s * 0.2, -s * 0.9], [-s * 0.24, -s * 0.14]]), "#8f8774", lw, "#5f5846");
    paint(ctx, polyFn([[s * 0.62, 0], [s * 0.56, -s * 0.85], [s * 0.2, -s * 0.9], [s * 0.24, -s * 0.14]]), "#8f8774", lw, "#5f5846");
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = lighten("#8f8774", 0.3);
    ctx.fillRect(-s * 0.52, -s * 0.8, s * 0.08, s * 0.6);
    ctx.restore();
    paint(ctx, rectFn(-s * 0.2, -s * 0.94, s * 0.4, s * 0.08), "#7290a2", lw * 0.5, "#46606e");
    paint(ctx, polyFn([[-s * 0.2, -s * 0.88], [s * 0.2, -s * 0.88], [s * 0.24, -s * 0.08], [-s * 0.24, -s * 0.08]]), "#9fc0cf", lw * 0.6, "#5b7f91");
    ctx.save();
    ctx.strokeStyle = "#e6f2f7";
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(0.7, lw * 0.6);
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.14 + i * s * 0.09 + (rng() - 0.5) * s * 0.04;
      ctx.beginPath();
      ctx.moveTo(x, -s * 0.85);
      ctx.lineTo(x + s * 0.02, -s * 0.14);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#e6f2f7";
    for (const [dx, dy, r] of [[-0.2, -0.1, 0.12], [0.18, -0.08, 0.14], [0, -0.16, 0.1]]) {
      ctx.beginPath();
      ctx.ellipse(dx * s, dy * s, r * s, r * s * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  g_shipwreck: (ctx, s, rng, lw) => {
    paint(ctx, blobFn(iblob(0, -s * 0.02, s * 0.6, s * 0.14, rng, 0.14, 10)), "#7290a2", lw * 0.55, "#46606e");
    ctx.save();
    ctx.strokeStyle = "#4a3320";
    ctx.lineWidth = Math.max(1, lw);
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, -s * 0.4);
    ctx.lineTo(s * 0.02, -s * 0.92);
    ctx.stroke();
    ctx.restore();
    paint(ctx, polyFn([[s * 0, -s * 0.88], [s * 0.26, -s * 0.62], [s * 0.06, -s * 0.56], [s * 0.12, -s * 0.72]]), "#e8ddc0", lw * 0.6, "#9a8c66");
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.52, -s * 0.02);
      c.quadraticCurveTo(-s * 0.52, -s * 0.34, -s * 0.36, -s * 0.52);
      c.lineTo(-s * 0.24, -s * 0.36);
      c.lineTo(-s * 0.04, -s * 0.42);
      c.lineTo(s * 0.4, -s * 0.1);
      c.lineTo(s * 0.34, s * 0.03);
      c.closePath();
    }, "#6a4a2a", lw, "#3a2a18");
    ctx.save();
    ctx.strokeStyle = "#3a2a18";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = Math.max(0.5, lw * 0.45);
    ctx.beginPath();
    ctx.moveTo(-s * 0.46, -s * 0.16);
    ctx.lineTo(s * 0.3, -s * 0.02);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.44, -s * 0.3);
    ctx.lineTo(s * 0.08, -s * 0.14);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten("#6a4a2a", 0.3);
    ctx.beginPath();
    ctx.ellipse(-s * 0.36, -s * 0.36, s * 0.05, s * 0.1, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "#4a3320";
    ctx.lineWidth = Math.max(0.8, lw * 0.7);
    for (const [x0, y1] of [[0.48, 0.26], [0.58, 0.2], [0.66, 0.13]]) {
      ctx.beginPath();
      ctx.moveTo(x0 * s, -s * 0.01);
      ctx.quadraticCurveTo(x0 * s - s * 0.05, -y1 * s, x0 * s - s * 0.11, -y1 * s + s * 0.04);
      ctx.stroke();
    }
    ctx.restore();
  },
  g_hot_spring: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.5);
    paint(ctx, blobFn(iblob(0, -s * 0.12, s * 0.5, s * 0.2, rng, 0.12, 11)), "#c9b586", lw, "#8a7448");
    paint(ctx, ellipseFn(0, -s * 0.13, s * 0.34, s * 0.13), "#b6a680", lw * 0.5, "#8a7448");
    paint(ctx, ellipseFn(0, -s * 0.14, s * 0.26, s * 0.1), "#6fa8a0", lw * 0.6, "#3f6b64");
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = lighten("#6fa8a0", 0.35);
    ctx.beginPath();
    ctx.ellipse(-s * 0.08, -s * 0.16, s * 0.1, s * 0.035, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "#e6f2f7";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = Math.max(0.5, lw * 0.4);
    for (const dx of [-0.1, 0.08]) {
      ctx.beginPath();
      ctx.arc(dx * s, -s * 0.13, s * 0.02, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "#e6f2f7";
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, lw * 0.9);
    ctx.lineCap = "round";
    for (const dx of [-0.14, 0.02, 0.16]) {
      const x = dx * s + (rng() - 0.5) * s * 0.05;
      const top = s * (0.55 + rng() * 0.2);
      ctx.beginPath();
      ctx.moveTo(x, -s * 0.2);
      ctx.bezierCurveTo(x - s * 0.08, -s * 0.35, x + s * 0.08, -top + s * 0.15, x - s * 0.03, -top);
      ctx.stroke();
    }
    ctx.restore();
  },
  g_shrine: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.34);
    paint(ctx, rectFn(-s * 0.16, -s * 0.16, s * 0.32, s * 0.16), "#9a9488", lw * 0.8, "#5f5a4d");
    paint(ctx, rectFn(-s * 0.13, -s * 0.62, s * 0.26, s * 0.46), "#b7a880", lw, "#6f5c3c");
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten("#b7a880", 0.32);
    ctx.fillRect(-s * 0.11, -s * 0.6, s * 0.04, s * 0.42);
    ctx.restore();
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.07, -s * 0.22);
      c.lineTo(-s * 0.07, -s * 0.42);
      c.quadraticCurveTo(0, -s * 0.52, s * 0.07, -s * 0.42);
      c.lineTo(s * 0.07, -s * 0.22);
      c.closePath();
    }, "#2f2a24", lw * 0.5, "#4a4030");
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#f0c35c";
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.34, s * 0.09, s * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, -s * 0.31, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    paint(ctx, polyFn([[-s * 0.2, -s * 0.6], [0, -s * 0.82], [s * 0.2, -s * 0.6]]), "#5f6f78", lw);
  }
};

// ../atlas/src/assets-batch5.ts
var GOUACHE_ASSETS_BATCH5 = [
  { key: "g_mountain", name: "Berg", category: "landmark" },
  { key: "g_mountain_snow", name: "Schneeberg", category: "landmark" },
  { key: "g_hill", name: "Hügel", category: "landmark" },
  { key: "g_volcano", name: "Vulkan", category: "landmark" },
  { key: "g_mountain_range", name: "Gebirgskette", category: "landmark" },
  { key: "g_cliff", name: "Klippe", category: "landmark" },
  { key: "g_rock", name: "Fels", category: "prop" },
  { key: "g_cloud", name: "Wolke", category: "prop" },
  { key: "g_lake", name: "See", category: "landmark" },
  { key: "g_grass_tuft", name: "Grasbüschel", category: "flora" },
  { key: "g_swamp_tuft", name: "Sumpf", category: "flora" },
  { key: "g_dunes", name: "Dünen", category: "landmark" },
  { key: "g_beanstalk", name: "Bohnenranke", category: "flora" },
  { key: "g_giant_root", name: "Weltenwurzel", category: "flora" },
  { key: "g_city", name: "Stadt", category: "structure" },
  { key: "g_harbor", name: "Hafen", category: "structure" },
  { key: "g_temple", name: "Tempel", category: "structure" },
  { key: "g_wall", name: "Stadtmauer", category: "structure" },
  { key: "g_gate", name: "Stadttor", category: "structure" },
  { key: "g_root_knot", name: "Wurzelknoten", category: "prop" }
];
var GLYPH_TO_GOUACHE = {
  mountain: "g_mountain",
  mountain_snow: "g_mountain_snow",
  hill: "g_hill",
  volcano: "g_volcano",
  mountain_range: "g_mountain_range",
  cliff: "g_cliff",
  rock: "g_rock",
  cloud: "g_cloud",
  tree: "g_oak",
  water: "g_lake",
  pine: "g_pine",
  grass: "g_grass_tuft",
  swamp: "g_swamp_tuft",
  desert: "g_dunes",
  beanstalk: "g_beanstalk",
  giant_root: "g_giant_root",
  city: "g_city",
  village: "g_house",
  ruin: "g_ruin",
  castle: "g_keep",
  tower: "g_tower",
  bridge: "g_bridge",
  harbor: "g_harbor",
  temple: "g_temple",
  tent: "g_tent",
  stall: "g_stall",
  wall: "g_wall",
  gate: "g_gate",
  root_knot: "g_root_knot"
};
var STONE = "#9a8a68";
var STONE_DARK = "#6f6046";
var SNOW = "#eef1f2";
var BATCH5_RECIPES = {
  g_mountain: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.06, s * 0.02, s * 0.62);
    paint(ctx, polyFn([[-s * 0.62, 0], [-s * 0.08, -s], [0, -s], [0, 0]]), STONE, lw, STONE_DARK);
    paint(ctx, polyFn([[0, 0], [0, -s], [s * 0.08, -s * 0.92], [s * 0.62, 0]]), "#7c6d4f", lw, STONE_DARK);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten(STONE, 0.3);
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.08, -s * 0.62);
    ctx.lineTo(-s * 0.16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  g_mountain_snow: (ctx, s, rng, lw) => {
    BATCH5_RECIPES.g_mountain(ctx, s, rng, lw);
    paint(ctx, polyFn([[-s * 0.22, -s * 0.66], [-s * 0.06, -s], [s * 0.05, -s * 0.94], [s * 0.2, -s * 0.62], [s * 0.05, -s * 0.7], [-s * 0.08, -s * 0.58]]), SNOW, lw * 0.8, "#b9c4cc");
  },
  g_hill: (ctx, s, rng, lw) => {
    shadow(ctx, s * 0.04, s * 0.02, s * 0.58);
    paint(ctx, blobFn(iblob(0, -s * 0.26, s * 0.58, s * 0.3, rng, 0.08, 10)), "#8aa65e", lw, "#59703a");
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = lighten("#8aa65e", 0.3);
    ctx.beginPath();
    ctx.ellipse(-s * 0.18, -s * 0.34, s * 0.22, s * 0.12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  g_volcano: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.05, s * 0.02, s * 0.6);
    paint(ctx, polyFn([[-s * 0.58, 0], [-s * 0.16, -s * 0.86], [s * 0.16, -s * 0.86], [s * 0.58, 0]]), "#6b5344", lw, "#43332a");
    paint(ctx, ellipseFn(0, -s * 0.86, s * 0.16, s * 0.06), "#b3492f", lw * 0.8, "#7c2c1c");
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#c7c0b2";
    for (const [dx, dy, r] of [[0.02, 1.12, 0.1], [0.12, 1.28, 0.13], [0, 1.42, 0.16]]) {
      ctx.beginPath();
      ctx.arc(dx * s, -dy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  g_mountain_range: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.05, s * 0.02, s * 0.75);
    paint(ctx, polyFn([[-s * 0.9, 0], [-s * 0.55, -s * 0.62], [-s * 0.2, 0]]), "#8a7a5c", lw, STONE_DARK);
    paint(ctx, polyFn([[s * 0.1, 0], [s * 0.5, -s * 0.7], [s * 0.9, 0]]), "#8a7a5c", lw, STONE_DARK);
    paint(ctx, polyFn([[-s * 0.45, 0], [0, -s], [s * 0.45, 0]]), STONE, lw, STONE_DARK);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten(STONE, 0.3);
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, 0);
    ctx.lineTo(0, -s * 0.66);
    ctx.lineTo(-s * 0.1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  g_cliff: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.08, s * 0.02, s * 0.55);
    paint(ctx, polyFn([[-s * 0.5, 0], [-s * 0.44, -s * 0.72], [s * 0.3, -s * 0.72], [s * 0.42, -s * 0.5], [s * 0.34, 0]]), STONE, lw, STONE_DARK);
    paint(ctx, polyFn([[-s * 0.44, -s * 0.72], [-s * 0.3, -s * 0.84], [s * 0.44, -s * 0.84], [s * 0.3, -s * 0.72]]), "#8aa65e", lw * 0.8, "#59703a");
    ctx.save();
    ctx.strokeStyle = STONE_DARK;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(0.5, lw * 0.7);
    for (const dx of [-0.22, 0, 0.2]) {
      ctx.beginPath();
      ctx.moveTo(dx * s, -s * 0.66);
      ctx.lineTo(dx * s + s * 0.05, -s * 0.14);
      ctx.stroke();
    }
    ctx.restore();
  },
  g_rock: (ctx, s, rng, lw) => {
    shadow(ctx, s * 0.03, s * 0.02, s * 0.42);
    paint(ctx, blobFn(iblob(0, -s * 0.26, s * 0.4, s * 0.28, rng, 0.14, 9)), "#98907e", lw, "#5f584a");
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten("#98907e", 0.3);
    ctx.beginPath();
    ctx.ellipse(-s * 0.12, -s * 0.34, s * 0.14, s * 0.09, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  g_cloud: (ctx, s, _rng, lw) => {
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.52, -s * 0.34);
      c.quadraticCurveTo(-s * 0.66, -s * 0.34, -s * 0.6, -s * 0.5);
      c.quadraticCurveTo(-s * 0.56, -s * 0.68, -s * 0.34, -s * 0.62);
      c.quadraticCurveTo(-s * 0.26, -s * 0.84, -s * 0.02, -s * 0.8);
      c.quadraticCurveTo(s * 0.22, -s * 0.8, s * 0.26, -s * 0.62);
      c.quadraticCurveTo(s * 0.52, -s * 0.66, s * 0.56, -s * 0.46);
      c.quadraticCurveTo(s * 0.58, -s * 0.34, s * 0.42, -s * 0.34);
      c.closePath();
    }, "#f2f0e6", lw * 0.9, "#a9b0b6");
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#c3c9cd";
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, -s * 0.38, s * 0.4, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  g_lake: (ctx, s, _rng, lw) => {
    paint(ctx, ellipseFn(0, -s * 0.22, s * 0.58, s * 0.3), "#7fa8bc", lw, "#4f7488");
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = lighten("#7fa8bc", 0.4);
    ctx.lineWidth = Math.max(0.6, lw * 0.8);
    ctx.lineCap = "round";
    for (const [dx, dy, w] of [[-0.2, 0.24, 0.22], [0.08, 0.16, 0.26], [-0.05, 0.32, 0.18]]) {
      ctx.beginPath();
      ctx.moveTo((dx - w / 2) * s, -dy * s);
      ctx.quadraticCurveTo(dx * s, -(dy + 0.04) * s, (dx + w / 2) * s, -dy * s);
      ctx.stroke();
    }
    ctx.restore();
  },
  g_grass_tuft: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.01, s * 0.3);
    ctx.save();
    ctx.lineCap = "round";
    for (const [dx, tip, lean] of [[-0.18, 0.62, -0.1], [-0.06, 0.82, -0.02], [0.06, 0.74, 0.05], [0.18, 0.56, 0.12], [0, 0.5, -0.16]]) {
      paint(ctx, (c) => {
        c.beginPath();
        c.moveTo(dx * s - s * 0.035, 0);
        c.quadraticCurveTo((dx + lean) * s - s * 0.02, -tip * s * 0.6, (dx + lean) * s, -tip * s);
        c.quadraticCurveTo((dx + lean) * s + s * 0.02, -tip * s * 0.6, dx * s + s * 0.035, 0);
        c.closePath();
      }, "#7a9a4a", lw * 0.6, "#4d6630");
    }
    ctx.restore();
  },
  g_swamp_tuft: (ctx, s, rng, lw) => {
    paint(ctx, ellipseFn(0, -s * 0.1, s * 0.44, s * 0.14), "#77906e", lw * 0.8, "#4c6247");
    for (const dx of [-0.2, -0.02, 0.18]) {
      paint(ctx, (c) => {
        c.beginPath();
        c.moveTo(dx * s - s * 0.02, -s * 0.08);
        c.lineTo(dx * s, -s * (0.5 + rng() * 0.2));
        c.lineTo(dx * s + s * 0.02, -s * 0.08);
        c.closePath();
      }, "#5e7850", lw * 0.6, "#3c5136");
      ctx.save();
      ctx.fillStyle = "#6b5a3a";
      ctx.beginPath();
      ctx.ellipse(dx * s, -s * 0.52, s * 0.035, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
  g_dunes: (ctx, s, _rng, lw) => {
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.62, 0);
      c.quadraticCurveTo(-s * 0.3, -s * 0.5, 0, -s * 0.18);
      c.lineTo(0, 0);
      c.closePath();
    }, "#d9bd7f", lw, "#a58a50");
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.08, 0);
      c.quadraticCurveTo(s * 0.26, -s * 0.42, s * 0.62, 0);
      c.closePath();
    }, "#cbae6f", lw, "#a58a50");
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten("#d9bd7f", 0.3);
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, 0);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.36, -s * 0.06, -s * 0.16);
    ctx.lineTo(-s * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  g_beanstalk: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.08, s * 0.02, s * 0.34);
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.1, 0);
      c.bezierCurveTo(-s * 0.34, -s * 0.3, s * 0.26, -s * 0.5, -s * 0.02, -s * 0.74);
      c.quadraticCurveTo(-s * 0.14, -s * 0.86, -s * 0.02, -s * 0.98);
      c.quadraticCurveTo(s * 0.06, -s * 0.86, s * 0.02, -s * 0.72);
      c.bezierCurveTo(s * 0.3, -s * 0.5, -s * 0.22, -s * 0.32, s * 0.06, 0);
      c.closePath();
    }, "#5f9a4a", lw, "#33531f");
    for (const [dx, dy, r, a] of [[-0.24, 0.36, 0.14, -0.5], [0.22, 0.55, 0.12, 0.6], [-0.12, 0.8, 0.1, -0.4]]) {
      paint(ctx, ellipseFn(dx * s, -dy * s, r * s, r * s * 0.55), "#74ad55", lw * 0.6, "#33531f");
      void a;
    }
  },
  g_giant_root: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.02, s * 0.02, s * 0.52);
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.08, -s * 0.95);
      c.lineTo(s * 0.08, -s * 0.95);
      c.quadraticCurveTo(s * 0.1, -s * 0.5, s * 0.34, -s * 0.14);
      c.quadraticCurveTo(s * 0.44, 0, s * 0.28, 0);
      c.quadraticCurveTo(s * 0.14, -s * 0.06, s * 0.05, -s * 0.22);
      c.quadraticCurveTo(s * 0.02, -s * 0.04, -s * 0.06, 0);
      c.quadraticCurveTo(-s * 0.2, 0, -s * 0.16, -s * 0.16);
      c.quadraticCurveTo(-s * 0.3, -s * 0.04, -s * 0.42, 0);
      c.quadraticCurveTo(-s * 0.56, 0, -s * 0.44, -s * 0.18);
      c.quadraticCurveTo(-s * 0.18, -s * 0.5, -s * 0.08, -s * 0.95);
      c.closePath();
    }, "#8a6a42", lw, "#54401f");
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = lighten("#8a6a42", 0.3);
    ctx.fillRect(-s * 0.06, -s * 0.9, s * 0.05, s * 0.6);
    ctx.restore();
  },
  g_city: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.66);
    paint(ctx, rectFn(-s * 0.6, -s * 0.4, s * 1.2, s * 0.4), "#c9b98f", lw, "#6f5c3c");
    for (const dx of [-0.6, 0.6]) {
      paint(ctx, rectFn(dx * s - s * 0.1, -s * 0.62, s * 0.2, s * 0.62), "#bcac80", lw, "#6f5c3c");
      paint(ctx, polyFn([[dx * s - s * 0.14, -s * 0.62], [dx * s, -s * 0.8], [dx * s + s * 0.14, -s * 0.62]]), "#8a3526", lw * 0.8);
    }
    paint(ctx, rectFn(-s * 0.2, -s * 0.66, s * 0.4, s * 0.3), "#d2c49a", lw * 0.8, "#6f5c3c");
    paint(ctx, polyFn([[-s * 0.26, -s * 0.66], [0, -s * 0.92], [s * 0.26, -s * 0.66]]), "#a8432e", lw * 0.8);
    ctx.save();
    ctx.fillStyle = "#5a4630";
    ctx.fillRect(-s * 0.05, -s * 0.24, s * 0.1, s * 0.24);
    ctx.restore();
  },
  g_harbor: (ctx, s, _rng, lw) => {
    paint(ctx, ellipseFn(0, -s * 0.14, s * 0.5, s * 0.18), "#7fa8bc", lw * 0.8, "#4f7488");
    paint(ctx, rectFn(-s * 0.5, -s * 0.34, s * 0.34, s * 0.2), "#9c7a4e", lw, "#5a3f22");
    ctx.save();
    ctx.strokeStyle = "#3a3026";
    ctx.lineWidth = Math.max(1, lw);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s * 0.14, -s * 0.9);
    ctx.lineTo(s * 0.14, -s * 0.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.14, -s * 0.32, s * 0.18, 0.25, Math.PI - 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.02, -s * 0.74);
    ctx.lineTo(s * 0.26, -s * 0.74);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.14, -s * 0.94, s * 0.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
  g_temple: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.58);
    paint(ctx, rectFn(-s * 0.5, -s * 0.12, s, s * 0.12), "#cfc3a0", lw, "#6f5c3c");
    for (const dx of [-0.36, -0.12, 0.12, 0.36]) {
      paint(ctx, rectFn(dx * s - s * 0.05, -s * 0.6, s * 0.1, s * 0.48), "#ddd2b2", lw * 0.7, "#6f5c3c");
    }
    paint(ctx, rectFn(-s * 0.5, -s * 0.7, s, s * 0.1), "#cfc3a0", lw, "#6f5c3c");
    paint(ctx, polyFn([[-s * 0.56, -s * 0.7], [0, -s * 0.95], [s * 0.56, -s * 0.7]]), "#c2b28a", lw, "#6f5c3c");
  },
  g_wall: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.6);
    paint(ctx, rectFn(-s * 0.6, -s * 0.42, s * 1.2, s * 0.42), "#b3a687", lw, "#665a42");
    for (let i = 0; i < 4; i++) {
      paint(ctx, rectFn(-s * 0.6 + i * s * 0.34, -s * 0.56, s * 0.16, s * 0.15), "#b3a687", lw * 0.7, "#665a42");
    }
    ctx.save();
    ctx.strokeStyle = "#665a42";
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = Math.max(0.5, lw * 0.6);
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.2);
    ctx.lineTo(s * 0.6, -s * 0.2);
    ctx.stroke();
    ctx.restore();
  },
  g_gate: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.56);
    for (const dx of [-1, 1]) {
      paint(ctx, rectFn(dx * s * 0.42 - s * 0.13, -s * 0.78, s * 0.26, s * 0.78), "#bcac80", lw, "#6f5c3c");
      paint(ctx, polyFn([[dx * s * 0.42 - s * 0.18, -s * 0.78], [dx * s * 0.42, -s * 0.98], [dx * s * 0.42 + s * 0.18, -s * 0.78]]), "#8a3526", lw * 0.8);
    }
    paint(ctx, rectFn(-s * 0.3, -s * 0.62, s * 0.6, s * 0.16), "#b3a687", lw * 0.8, "#665a42");
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.2, 0);
      c.lineTo(-s * 0.2, -s * 0.3);
      c.quadraticCurveTo(0, -s * 0.52, s * 0.2, -s * 0.3);
      c.lineTo(s * 0.2, 0);
      c.closePath();
    }, "#4a3a26", lw * 0.8, "#2c2113");
  },
  g_root_knot: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.42);
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.3, 0);
      c.quadraticCurveTo(-s * 0.4, -s * 0.1, -s * 0.26, -s * 0.2);
      c.quadraticCurveTo(-s * 0.34, -s * 0.52, -s * 0.08, -s * 0.6);
      c.quadraticCurveTo(s * 0.2, -s * 0.66, s * 0.28, -s * 0.4);
      c.quadraticCurveTo(s * 0.44, -s * 0.16, s * 0.28, 0);
      c.closePath();
    }, "#8a6a42", lw, "#54401f");
    ctx.save();
    ctx.strokeStyle = "#54401f";
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(0.5, lw * 0.7);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.14, -s * 0.42);
    ctx.quadraticCurveTo(0, -s * 0.3, s * 0.12, -s * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -s * 0.2);
    ctx.quadraticCurveTo(s * 0.06, -s * 0.12, s * 0.16, -s * 0.2);
    ctx.stroke();
    ctx.restore();
  }
};

// ../atlas/src/assets.ts
var GOUACHE_CATEGORY_LABELS = {
  flora: "Flora",
  structure: "Bauwerke",
  landmark: "Landmarken",
  vehicle: "Fahrzeuge",
  market: "Markt",
  prop: "Deko"
};
var GOUACHE_ASSETS = [
  { key: "g_oak", name: "Eiche", category: "flora" },
  { key: "g_pine", name: "Nadelbaum", category: "flora" },
  { key: "g_bush", name: "Busch", category: "flora" },
  { key: "g_mushroom", name: "Riesenpilz", category: "flora" },
  { key: "g_house", name: "Haus", category: "structure" },
  { key: "g_tower", name: "Turm", category: "structure" },
  { key: "g_keep", name: "Bergfried", category: "structure" },
  { key: "g_church", name: "Kirche", category: "structure" },
  { key: "g_windmill", name: "Windmühle", category: "structure" },
  { key: "g_watermill", name: "Wassermühle", category: "structure" },
  { key: "g_tent", name: "Zelt", category: "structure" },
  { key: "g_ruin", name: "Ruine", category: "structure" },
  { key: "g_signal_tower", name: "Signalturm", category: "structure" },
  { key: "g_bridge", name: "Steinbrücke", category: "structure" },
  { key: "g_lighthouse", name: "Leuchtturm", category: "structure" },
  { key: "g_amphitheater", name: "Amphitheater", category: "structure" },
  { key: "g_burial_mound", name: "Grabhügel", category: "structure" },
  { key: "g_caravanserai", name: "Karawanserei", category: "structure" },
  { key: "g_pyramid", name: "Pyramide", category: "landmark" },
  { key: "g_obelisk", name: "Obelisk", category: "landmark" },
  { key: "g_cave_mouth", name: "Höhleneingang", category: "landmark" },
  { key: "g_magic_crystal", name: "Magiekristall", category: "landmark" },
  { key: "g_stone_circle", name: "Steinkreis", category: "landmark" },
  { key: "g_floating_island", name: "Fliegende Insel", category: "landmark" },
  { key: "g_turtle_castle", name: "Schildkröten-Schloss", category: "landmark" },
  { key: "g_ziggurat", name: "Ziggurat", category: "landmark" },
  { key: "g_portal_arch", name: "Portalbogen", category: "landmark" },
  { key: "g_ship", name: "Schiff", category: "vehicle" },
  { key: "g_cart", name: "Pferdekarren", category: "vehicle" },
  { key: "g_airship", name: "Flugschiff", category: "vehicle" },
  { key: "g_stall", name: "Marktstand", category: "market" },
  { key: "g_well", name: "Brunnen", category: "prop" },
  ...GOUACHE_ASSETS_BATCH4,
  ...GOUACHE_ASSETS_BATCH5
];
var GOUACHE_ASSET_KEYS = GOUACHE_ASSETS.map(
  (a) => a.key
);
var ASSETS_BY_KEY = new Map(GOUACHE_ASSETS.map((a) => [a.key, a]));
function getGouacheAsset(key) {
  return key ? ASSETS_BY_KEY.get(key) : void 0;
}
function listGouacheAssetsByCategory(cat) {
  return GOUACHE_ASSETS.filter((a) => a.category === cat);
}
function tree(ctx, s, rng, lw, base, dark, hi) {
  const cy = -s * 0.55;
  shadow(ctx, 0, s * 0.02, s * 0.5);
  paint(ctx, rectFn(-s * 0.07, -s * 0.3, s * 0.14, s * 0.34), "#7a5230", lw * 0.8, "#4a3320");
  const blob = iblob(0, cy, s * 0.5, s * 0.46, rng, 0.26, 12);
  const P = blobFn(blob);
  ctx.save();
  ctx.fillStyle = base;
  P(ctx);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = dark;
  ctx.globalAlpha = 0.5;
  blobFn(blob.map((p) => [p[0] + s * 0.08, p[1] + s * 0.12]))(ctx);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = hi;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(-s * 0.13, cy - s * 0.15, s * 0.2, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = darken(base, 0.5);
  ctx.lineWidth = Math.max(0.6, lw);
  ctx.lineJoin = "round";
  P(ctx);
  ctx.stroke();
  ctx.restore();
}
var RECIPES = {
  g_oak: (ctx, s, rng, lw) => tree(ctx, s, rng, lw, "#5f9a4a", "#33613a", "#aacf7a"),
  g_bush: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.4);
    const b = iblob(0, -s * 0.24, s * 0.42, s * 0.3, rng, 0.3, 10);
    paint(ctx, blobFn(b), "#5c8f43", lw);
  },
  g_pine: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.42);
    paint(ctx, rectFn(-s * 0.06, -s * 0.28, s * 0.12, s * 0.3), "#6a4a2a", lw * 0.8);
    for (let i = 0; i < 3; i++) {
      const y = -s * (0.25 + i * 0.22), w = s * (0.42 - i * 0.1);
      paint(ctx, polyFn([[-w, y], [0, y - s * 0.34], [w, y]]), i === 0 ? "#3f6d39" : "#478043", lw);
    }
  },
  g_mushroom: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.42);
    paint(ctx, rectFn(-s * 0.13, -s * 0.5, s * 0.26, s * 0.52), "#e6dcc4", lw);
    paint(ctx, blobFn(iblob(0, -s * 0.5, s * 0.5, s * 0.26, () => 0.5, 0.05, 10)), "#b4402f", lw);
    ctx.save();
    ctx.fillStyle = "#f0e6cf";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * s * 0.24, -s * 0.56, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  g_house: (ctx, s, _rng, lw) => {
    const w = s * 0.95, h = s * 0.62;
    shadow(ctx, 0, s * 0.04, s * 0.6);
    paint(ctx, rectFn(-w / 2, -h, w, h), "#dcc79c", lw);
    paint(ctx, polyFn([[-w * 0.62, -h + 2], [0, -h * 1.7], [w * 0.62, -h + 2]]), "#a8432e", lw);
    ctx.save();
    ctx.fillStyle = "#5a4026";
    ctx.fillRect(-s * 0.08, -h * 0.55, s * 0.16, h * 0.55);
    ctx.restore();
  },
  g_tower: (ctx, s, _rng, lw) => {
    const w = s * 0.5, h = s * 0.95;
    shadow(ctx, 0, s * 0.03, s * 0.42);
    paint(ctx, rectFn(-w / 2, -h, w, h), "#cbb98e", lw);
    paint(ctx, polyFn([[-w * 0.72, -h + 1], [0, -h * 1.5], [w * 0.72, -h + 1]]), "#8a3526", lw);
  },
  g_keep: (ctx, s, _rng, lw) => {
    const w = s * 1.1, h = s * 1.1;
    shadow(ctx, 0, s * 0.05, s * 0.8);
    for (const sx of [-1, 1]) {
      paint(ctx, rectFn(sx * w * 0.42 - s * 0.13, -h * 1.15, s * 0.26, h * 1.15), "#bcac80", lw);
      paint(ctx, polyFn([[sx * w * 0.42 - s * 0.2, -h * 1.15], [sx * w * 0.42, -h * 1.45], [sx * w * 0.42 + s * 0.2, -h * 1.15]]), "#7f3222", lw);
    }
    paint(ctx, rectFn(-w / 2, -h, w, h), "#c6b487", lw);
    for (let i = 0; i < 3; i++) paint(ctx, rectFn(-w / 2 + w * (i / 2) - s * 0.12, -h - s * 0.16, s * 0.24, s * 0.18), "#c6b487", lw * 0.8);
    ctx.save();
    ctx.fillStyle = "#4a3722";
    ctx.fillRect(-s * 0.14, -h * 0.5, s * 0.28, h * 0.5);
    ctx.restore();
  },
  g_church: (ctx, s, _rng, lw) => {
    const w = s * 0.85, h = s * 0.6;
    shadow(ctx, 0, s * 0.04, s * 0.6);
    paint(ctx, rectFn(-w / 2, -h, w, h), "#d7cba6", lw);
    paint(ctx, polyFn([[-w * 0.6, -h], [0, -h * 1.5], [w * 0.6, -h]]), "#7a4a2a", lw);
    const tx = -w * 0.34, tw = s * 0.34, th = s * 1.15;
    paint(ctx, rectFn(tx - tw / 2, -th, tw, th), "#cdbd95", lw);
    paint(ctx, polyFn([[tx - tw * 0.62, -th], [tx, -th - s * 0.5], [tx + tw * 0.62, -th]]), "#5f6f78", lw);
    ctx.save();
    ctx.strokeStyle = "#4a4030";
    ctx.lineWidth = Math.max(1, lw);
    ctx.beginPath();
    ctx.moveTo(tx, -th - s * 0.5);
    ctx.lineTo(tx, -th - s * 0.74);
    ctx.moveTo(tx - s * 0.08, -th - s * 0.66);
    ctx.lineTo(tx + s * 0.08, -th - s * 0.66);
    ctx.stroke();
    ctx.restore();
  },
  g_windmill: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.44);
    paint(ctx, polyFn([[-s * 0.3, 0], [-s * 0.22, -s], [s * 0.22, -s], [s * 0.3, 0]]), "#cdbd95", lw);
    paint(ctx, polyFn([[-s * 0.28, -s], [0, -s * 1.28], [s * 0.28, -s]]), "#7a4a2a", lw);
    ctx.save();
    ctx.translate(0, -s * 0.75);
    ctx.strokeStyle = "#4a3722";
    ctx.lineWidth = Math.max(1, lw);
    ctx.fillStyle = "#e0d3ad";
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2 + 0.5);
      ctx.fillRect(s * 0.05, -s * 0.03, s * 0.5, s * 0.12);
      ctx.strokeRect(s * 0.05, -s * 0.03, s * 0.5, s * 0.12);
    }
    ctx.restore();
  },
  g_watermill: (ctx, s, _rng, lw) => {
    const h = s * 0.58;
    shadow(ctx, 0, s * 0.04, s * 0.6);
    paint(ctx, blobFn(iblob(s * 0.4, -s * 0.02, s * 0.3, s * 0.1, () => 0.5, 0.12, 8)), "#7290a2", lw * 0.55, "#46606e");
    paint(ctx, rectFn(-s * 0.66, -h, s * 0.78, h), "#cdbd95", lw);
    paint(ctx, polyFn([[-s * 0.76, -h + 1], [-s * 0.27, -h * 1.55], [s * 0.22, -h + 1]]), "#7a4a2a", lw);
    ctx.save();
    ctx.fillStyle = "#5a4026";
    ctx.fillRect(-s * 0.42, -h * 0.55, s * 0.16, h * 0.55);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = lighten("#cdbd95", 0.32);
    ctx.fillRect(-s * 0.6, -h + s * 0.04, s * 0.14, h * 0.34);
    ctx.restore();
    paint(ctx, ellipseFn(s * 0.36, -s * 0.34, s * 0.3, s * 0.3), "#8a5e34", lw, "#4a3320");
    paint(ctx, ellipseFn(s * 0.36, -s * 0.34, s * 0.12, s * 0.12), "#cdbd95", lw * 0.6, "#4a3320");
    ctx.save();
    ctx.strokeStyle = "#4a3320";
    ctx.lineWidth = Math.max(0.8, lw * 0.75);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(s * 0.36 - Math.cos(a) * s * 0.27, -s * 0.34 - Math.sin(a) * s * 0.27);
      ctx.lineTo(s * 0.36 + Math.cos(a) * s * 0.27, -s * 0.34 + Math.sin(a) * s * 0.27);
      ctx.stroke();
    }
    ctx.restore();
  },
  g_tent: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.5);
    paint(ctx, polyFn([[-s * 0.5, 0], [0, -s * 0.9], [s * 0.5, 0]]), "#c99a5a", lw);
    ctx.save();
    ctx.strokeStyle = "#6a4a2a";
    ctx.lineWidth = Math.max(1, lw);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.9);
    ctx.lineTo(0, -s * 0.05);
    ctx.stroke();
    ctx.restore();
  },
  g_ruin: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.55);
    paint(ctx, rectFn(-s * 0.45, -s * 0.5, s * 0.22, s * 0.5), "#b7a880", lw);
    paint(ctx, rectFn(s * 0.05, -s * 0.75, s * 0.2, s * 0.75), "#b0a179", lw);
    paint(ctx, rectFn(-s * 0.1, -s * 0.32, s * 0.12, s * 0.32), "#a99a72", lw);
    ctx.save();
    ctx.strokeStyle = "#6f5c3c";
    ctx.lineWidth = Math.max(0.8, lw * 0.7);
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, -s * 0.5);
    ctx.lineTo(-s * 0.34, -s * 0.62);
    ctx.lineTo(-s * 0.23, -s * 0.5);
    ctx.stroke();
    ctx.restore();
  },
  g_signal_tower: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.42);
    for (const dx of [-0.18, 0.18]) paint(ctx, polyFn([[dx * s - s * 0.04, 0], [dx * s + s * 0.04, 0], [dx * s + s * 0.02, -s * 0.82], [dx * s - s * 0.02, -s * 0.82]]), "#7a5230", lw * 0.65, "#4a3320");
    ctx.save();
    ctx.strokeStyle = "#5a4026";
    ctx.lineWidth = Math.max(0.8, lw * 0.7);
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.22);
    ctx.lineTo(s * 0.2, -s * 0.58);
    ctx.moveTo(s * 0.2, -s * 0.22);
    ctx.lineTo(-s * 0.2, -s * 0.58);
    ctx.stroke();
    ctx.restore();
    paint(ctx, rectFn(-s * 0.3, -s * 0.9, s * 0.6, s * 0.17), "#8a5e34", lw, "#4a3320");
    paint(ctx, polyFn([[-s * 0.2, -s * 0.91], [0, -s * 1.2], [s * 0.2, -s * 0.91]]), "#c96a2f", lw, "#80301d");
    paint(ctx, polyFn([[-s * 0.09, -s * 0.92], [0, -s * 1.1], [s * 0.08, -s * 0.92]]), "#f0c35c", lw * 0.65, "#9a4a22");
  },
  g_bridge: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.62);
    paint(ctx, polyFn([[-s * 0.62, -s * 0.08], [-s * 0.5, -s * 0.46], [s * 0.5, -s * 0.46], [s * 0.62, -s * 0.08], [s * 0.5, s * 0.02], [-s * 0.5, s * 0.02]]), "#b9aa86", lw, "#6f6145");
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.3, s * 0.01);
      c.lineTo(-s * 0.3, -s * 0.1);
      c.quadraticCurveTo(0, -s * 0.4, s * 0.3, -s * 0.1);
      c.lineTo(s * 0.3, s * 0.01);
      c.closePath();
    }, "#4a4638", lw * 0.7, "#5a513d");
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.44 + i * s * 0.29;
      paint(ctx, rectFn(x, -s * 0.5, s * 0.16, s * 0.12), "#c7ba92", lw * 0.45, "#756845");
    }
  },
  g_lighthouse: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.5);
    paint(ctx, blobFn(iblob(0, -s * 0.02, s * 0.42, s * 0.12, rng, 0.2, 9)), "#9a9488", lw * 0.7, "#5f5a4d");
    const half = (t) => s * (0.24 - 0.12 * ((t - 0.04) / 0.92));
    paint(ctx, polyFn([[-half(0.04), -s * 0.04], [-half(0.96), -s * 0.96], [half(0.96), -s * 0.96], [half(0.04), -s * 0.04]]), "#e0d6b4", lw);
    for (const [a, b] of [[0.22, 0.38], [0.56, 0.72]]) {
      paint(ctx, polyFn([[-half(a), -s * a], [-half(b), -s * b], [half(b), -s * b], [half(a), -s * a]]), "#a8432e", lw * 0.55, "#7f2f20");
    }
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = lighten("#e0d6b4", 0.35);
    ctx.fillRect(-s * 0.1, -s * 0.9, s * 0.05, s * 0.8);
    ctx.restore();
    paint(ctx, rectFn(-s * 0.17, -s * 1.02, s * 0.34, s * 0.07), "#6f665a", lw * 0.6);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#f0c35c";
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.1, s * 0.34, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    paint(ctx, rectFn(-s * 0.09, -s * 1.16, s * 0.18, s * 0.14), "#f0c35c", lw * 0.6, "#9a4a22");
    paint(ctx, polyFn([[-s * 0.13, -s * 1.16], [0, -s * 1.32], [s * 0.13, -s * 1.16]]), "#8a3526", lw);
  },
  g_amphitheater: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.04, s * 0.75);
    paint(ctx, ellipseFn(0, -s * 0.34, s * 0.64, s * 0.36), "#c1b28a", lw, "#75664a");
    paint(ctx, ellipseFn(0, -s * 0.4, s * 0.46, s * 0.24), "#a99a72", lw * 0.7, "#6f5c3c");
    paint(ctx, ellipseFn(0, -s * 0.42, s * 0.3, s * 0.14), "#c8a75a", lw * 0.6, "#8a6f3a");
    ctx.save();
    ctx.fillStyle = "#4a4030";
    for (let i = -2; i <= 2; i++) {
      const x = i * s * 0.22, y = -s * 0.05 - Math.abs(i) * s * 0.05;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.05, y);
      ctx.lineTo(x - s * 0.05, y - s * 0.1);
      ctx.quadraticCurveTo(x, y - s * 0.18, x + s * 0.05, y - s * 0.1);
      ctx.lineTo(x + s * 0.05, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = lighten("#c1b28a", 0.35);
    ctx.lineWidth = Math.max(1, lw * 1.3);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.34, s * 0.56, s * 0.3, 0, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.restore();
  },
  g_burial_mound: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.6);
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.58, 0);
      c.quadraticCurveTo(-s * 0.55, -s * 0.52, 0, -s * 0.56);
      c.quadraticCurveTo(s * 0.55, -s * 0.52, s * 0.58, 0);
      c.closePath();
    }, "#6b8a4f", lw, "#41582f");
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#a9c77a";
    ctx.beginPath();
    ctx.ellipse(-s * 0.16, -s * 0.4, s * 0.22, s * 0.1, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "#9a9488";
    ctx.strokeStyle = "#5f5a4d";
    ctx.lineWidth = Math.max(0.6, lw * 0.5);
    for (const [dx, dy] of [[-0.3, -0.48], [0, -0.58], [0.3, -0.48]]) {
      const x = (dx + (rng() - 0.5) * 0.05) * s;
      ctx.beginPath();
      ctx.arc(x, dy * s, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    paint(ctx, polyFn([[-s * 0.2, 0], [-s * 0.16, -s * 0.3], [s * 0.16, -s * 0.3], [s * 0.2, 0]]), "#9a9488", lw * 0.8, "#5f5a4d");
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.1, 0);
      c.lineTo(-s * 0.1, -s * 0.12);
      c.quadraticCurveTo(0, -s * 0.26, s * 0.1, -s * 0.12);
      c.lineTo(s * 0.1, 0);
      c.closePath();
    }, "#2f2a24", lw * 0.6, "#4a4030");
  },
  g_caravanserai: (ctx, s, _rng, lw) => {
    const w = s * 1.2, h = s * 0.46;
    shadow(ctx, 0, s * 0.04, s * 0.8);
    paint(ctx, rectFn(-w / 2, -h, w, h), "#d0bd8e", lw, "#8a7448");
    for (let i = -2; i <= 2; i++) paint(ctx, rectFn(i * s * 0.26 - s * 0.05, -h - s * 0.1, s * 0.1, s * 0.12), "#d0bd8e", lw * 0.55, "#8a7448");
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten("#d0bd8e", 0.32);
    ctx.fillRect(-w / 2 + s * 0.05, -h + s * 0.04, s * 0.2, s * 0.14);
    ctx.restore();
    for (const sx of [-1, 1]) {
      paint(ctx, rectFn(sx * (w / 2) - s * 0.09, -s * 0.6, s * 0.18, s * 0.6), "#c4b083", lw, "#8a7448");
      paint(ctx, (c) => {
        c.beginPath();
        c.arc(sx * (w / 2), -s * 0.6, s * 0.1, Math.PI, 0);
        c.closePath();
      }, "#5f6f78", lw * 0.7, "#3d4a52");
    }
    paint(ctx, rectFn(-s * 0.21, -s * 0.7, s * 0.42, s * 0.7), "#c9b586", lw, "#8a7448");
    paint(ctx, (c) => {
      c.beginPath();
      c.arc(0, -s * 0.7, s * 0.14, Math.PI, 0);
      c.closePath();
    }, "#5f6f78", lw * 0.7, "#3d4a52");
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.1, 0);
      c.lineTo(-s * 0.1, -s * 0.26);
      c.quadraticCurveTo(0, -s * 0.44, s * 0.1, -s * 0.26);
      c.lineTo(s * 0.1, 0);
      c.closePath();
    }, "#3a3226", lw * 0.6, "#57492f");
  },
  g_pyramid: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.7);
    paint(ctx, polyFn([[-s * 0.7, 0], [0, -s], [s * 0.05, -s], [s * 0.05, 0]]), "#c8a75a", lw);
    paint(ctx, polyFn([[s * 0.05, 0], [s * 0.05, -s], [s * 0.7, 0]]), "#a98640", lw);
  },
  g_obelisk: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.28);
    paint(ctx, polyFn([[-s * 0.12, 0], [-s * 0.08, -s], [0, -s * 1.15], [s * 0.08, -s], [s * 0.12, 0]]), "#9a9488", lw);
    ctx.save();
    ctx.strokeStyle = "#4a4636";
    ctx.lineWidth = Math.max(0.6, lw * 0.6);
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.06, -s * 0.2 * i);
      ctx.lineTo(s * 0.06, -s * 0.2 * i);
      ctx.stroke();
    }
    ctx.restore();
  },
  g_cave_mouth: (ctx, s, rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.55);
    paint(ctx, blobFn(iblob(0, -s * 0.34, s * 0.56, s * 0.42, rng, 0.18, 11)), "#8f8774", lw, "#5f5846");
    paint(ctx, (c) => {
      c.beginPath();
      c.moveTo(-s * 0.28, 0);
      c.lineTo(-s * 0.24, -s * 0.2);
      c.quadraticCurveTo(0, -s * 0.58, s * 0.24, -s * 0.2);
      c.lineTo(s * 0.28, 0);
      c.closePath();
    }, "#2f2a24", lw * 0.8, "#4a4030");
    paint(ctx, blobFn(iblob(-s * 0.22, -s * 0.6, s * 0.16, s * 0.08, () => 0.5, 0.08, 7)), "#5f8a4a", lw * 0.45, "#3a5f35");
    paint(ctx, blobFn(iblob(s * 0.22, -s * 0.52, s * 0.14, s * 0.07, () => 0.5, 0.08, 7)), "#5f8a4a", lw * 0.45, "#3a5f35");
  },
  g_magic_crystal: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.08, s * 0.35, s * 0.42);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#7fcfe0";
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.62, s * 0.46, s * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    paint(ctx, polyFn([[0, -s * 1.25], [s * 0.28, -s * 0.78], [s * 0.18, -s * 0.22], [0, -s * 0.04], [-s * 0.18, -s * 0.22], [-s * 0.28, -s * 0.78]]), "#68b9cf", lw, "#2e6376");
    paint(ctx, polyFn([[0, -s * 1.25], [s * 0.28, -s * 0.78], [0, -s * 0.7]]), lighten("#68b9cf", 0.28), lw * 0.55, "#4f91a2");
    paint(ctx, polyFn([[0, -s * 0.7], [s * 0.18, -s * 0.22], [0, -s * 0.04], [-s * 0.18, -s * 0.22]]), "#4c94b0", lw * 0.55, "#2e6376");
  },
  g_stone_circle: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.04, s * 0.58);
    const stones = [[-0.42, -0.12, 0.16, 0.44], [-0.22, -0.32, 0.14, 0.5], [0, -0.42, 0.16, 0.52], [0.22, -0.32, 0.14, 0.5], [0.42, -0.12, 0.16, 0.44]];
    for (const [x, y, w, h] of stones) paint(ctx, polyFn([[x * s - w * s * 0.5, y * s], [x * s - w * s * 0.38, y * s - h * s * 0.78], [x * s, y * s - h * s], [x * s + w * s * 0.38, y * s - h * s * 0.78], [x * s + w * s * 0.5, y * s]]), "#9a9488", lw, "#5f5a4d");
    ctx.save();
    ctx.strokeStyle = "#6f664f";
    ctx.lineWidth = Math.max(0.7, lw * 0.55);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.18, s * 0.42, s * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },
  g_floating_island: (ctx, s, rng, lw) => {
    shadow(ctx, s * 0.1, s * 0.5, s * 0.55);
    paint(ctx, polyFn([[-s * 0.55, -s * 0.5], [s * 0.55, -s * 0.5], [s * 0.3, -s * 0.05], [0, s * 0.2], [-s * 0.3, -s * 0.05]]), "#7a5a38", lw);
    paint(ctx, blobFn(iblob(0, -s * 0.55, s * 0.55, s * 0.16, rng, 0.18, 10)), "#5f9a4a", lw);
    for (const dx of [-0.28, 0.05, 0.3]) {
      ctx.save();
      ctx.translate(dx * s, -s * 0.5);
      tree(ctx, s * 0.34, () => 0.5, lw * 0.8, "#5f9a4a", "#33613a", "#aacf7a");
      ctx.restore();
    }
  },
  g_turtle_castle: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.05, s * 0.7);
    paint(ctx, blobFn(iblob(0, -s * 0.2, s * 0.6, s * 0.32, () => 0.5, 0.05, 12)), "#5c7a4a", lw);
    for (const dx of [-0.7, -0.35, 0.35, 0.7]) paint(ctx, polyFn([[dx * s - s * 0.06, 0], [dx * s, -s * 0.18], [dx * s + s * 0.06, 0]]), "#4a6640", lw);
    paint(ctx, polyFn([[s * 0.6, -s * 0.15], [s * 0.78, -s * 0.32], [s * 0.72, -s * 0.05]]), "#4a6640", lw);
    paint(ctx, rectFn(-s * 0.24, -s * 0.7, s * 0.48, s * 0.42), "#c6b487", lw);
    for (const sx of [-1, 1]) paint(ctx, rectFn(sx * s * 0.28 - s * 0.08, -s * 0.78, s * 0.16, s * 0.5), "#bcac80", lw);
  },
  g_ziggurat: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.75);
    const tiers = [[0.66, 0, 0.26], [0.48, 0.26, 0.24], [0.31, 0.5, 0.22]];
    for (const [hw, b, ht] of tiers) {
      const y0 = -s * b, y1 = -s * (b + ht), tw = hw * 0.82;
      paint(ctx, polyFn([[-s * hw, y0], [-s * tw, y1], [s * tw, y1], [s * hw, y0]]), "#c8a75a", lw, "#7f6531");
      paint(ctx, polyFn([[s * 0.02, y0], [s * 0.02, y1], [s * tw, y1], [s * hw, y0]]), "#a98640", lw * 0.5, "#7f6531");
    }
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = lighten("#c8a75a", 0.32);
    ctx.beginPath();
    ctx.moveTo(-s * 0.62, -s * 0.03);
    ctx.lineTo(-s * 0.52, -s * 0.24);
    ctx.lineTo(-s * 0.42, -s * 0.24);
    ctx.lineTo(-s * 0.52, -s * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    paint(ctx, rectFn(-s * 0.13, -s * 0.94, s * 0.26, s * 0.22), "#b0563f", lw, "#6e3325");
    paint(ctx, polyFn([[-s * 0.09, 0], [-s * 0.06, -s * 0.72], [s * 0.06, -s * 0.72], [s * 0.09, 0]]), "#e0d3ad", lw * 0.6, "#8a6f3a");
    ctx.save();
    ctx.strokeStyle = "#8a6f3a";
    ctx.lineWidth = Math.max(0.6, lw * 0.5);
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.07, -s * 0.12 * i);
      ctx.lineTo(s * 0.07, -s * 0.12 * i);
      ctx.stroke();
    }
    ctx.restore();
  },
  g_portal_arch: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.03, s * 0.55);
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#9b8fd0";
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.6, s * 0.62, s * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "#8fb7cf";
    ctx.beginPath();
    ctx.moveTo(-s * 0.33, 0);
    ctx.lineTo(-s * 0.33, -s * 0.55);
    ctx.arc(0, -s * 0.55, s * 0.33, Math.PI, 0);
    ctx.lineTo(s * 0.33, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#e6f2f7";
    ctx.lineWidth = Math.max(1, lw);
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.78);
    ctx.quadraticCurveTo(s * 0.12, -s * 0.5, -s * 0.04, -s * 0.12);
    ctx.stroke();
    ctx.restore();
    for (const sx of [-1, 1]) paint(ctx, rectFn(sx * s * 0.415 - s * 0.085, -s * 0.55, s * 0.17, s * 0.55), "#9a9488", lw, "#5f5a4d");
    paint(ctx, (c) => {
      c.beginPath();
      c.arc(0, -s * 0.55, s * 0.5, Math.PI, 0);
      c.lineTo(s * 0.33, -s * 0.55);
      c.arc(0, -s * 0.55, s * 0.33, 0, Math.PI, true);
      c.closePath();
    }, "#9a9488", lw, "#5f5a4d");
    ctx.save();
    ctx.strokeStyle = "#4a4636";
    ctx.lineWidth = Math.max(0.6, lw * 0.5);
    for (const a of [-2.5, -2.05, -1.57, -1.09, -0.64]) {
      const px = Math.cos(a), py = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(px * s * 0.38, -s * 0.55 + py * s * 0.38);
      ctx.lineTo(px * s * 0.45, -s * 0.55 + py * s * 0.45);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = lighten("#9a9488", 0.35);
    ctx.beginPath();
    ctx.ellipse(-s * 0.18, -s * 0.96, s * 0.12, s * 0.05, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  g_ship: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.04, s * 0.5);
    paint(ctx, polyFn([[-s * 0.55, -s * 0.1], [s * 0.55, -s * 0.1], [s * 0.38, s * 0.16], [-s * 0.38, s * 0.16]]), "#7a4f2c", lw);
    ctx.save();
    ctx.strokeStyle = "#4a3320";
    ctx.lineWidth = Math.max(1, lw);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.lineTo(0, -s * 0.95);
    ctx.stroke();
    ctx.restore();
    paint(ctx, polyFn([[0, -s * 0.9], [s * 0.4, -s * 0.32], [0, -s * 0.32]]), "#efe4c6", lw);
  },
  g_airship: (ctx, s, _rng, lw) => {
    shadow(ctx, s * 0.1, s * 0.75, s * 0.4);
    paint(ctx, blobFn(iblob(0, -s * 0.7, s * 0.6, s * 0.34, () => 0.5, 0.04, 12)), "#b0563f", lw);
    ctx.save();
    ctx.fillStyle = "#e8ddc0";
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * s * 0.2 - s * 0.02, -s * 1.04, s * 0.04, s * 0.68);
    ctx.restore();
    paint(ctx, polyFn([[-s * 0.28, -s * 0.32], [s * 0.28, -s * 0.32], [s * 0.2, -s * 0.1], [-s * 0.2, -s * 0.1]]), "#7a4f2c", lw);
  },
  g_stall: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.42);
    ctx.save();
    ctx.strokeStyle = "#6a4a2a";
    ctx.lineWidth = Math.max(1, lw);
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, 0);
    ctx.lineTo(-s * 0.35, -s * 0.5);
    ctx.moveTo(s * 0.35, 0);
    ctx.lineTo(s * 0.35, -s * 0.5);
    ctx.stroke();
    ctx.restore();
    paint(ctx, rectFn(-s * 0.42, -s * 0.64, s * 0.84, s * 0.17), "#c24a3a", lw * 0.7, "#8a2f22");
    ctx.save();
    ctx.fillStyle = "#e8ddc0";
    for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.42 + i * s * 0.28 + s * 0.07, -s * 0.64, s * 0.14, s * 0.17);
    ctx.restore();
  },
  g_cart: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.05, s * 0.5);
    paint(ctx, rectFn(-s * 0.4, -s * 0.45, s * 0.8, s * 0.3), "#8a5e34", lw);
    ctx.save();
    ctx.fillStyle = "#3a2a18";
    ctx.strokeStyle = "#2a1e10";
    ctx.lineWidth = Math.max(1, lw);
    for (const dx of [-0.24, 0.24]) {
      ctx.beginPath();
      ctx.arc(dx * s, -s * 0.05, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  },
  g_well: (ctx, s, _rng, lw) => {
    shadow(ctx, 0, s * 0.02, s * 0.3);
    paint(ctx, (c) => {
      c.beginPath();
      c.ellipse(0, -s * 0.1, s * 0.22, s * 0.14, 0, 0, Math.PI * 2);
    }, "#b6a680", lw);
    ctx.save();
    ctx.strokeStyle = "#5a4026";
    ctx.lineWidth = Math.max(1, lw);
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 0.1);
    ctx.lineTo(-s * 0.26, -s * 0.5);
    ctx.moveTo(s * 0.22, -s * 0.1);
    ctx.lineTo(s * 0.26, -s * 0.5);
    ctx.moveTo(-s * 0.3, -s * 0.5);
    ctx.lineTo(s * 0.3, -s * 0.5);
    ctx.stroke();
    ctx.restore();
  },
  ...BATCH4_RECIPES,
  ...BATCH5_RECIPES
};
function drawGouacheAsset(ctx, key, opts) {
  const recipe = RECIPES[key];
  if (!recipe) return;
  const size = (opts.size ?? 30) * (opts.scale ?? 1);
  const lw = opts.lineWidth ?? 1.4;
  const rng = mulberry32(opts.seed ?? hashStringToSeed(key));
  ctx.save();
  const filters = [];
  if (opts.blur && opts.blur > 0) filters.push(`blur(${opts.blur}px)`);
  if (opts.tint) {
    const hue = Number.isFinite(opts.tint.hue) ? opts.tint.hue : 0;
    const sat = Number.isFinite(opts.tint.saturate) ? opts.tint.saturate : 1;
    if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
    if (sat !== 1) filters.push(`saturate(${Math.max(0, sat)})`);
  }
  if (filters.length) ctx.filter = filters.join(" ");
  ctx.translate(opts.x, opts.y);
  if (opts.rotation) ctx.rotate(opts.rotation);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  recipe(ctx, size, rng, lw);
  ctx.restore();
}
function isGouacheAsset(key) {
  return !!key && key in RECIPES;
}
function gouacheKeyForGlyph(glyphKey) {
  if (!glyphKey) return void 0;
  const mapped = GLYPH_TO_GOUACHE[glyphKey];
  return mapped && mapped in RECIPES ? mapped : void 0;
}

// ../atlas/src/plot-fill-proposal.ts
var ATLAS_PLOT_FILL_PROPOSAL_KIND = "atlas_plot_fill";
var ATLAS_PLOT_FILL_SCHEMA_VERSION = 1;
var TOP_LEVEL_KEYS = [
  "schemaVersion",
  "kind",
  "plotKey",
  "biomeKind",
  "density",
  "seed",
  "assets",
  "notes",
  "rationale"
];
var ASSET_KEYS = [
  "gouacheKey",
  "weight",
  "scaleMin",
  "scaleMax",
  "rotateMin",
  "rotateMax",
  "lineWidth",
  "blur"
];
var EXECUTABLE_KEYS = /* @__PURE__ */ new Set([
  "code",
  "sourcecode",
  "script",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "executable",
  "functionbody",
  "renderfunction",
  "drawfunction",
  "objects",
  "atlasobjects"
]);
var EXECUTABLE_TEXT = [
  /<\s*script\b/i,
  /\b(?:function|class)\s+[A-Za-z_$]/,
  /=>/,
  /\bimport\s+(?:type\s+)?(?:\{|[A-Za-z_$*])/,
  /\bexport\s+(?:default|function|class|const|let|var|\{|\*)/,
  /\b(?:eval|Function|setTimeout|setInterval)\s*\(/,
  /\b(?:require|process|child_process|Deno)\b/
];
var SAFE_PLOT_KEY = /^[A-Za-z0-9:_-]{1,120}$/;
var GOUACHE_KEY_SET = new Set(GOUACHE_ASSET_KEYS);
var BIOME_VALUES = Object.values(BiomeKind);
function add(issues, path, code, message) {
  issues.push({ path, code, message });
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejectUnknown(obj, allowed, path, issues) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      add(issues, `${path}.${key}`, "unexpected_field", `Unexpected field "${key}".`);
    }
  }
}
function scanExecutable(value, path, issues, seen = /* @__PURE__ */ new WeakSet()) {
  if (typeof value === "function") {
    add(issues, path, "executable_code", "Function values are not accepted.");
    return;
  }
  if (typeof value === "string") {
    if (EXECUTABLE_TEXT.some((pattern) => pattern.test(value))) {
      add(issues, path, "executable_code", "Executable source text is not accepted.");
    }
    return;
  }
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanExecutable(entry, `${path}[${index}]`, issues, seen));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (EXECUTABLE_KEYS.has(key.toLowerCase())) {
      add(issues, `${path}.${key}`, "executable_code", `Executable/object field "${key}" is not accepted.`);
    }
    scanExecutable(entry, `${path}.${key}`, issues, seen);
  }
}
function stringValue(obj, key, path, issues, opts = {}) {
  const value = obj[key];
  if (value === void 0) return void 0;
  if (typeof value !== "string") {
    add(issues, `${path}.${key}`, "invalid_type", `${key} must be a string.`);
    return void 0;
  }
  const trimmed = value.trim();
  if (!trimmed || opts.max !== void 0 && trimmed.length > opts.max || opts.pattern && !opts.pattern.test(trimmed)) {
    add(issues, `${path}.${key}`, "invalid_value", `${key} is empty or invalid.`);
    return void 0;
  }
  return trimmed;
}
function numberValue(obj, key, path, issues, opts = {}) {
  const value = obj[key];
  if (value === void 0) {
    if (opts.required) add(issues, `${path}.${key}`, "missing_field", `${key} is required.`);
    return void 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    add(issues, `${path}.${key}`, "invalid_type", `${key} must be a finite number.`);
    return void 0;
  }
  if (opts.integer && !Number.isInteger(value)) {
    add(issues, `${path}.${key}`, "invalid_value", `${key} must be an integer.`);
  }
  if (opts.min !== void 0 && value < opts.min) {
    add(issues, `${path}.${key}`, "invalid_value", `${key} must be >= ${opts.min}.`);
  }
  if (opts.max !== void 0 && value > opts.max) {
    add(issues, `${path}.${key}`, "invalid_value", `${key} must be <= ${opts.max}.`);
  }
  return value;
}
function optionalNumber(raw, key, path, issues, opts) {
  return numberValue(raw, key, path, issues, opts);
}
function parseAsset(raw, path, issues) {
  if (!isRecord(raw)) {
    add(issues, path, "invalid_type", "assets entries must be objects.");
    return null;
  }
  const before2 = issues.length;
  rejectUnknown(raw, ASSET_KEYS, path, issues);
  const gouacheKey = stringValue(raw, "gouacheKey", path, issues, { max: 80 });
  if (!gouacheKey) add(issues, `${path}.gouacheKey`, "missing_field", "gouacheKey is required.");
  else if (!GOUACHE_KEY_SET.has(gouacheKey)) {
    add(issues, `${path}.gouacheKey`, "invalid_value", "Unknown Gouache asset key.");
  }
  const asset = { gouacheKey: gouacheKey ?? "" };
  const weight = optionalNumber(raw, "weight", path, issues, { min: 0.05, max: 10 });
  const scaleMin = optionalNumber(raw, "scaleMin", path, issues, { min: 0.2, max: 3 });
  const scaleMax = optionalNumber(raw, "scaleMax", path, issues, { min: 0.2, max: 3 });
  const rotateMin = optionalNumber(raw, "rotateMin", path, issues, { min: -180, max: 180 });
  const rotateMax = optionalNumber(raw, "rotateMax", path, issues, { min: -180, max: 180 });
  const lineWidth = optionalNumber(raw, "lineWidth", path, issues, { min: 0.3, max: 6 });
  const blur = optionalNumber(raw, "blur", path, issues, { min: 0, max: 8 });
  if (scaleMin !== void 0 && scaleMax !== void 0 && scaleMin > scaleMax) {
    add(issues, `${path}.scaleMin`, "invalid_value", "scaleMin must be <= scaleMax.");
  }
  if (rotateMin !== void 0 && rotateMax !== void 0 && rotateMin > rotateMax) {
    add(issues, `${path}.rotateMin`, "invalid_value", "rotateMin must be <= rotateMax.");
  }
  if (weight !== void 0) asset.weight = weight;
  if (scaleMin !== void 0) asset.scaleMin = scaleMin;
  if (scaleMax !== void 0) asset.scaleMax = scaleMax;
  if (rotateMin !== void 0) asset.rotateMin = rotateMin;
  if (rotateMax !== void 0) asset.rotateMax = rotateMax;
  if (lineWidth !== void 0) asset.lineWidth = lineWidth;
  if (blur !== void 0) asset.blur = blur;
  return issues.length === before2 && gouacheKey ? asset : null;
}
function parseAssets(raw, issues) {
  if (!Array.isArray(raw)) {
    add(issues, "$.assets", "invalid_type", "assets must be an array.");
    return [];
  }
  if (raw.length === 0) add(issues, "$.assets", "missing_field", "At least one asset is required.");
  if (raw.length > 12) add(issues, "$.assets", "invalid_value", "At most 12 assets are accepted.");
  return raw.slice(0, 12).flatMap((entry, index) => {
    const asset = parseAsset(entry, `$.assets[${index}]`, issues);
    return asset ? [asset] : [];
  });
}
function validateAtlasPlotFillProposal(raw) {
  const errors = [];
  scanExecutable(raw, "$", errors);
  if (!isRecord(raw)) {
    add(errors, "$", "invalid_type", "Proposal must be a JSON object.");
    return { ok: false, errors };
  }
  rejectUnknown(raw, TOP_LEVEL_KEYS, "$", errors);
  if (raw.schemaVersion !== void 0 && raw.schemaVersion !== ATLAS_PLOT_FILL_SCHEMA_VERSION) {
    add(errors, "$.schemaVersion", "invalid_value", "schemaVersion must be 1.");
  }
  if (raw.kind !== void 0 && raw.kind !== ATLAS_PLOT_FILL_PROPOSAL_KIND) {
    add(errors, "$.kind", "invalid_value", "kind must be atlas_plot_fill.");
  }
  const plotKey = stringValue(raw, "plotKey", "$", errors, { pattern: SAFE_PLOT_KEY });
  const biomeKind = typeof raw.biomeKind === "string" && BIOME_VALUES.includes(raw.biomeKind) ? raw.biomeKind : void 0;
  if (raw.biomeKind !== void 0 && !biomeKind) {
    add(errors, "$.biomeKind", "invalid_value", "Unknown biome kind.");
  }
  const density = numberValue(raw, "density", "$", errors, { required: true, min: 0.05, max: 3 });
  const seed = numberValue(raw, "seed", "$", errors, { required: true, integer: true, min: 0, max: 4294967295 });
  const assets = parseAssets(raw.assets, errors);
  const notes = stringValue(raw, "notes", "$", errors, { max: 500 });
  const rationale = stringValue(raw, "rationale", "$", errors, { max: 800 });
  if (errors.length > 0 || density === void 0 || seed === void 0 || assets.length === 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    proposal: {
      schemaVersion: ATLAS_PLOT_FILL_SCHEMA_VERSION,
      kind: ATLAS_PLOT_FILL_PROPOSAL_KIND,
      ...plotKey ? { plotKey } : {},
      ...biomeKind ? { biomeKind } : {},
      density,
      seed,
      assets,
      ...notes ? { notes } : {},
      ...rationale ? { rationale } : {}
    },
    warnings: []
  };
}
function isAtlasPlotFillProposal(raw) {
  return validateAtlasPlotFillProposal(raw).ok;
}
function buildAtlasPlotFillPromptContext() {
  return {
    schemaVersion: ATLAS_PLOT_FILL_SCHEMA_VERSION,
    kind: ATLAS_PLOT_FILL_PROPOSAL_KIND,
    acceptedBiomes: [...BIOME_VALUES],
    acceptedGouacheAssets: GOUACHE_ASSETS.map((asset) => ({
      key: asset.key,
      name: asset.name,
      category: asset.category
    })),
    rules: [
      "Return only JSON, no Markdown and no code.",
      "Use kind atlas_plot_fill and schemaVersion 1.",
      "Use only Gouache keys from acceptedGouacheAssets.",
      "Do not return AtlasObject payloads, coordinates, visibility, palette database ids, or executable code.",
      "UWE will create ghost objects from this recipe and requires explicit user review before persistence."
    ]
  };
}
function formatAtlasPlotFillPromptContext(context = buildAtlasPlotFillPromptContext()) {
  const assets = context.acceptedGouacheAssets.map((asset) => `${asset.key} (${asset.category}: ${asset.name})`).join(", ");
  return [
    "Atlas plot-fill proposal context:",
    `- JSON shape: {"schemaVersion":1,"kind":"${context.kind}","biomeKind":"forest","density":1,"seed":123,"assets":[{"gouacheKey":"g_oak","weight":1}]}`,
    `- Accepted biomes: ${context.acceptedBiomes.join(", ")}`,
    `- Accepted Gouache assets: ${assets}`,
    "- Bounds: density 0.05..3, seed integer 0..4294967295, max 12 assets.",
    "- Security: no AtlasObject payloads, no code, no coordinates, no visibility, no palette database ids.",
    "- Review flow: RTX proposes a recipe only; UWE renders ghost objects and the DM must accept explicitly."
  ].join("\n");
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
var SCHEMA_VERSION = 3;
var DEFAULT_TERRAIN_BLEND_WIDTH = 6;
function emptyTileLayer() {
  return { cols: 64, rows: 40, tile: 32, cells: {}, blendWidth: DEFAULT_TERRAIN_BLEND_WIDTH };
}
function normalizeTerrainBlendWidth(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TERRAIN_BLEND_WIDTH;
  return Math.max(0, value);
}
function migrateDoc(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new AtlasParseError("Atlas-Doc ist leer oder ungültig.");
  }
  const d = { ...doc };
  if (!d.schemaVersion || d.schemaVersion < SCHEMA_VERSION) d.schemaVersion = SCHEMA_VERSION;
  d.nodes = d.nodes ?? [];
  d.features = d.features ?? [];
  d.objects = d.objects ?? [];
  d.pageLinks = d.pageLinks ?? {};
  d.tileLayer = d.tileLayer ?? emptyTileLayer();
  d.tileLayer.cells = d.tileLayer.cells ?? {};
  d.tileLayer.blendWidth = normalizeTerrainBlendWidth(d.tileLayer.blendWidth);
  const elevation = normalizeElevationCells(d.tileLayer.elevation);
  if (elevation) d.tileLayer.elevation = elevation;
  else delete d.tileLayer.elevation;
  if (d.tileLayer.parallaxStrength !== void 0) {
    d.tileLayer.parallaxStrength = normalizeParallaxStrength(d.tileLayer.parallaxStrength);
  }
  if (d.tileLayer.contoursEnabled !== void 0) {
    d.tileLayer.contoursEnabled = d.tileLayer.contoursEnabled === true;
  }
  if (d.tileLayer.contourSteps !== void 0) {
    d.tileLayer.contourSteps = normalizeContourSteps(d.tileLayer.contourSteps);
  }
  if (d.tileLayer.lightDir !== void 0) {
    const lightDir = normalizeLightDirection(d.tileLayer.lightDir);
    if (lightDir === DEFAULT_LIGHT_DIRECTION) delete d.tileLayer.lightDir;
    else d.tileLayer.lightDir = lightDir;
  }
  if (d.tileLayer.climateEnabled !== void 0) {
    if (d.tileLayer.climateEnabled === true) d.tileLayer.climateEnabled = true;
    else delete d.tileLayer.climateEnabled;
  }
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

// ../atlas/src/coastline.ts
var COAST_DEFAULTS = {
  waterKinds: ["coast", "water"],
  rimWidthRatio: 0.22,
  rippleColor: "rgba(255,255,255,0.35)",
  rippleSeed: 7,
  rippleDensity: 1
};
var finite = (v) => typeof v === "number" && Number.isFinite(v);
function resolveCoastStyle(opts) {
  const kinds = Array.isArray(opts.waterKinds) && opts.waterKinds.length > 0 ? opts.waterKinds : COAST_DEFAULTS.waterKinds;
  return {
    waterKinds: new Set(kinds),
    rimColor: opts.rimColor,
    rimWidthRatio: finite(opts.rimWidthRatio) ? Math.max(0, Math.min(0.5, opts.rimWidthRatio)) : COAST_DEFAULTS.rimWidthRatio,
    rippleColor: opts.rippleColor ?? COAST_DEFAULTS.rippleColor,
    rippleSeed: finite(opts.rippleSeed) ? opts.rippleSeed : COAST_DEFAULTS.rippleSeed,
    rippleDensity: finite(opts.rippleDensity) ? Math.max(0, opts.rippleDensity) : COAST_DEFAULTS.rippleDensity
  };
}
var RIM_ALPHA = 0.55;
var RIPPLE_GATE = 0.55;
var RIPPLE_LINE_RATIO = 0.03;
function paintCoastCell(ctx, style, cell) {
  const { col, row, x, y, w, h, rimColor, isLand } = cell;
  const left = isLand(col - 1, row);
  const right = isLand(col + 1, row);
  const top = isLand(col, row - 1);
  const bottom = isLand(col, row + 1);
  if (left || right || top || bottom) {
    const bandW = style.rimWidthRatio * w;
    const bandH = style.rimWidthRatio * h;
    ctx.save();
    ctx.globalAlpha = RIM_ALPHA;
    ctx.fillStyle = rimColor;
    if (left) ctx.fillRect(x, y, bandW, h);
    if (right) ctx.fillRect(x + w - bandW, y, bandW, h);
    if (top) ctx.fillRect(x, y, w, bandH);
    if (bottom) ctx.fillRect(x, y + h - bandH, w, bandH);
    ctx.restore();
    return;
  }
  paintRipples(ctx, style, cell);
}
function paintRipples(ctx, style, cell) {
  const { col, row, x, y, w, h } = cell;
  const rng = mulberry32(style.rippleSeed + col * 73856093 + row * 19349663);
  if (rng() < RIPPLE_GATE) return;
  const baseArcs = rng() < 0.5 ? 1 : 2;
  const count = Math.max(0, Math.min(3, Math.round(baseArcs * style.rippleDensity)));
  if (count <= 0) return;
  ctx.save();
  ctx.strokeStyle = style.rippleColor;
  ctx.lineWidth = Math.min(w, h) * RIPPLE_LINE_RATIO;
  for (let i = 0; i < count; i++) {
    const len = w * (0.4 + rng() * 0.2);
    const ax = x + rng() * Math.max(0, w - len);
    const ay = y + h * (0.2 + rng() * 0.6);
    const midX = ax + len / 2;
    const midY = ay - h * 0.12;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(midX, midY, ax + len, ay);
    ctx.stroke();
  }
  ctx.restore();
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
function applyColorIntensity(color, factor) {
  if (factor === 1 || !/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const n = parseInt(color.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const s2 = Math.max(0, Math.min(1, s * factor));
  const l2 = Math.max(0, Math.min(1, l - (factor - 1) * 0.06));
  const hue2rgb = (p2, q2, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
    if (t < 1 / 2) return q2;
    if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
    return p2;
  };
  const q = l2 < 0.5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2;
  const p = 2 * l2 - q;
  const to = (t) => Math.round(hue2rgb(p, q, t) * 255);
  return `rgb(${to(h + 1 / 3)},${to(h)},${to(h - 1 / 3)})`;
}
function paintTerrainBlobs(ctx, opts) {
  const { cols, rows, getCell, tileRect, fillFor, radiusRatio = 0.4, intensityFor } = opts;
  const blendWidth = typeof opts.blendWidth === "number" && Number.isFinite(opts.blendWidth) ? Math.max(0, opts.blendWidth) : 0;
  const fillForBiome = (biome) => intensityFor ? applyColorIntensity(fillFor(biome), intensityFor(biome)) : fillFor(biome);
  const coast = opts.coast ? resolveCoastStyle(opts.coast) : void 0;
  const isLand = coast ? (col, row) => {
    const k = getCell(col, row);
    return !!k && !coast.waterKinds.has(k);
  } : void 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const biome = getCell(c, r);
      if (!biome) continue;
      const { x, y, w, h } = tileRect(c, r);
      const radius = Math.min(w, h) * radiusRatio;
      ctx.fillStyle = fillForBiome(biome);
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
      if (coast && isLand && coast.waterKinds.has(biome)) {
        const rimColor = coast.rimColor ?? applyColorIntensity(fillFor(biome), 0.55);
        paintCoastCell(ctx, coast, { col: c, row: r, x, y, w, h, rimColor, isLand });
      }
    }
  }
  if (blendWidth <= 0) return;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const biome = getCell(c, r);
      if (!biome) continue;
      const { x, y, w, h } = tileRect(c, r);
      const from = fillForBiome(biome);
      const rightBiome = getCell(c + 1, r);
      if (rightBiome && rightBiome !== biome) {
        const edgeWidth = Math.min(blendWidth, w);
        if (edgeWidth > 0) {
          const half = edgeWidth / 2;
          const gradient = ctx.createLinearGradient(x + w - half, y, x + w + half, y);
          gradient.addColorStop(0, from);
          gradient.addColorStop(1, fillForBiome(rightBiome));
          ctx.fillStyle = gradient;
          ctx.fillRect(x + w - half, y, edgeWidth, h);
        }
      }
      const bottomBiome = getCell(c, r + 1);
      if (bottomBiome && bottomBiome !== biome) {
        const edgeHeight = Math.min(blendWidth, h);
        if (edgeHeight > 0) {
          const half = edgeHeight / 2;
          const gradient = ctx.createLinearGradient(x, y + h - half, x, y + h + half);
          gradient.addColorStop(0, from);
          gradient.addColorStop(1, fillForBiome(bottomBiome));
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y + h - half, w, edgeHeight);
        }
      }
    }
  }
}
function createHillshadeCanvas(rgba, cols, rows) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, cols);
  canvas.height = Math.max(1, rows);
  const ctx = canvas.getContext("2d");
  if (ctx && cols > 0 && rows > 0 && rgba.length === cols * rows * 4) {
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), cols, rows), 0, 0);
  }
  return canvas;
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
function buildTrunkRibbon(spinePts, widths, base) {
  const left = [];
  const right = [];
  const n = spinePts.length;
  for (let i = 0; i < n; i++) {
    const prev = spinePts[Math.max(0, i - 1)];
    const next = spinePts[Math.min(n - 1, i + 1)];
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const half = Math.max(0.5, (widths[i] ?? 0.2) * base) / 2;
    left.push([spinePts[i][0] + nx * half, spinePts[i][1] + ny * half]);
    right.push([spinePts[i][0] - nx * half, spinePts[i][1] - ny * half]);
  }
  return { left, right };
}
function traceRibbonPath(ctx, left, right) {
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
}
function drawVineLeaf(ctx, center, angle, radius, body, edge) {
  ctx.save();
  ctx.translate(center[0], center[1]);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(radius * 0.85, 0, radius, radius * 0.52, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(0.8, radius * 0.22);
  ctx.stroke();
  ctx.restore();
}
function drawVine(ctx, layout, opts) {
  const { spine, widths, leaves, shadow: shadow2 } = layout;
  if (spine.length < 2) return;
  const { project, zoom, selected } = opts;
  const p = (pts) => pts.map(project);
  const base = VINE_TRUNK_BASE_PX * (opts.thickness ?? 1) * zoom * (selected ? 1.15 : 1);
  const trunkBody = opts.fill?.trunk ?? opts.trunk;
  const trunkEdge = selected ? "#c2622b" : opts.fill?.trunkEdge ?? opts.outline ?? "#241a10";
  const leafBody = opts.fill?.leaf ?? opts.trunk;
  const leafEdge = opts.fill?.leafEdge ?? opts.outline ?? "rgba(33,29,23,0.35)";
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const spinePts = p(spine);
  const { left, right } = buildTrunkRibbon(spinePts, widths, base);
  const shadowPts = p(shadow2);
  ctx.strokeStyle = opts.shadow;
  ctx.lineWidth = Math.max(1, base * 0.7);
  strokeTaperedTrunk(ctx, shadowPts, widths, base, 0);
  if (opts.outline) {
    const haloPx = VINE_OUTLINE_PX * zoom;
    ctx.strokeStyle = opts.outline;
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = Math.max(1.2, base * 0.22) + haloPx;
    strokeTaperedTrunk(ctx, spinePts, widths, base, haloPx);
    ctx.globalAlpha = 1;
  }
  traceRibbonPath(ctx, left, right);
  ctx.fillStyle = trunkBody;
  ctx.fill();
  ctx.strokeStyle = trunkEdge;
  ctx.lineWidth = Math.max(0.8, 1.2 * zoom);
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(0.6, base * 0.12);
  strokePolyline(ctx, left.filter((_, i) => i % 3 === 0));
  ctx.restore();
  for (const leaf of leaves) {
    const c = project(leaf.center);
    const edge = project([leaf.center[0] + leaf.size * 0.02, leaf.center[1]]);
    const pr = Math.hypot(edge[0] - c[0], edge[1] - c[1]);
    const r = Math.max(2.2, pr * 3.2 * base * 0.18);
    drawVineLeaf(ctx, c, leaf.angle, r, leafBody, leafEdge);
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
var COIL_AMP = 0.012;
var COIL_TURNS = 2;
var SHADOW_OFFSET = 0.05;
var AURA_RADIUS = 0.09;
var AURA_CLOUDS = 5;
function clamp012(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
function clampCoord(c) {
  return [clamp012(c[0]), clamp012(c[1])];
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
      leaves: [],
      shadow: [],
      aura: { center: [0, 0], radius: 0, clouds: [] }
    };
  }
  const taperStart = options.taperStart ?? 0.9;
  const taperEnd = options.taperEnd ?? 0.15;
  const coil = clamp012(options.coil ?? 0.6);
  const tendrilCount = Math.max(0, Math.round(options.tendrils ?? 3));
  const height = clamp012(options.height ?? 0.7);
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
  const shadow2 = spine.map(
    (c) => clampCoord([c[0] + off, c[1] + off])
  );
  const rng = mulberry32(seed);
  const tendrils = [];
  const leaves = [];
  for (let k = 0; k < tendrilCount; k++) {
    const t = (k + 1) / (tendrilCount + 1);
    const idx = Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
    const [px, py] = perpendicularAt(spine, idx);
    const side = rng() < 0.5 ? 1 : -1;
    const reach = widths[idx] * (0.028 + rng() * 0.022) + 0.014;
    const attach = spine[idx];
    const outward = [px * side, py * side];
    const arc = [clampCoord(attach)];
    for (let j = 1; j <= 3; j++) {
      const frac = j / 3;
      const curl = side * frac * 0.35;
      const ox = outward[0] * Math.cos(curl) - outward[1] * Math.sin(curl);
      const oy = outward[0] * Math.sin(curl) + outward[1] * Math.cos(curl);
      arc.push(
        clampCoord([
          attach[0] + ox * reach * frac,
          attach[1] + oy * reach * frac
        ])
      );
    }
    tendrils.push(arc);
    const tip2 = arc[arc.length - 1];
    leaves.push({
      center: tip2,
      angle: Math.atan2(tip2[1] - attach[1], tip2[0] - attach[0]),
      size: widths[idx] * (0.55 + rng() * 0.25)
    });
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
    leaves,
    shadow: shadow2,
    aura: { center: clampCoord(tip), radius, clouds }
  };
}

// ../atlas/src/river-tools.ts
var WATER_BIOME = "coast";
function snapPointToWater(layer, point, options = {}) {
  if (!layer || !layer.cells || !(layer.cols > 0) || !(layer.rows > 0)) return null;
  const maxDist = options.maxDist ?? 0.04;
  const water = options.waterBiome ?? WATER_BIOME;
  const [px, py] = point;
  const cols = layer.cols;
  const rows = layer.rows;
  const col = Math.min(cols - 1, Math.max(0, Math.floor(px * cols)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor(py * rows)));
  if (layer.cells[`${col},${row}`] === water) return null;
  const rx = Math.max(1, Math.ceil(maxDist * cols));
  const ry = Math.max(1, Math.ceil(maxDist * rows));
  let best = null;
  let bestDist = maxDist;
  for (let c = Math.max(0, col - rx); c <= Math.min(cols - 1, col + rx); c++) {
    for (let r = Math.max(0, row - ry); r <= Math.min(rows - 1, row + ry); r++) {
      if (layer.cells[`${c},${r}`] !== water) continue;
      const cx = (c + 0.5) / cols;
      const cy = (r + 0.5) / rows;
      const d = Math.hypot(cx - px, cy - py);
      if (d < bestDist) {
        bestDist = d;
        best = [cx, cy];
      }
    }
  }
  return best;
}
function riverFlowsUphill(grid, coords, options = {}) {
  if (!grid || !grid.elevation || coords.length < 2) return false;
  const threshold = options.threshold ?? 0.08;
  const first = coords[0];
  const last = coords[coords.length - 1];
  const start = sampleElevation(grid, first[0], first[1]);
  const end = sampleElevation(grid, last[0], last[1]);
  return end - start > threshold;
}

// ../atlas/src/climate.ts
var CLIMATE_ZONES = [
  { key: "arktisch", label: "Arktisch", color: "rgba(190,215,235,0.28)" },
  { key: "kalt", label: "Kalt-gemäßigt", color: "rgba(160,200,190,0.20)" },
  { key: "gemaessigt", label: "Gemäßigt", color: "rgba(150,190,120,0.16)" },
  { key: "subtropisch", label: "Subtropisch", color: "rgba(215,190,110,0.18)" },
  { key: "tropisch", label: "Tropisch", color: "rgba(200,150,90,0.22)" }
];
function clamp013(v) {
  return Math.max(0, Math.min(1, v));
}
function climateZoneAt(ny) {
  const idx = Math.min(
    CLIMATE_ZONES.length - 1,
    Math.floor(clamp013(ny) * CLIMATE_ZONES.length)
  );
  return CLIMATE_ZONES[idx];
}
function climateBands() {
  const n = CLIMATE_ZONES.length;
  return CLIMATE_ZONES.map((zone, i) => ({ zone, y0: i / n, y1: (i + 1) / n }));
}

// ../atlas/src/cartouche.ts
var CARTOUCHE_STYLES = [
  { key: "scroll", label: "Schriftrolle" },
  { key: "banner", label: "Banner" },
  { key: "plain", label: "Doppellinien-Kasten" }
];
function drawCartouche(ctx, opts) {
  const title = (opts.title || "").trim();
  if (!title) return;
  const { x, y, width: w, height: h } = opts;
  const accent = opts.accent ?? opts.ink;
  const left = x - w / 2;
  const top = y - h / 2;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (opts.style === "banner") {
    const tail = Math.min(h * 0.9, w * 0.12);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(left - tail, top + h * 0.2);
    ctx.lineTo(left, top + h * 0.2);
    ctx.lineTo(left, top + h * 0.8);
    ctx.lineTo(left - tail, top + h * 0.8);
    ctx.lineTo(left - tail * 0.45, y);
    ctx.closePath();
    ctx.moveTo(left + w + tail, top + h * 0.2);
    ctx.lineTo(left + w, top + h * 0.2);
    ctx.lineTo(left + w, top + h * 0.8);
    ctx.lineTo(left + w + tail, top + h * 0.8);
    ctx.lineTo(left + w + tail * 0.45, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = opts.parchment;
    ctx.strokeStyle = opts.ink;
    ctx.lineWidth = Math.max(1.2, h * 0.045);
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.fill();
    ctx.stroke();
  } else if (opts.style === "scroll") {
    const curl = Math.min(h * 0.5, w * 0.07);
    ctx.fillStyle = opts.parchment;
    ctx.strokeStyle = opts.ink;
    ctx.lineWidth = Math.max(1.2, h * 0.045);
    ctx.beginPath();
    ctx.moveTo(left + curl, top);
    ctx.lineTo(left + w - curl, top);
    ctx.quadraticCurveTo(left + w, top, left + w, top + h / 2);
    ctx.quadraticCurveTo(left + w, top + h, left + w - curl, top + h);
    ctx.lineTo(left + curl, top + h);
    ctx.quadraticCurveTo(left, top + h, left, top + h / 2);
    ctx.quadraticCurveTo(left, top, left + curl, top);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1, h * 0.035);
    for (const [cx, dir] of [[left + curl * 0.4, 1], [left + w - curl * 0.4, -1]]) {
      ctx.beginPath();
      ctx.arc(cx, y, curl * 0.55, Math.PI * 0.25 * dir, Math.PI * (2 - 0.25 * dir), dir < 0);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = opts.parchment;
    ctx.strokeStyle = opts.ink;
    ctx.lineWidth = Math.max(1.4, h * 0.05);
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = Math.max(0.8, h * 0.02);
    ctx.strokeRect(left + h * 0.12, top + h * 0.12, w - h * 0.24, h - h * 0.24);
  }
  ctx.fillStyle = opts.ink;
  ctx.font = opts.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, x, y);
  ctx.restore();
}

// ../atlas/src/travel.ts
var TERRAIN_TRAVEL_FACTOR = {
  grassland: 1,
  hills: 1.3,
  forest: 1.35,
  desert: 1.4,
  snow: 1.6,
  swamp: 1.8,
  mountains: 2,
  // Wasser ohne Boot: Umweg/Fähre — bewusst teuer.
  coast: 2.5
};
function biomeFactorAt(layer, x, y) {
  if (!layer || !layer.cells || !(layer.cols > 0) || !(layer.rows > 0)) return 1;
  const c = Math.min(layer.cols - 1, Math.max(0, Math.floor(x * layer.cols)));
  const r = Math.min(layer.rows - 1, Math.max(0, Math.floor(y * layer.rows)));
  const biome = layer.cells[`${c},${r}`];
  return biome && TERRAIN_TRAVEL_FACTOR[biome] || 1;
}
function planTravelRoute(points, options = {}) {
  const empty = { totalLeagues: 0, effortLeagues: 0, days: 0, camps: [], segments: [] };
  if (points.length < 2) return empty;
  const perDay = options.leaguesPerDay && options.leaguesPerDay > 0 ? options.leaguesPerDay : 8;
  const scale = options.scaleLeagues && options.scaleLeagues > 0 ? options.scaleLeagues : 100;
  const samples = Math.max(1, Math.floor(options.samplesPerSegment ?? 8));
  const segments = [];
  let totalLeagues = 0;
  let effortLeagues = 0;
  const camps = [];
  let effortSinceCamp = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const leagues = Math.hypot(bx - ax, by - ay) * scale;
    let factorSum = 0;
    for (let k = 0; k < samples; k++) {
      const t = (k + 0.5) / samples;
      factorSum += biomeFactorAt(options.layer, ax + (bx - ax) * t, ay + (by - ay) * t);
    }
    const factor = factorSum / samples;
    const effort = leagues * factor;
    segments.push({ leagues, effortLeagues: effort, factor });
    totalLeagues += leagues;
    let remaining = effort;
    let tStart = 0;
    while (effortSinceCamp + remaining >= perDay && effort > 0) {
      const needed = perDay - effortSinceCamp;
      const tCamp = tStart + needed / effort * (1 - 0);
      const t = Math.min(1, tCamp);
      camps.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      remaining -= needed;
      tStart = t;
      effortSinceCamp = 0;
    }
    effortSinceCamp += remaining;
    effortLeagues += effort;
  }
  const last = points[points.length - 1];
  while (camps.length && Math.hypot(camps[camps.length - 1][0] - last[0], camps[camps.length - 1][1] - last[1]) < 1e-9) {
    camps.pop();
  }
  const days = Math.ceil(effortLeagues / perDay * 10) / 10;
  return { totalLeagues, effortLeagues, days, camps, segments };
}

// ../atlas/src/bridge-points.ts
function segmentIntersection(a1, a2, b1, b2) {
  const rX = a2[0] - a1[0];
  const rY = a2[1] - a1[1];
  const sX = b2[0] - b1[0];
  const sY = b2[1] - b1[1];
  const denom = rX * sY - rY * sX;
  if (denom === 0) return void 0;
  const qpX = b1[0] - a1[0];
  const qpY = b1[1] - a1[1];
  const t = (qpX * sY - qpY * sX) / denom;
  const u = (qpX * rY - qpY * rX) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return void 0;
  return [a1[0] + t * rX, a1[1] + t * rY];
}
function findBridgePoints(road, river, opts) {
  const minGap = opts?.minGap ?? 0.02;
  if (road.length < 2 || river.length < 2) return [];
  const raw = [];
  let roadWalked = 0;
  for (let i = 0; i < road.length - 1; i++) {
    const a1 = road[i];
    const a2 = road[i + 1];
    const segLen = Math.hypot(a2[0] - a1[0], a2[1] - a1[1]);
    if (segLen === 0) continue;
    const angleDeg = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]) * 180 / Math.PI;
    for (let j = 0; j < river.length - 1; j++) {
      const hit = segmentIntersection(a1, a2, river[j], river[j + 1]);
      if (!hit) continue;
      const distAlongSeg = Math.hypot(hit[0] - a1[0], hit[1] - a1[1]);
      raw.push({ x: hit[0], y: hit[1], angleDeg, roadDistance: roadWalked + distAlongSeg });
    }
    roadWalked += segLen;
  }
  raw.sort((a, b) => a.roadDistance - b.roadDistance);
  const merged = [];
  for (const crossing of raw) {
    const last = merged[merged.length - 1];
    if (last && Math.hypot(crossing.x - last.x, crossing.y - last.y) < minGap) continue;
    merged.push({ x: crossing.x, y: crossing.y, angleDeg: crossing.angleDeg });
  }
  return merged;
}

// ../atlas/src/route-astar.ts
var SQRT2 = Math.SQRT2;
var DEFAULT_BLOCKED = ["coast", "water"];
var DEFAULT_BIOME_COST = {
  mountains: 3,
  swamp: 4,
  hills: 1.5,
  forest: 1.2
};
var DEFAULT_SLOPE_COST = 40;
var SNAP_RADIUS = 3;
var NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
];
function clamp014(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function octile(dx, dy) {
  const a = Math.abs(dx);
  const b = Math.abs(dy);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return hi - lo + SQRT2 * lo;
}
function simplify(pts) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function before(a, b) {
  return a.f < b.f || a.f === b.f && a.i < b.i;
}
var MinHeap = class {
  constructor() {
    __publicField(this, "data", []);
  }
  get size() {
    return this.data.length;
  }
  push(entry) {
    const d = this.data;
    d.push(entry);
    let c = d.length - 1;
    while (c > 0) {
      const p = c - 1 >> 1;
      if (!before(d[c], d[p])) break;
      [d[c], d[p]] = [d[p], d[c]];
      c = p;
    }
  }
  pop() {
    const d = this.data;
    const top = d[0];
    const last = d.pop();
    if (d.length > 0) {
      d[0] = last;
      let p = 0;
      for (; ; ) {
        const l = p * 2 + 1;
        const r = l + 1;
        let s = p;
        if (l < d.length && before(d[l], d[s])) s = l;
        if (r < d.length && before(d[r], d[s])) s = r;
        if (s === p) break;
        [d[p], d[s]] = [d[s], d[p]];
        p = s;
      }
    }
    return top;
  }
};
function routeRoad(tileLayer, start, goal, options = {}) {
  const cols = tileLayer.cols | 0;
  const rows = tileLayer.rows | 0;
  const unreachable = { points: [], reachable: false, cost: 0 };
  if (cols <= 0 || rows <= 0) return unreachable;
  const blocked = new Set(options.blocked ?? DEFAULT_BLOCKED);
  const biomeCost = options.biomeCost ?? DEFAULT_BIOME_COST;
  const slopeCost = options.slopeCost ?? DEFAULT_SLOPE_COST;
  const maxExpansions = options.maxExpansions ?? cols * rows * 8;
  let minFactor = 1;
  for (const v of Object.values(biomeCost)) if (v < minFactor) minFactor = v;
  if (minFactor < 0) minFactor = 0;
  const clampStart = [clamp014(start[0]), clamp014(start[1])];
  const clampGoal = [clamp014(goal[0]), clamp014(goal[1])];
  const idx = (c, r) => r * cols + c;
  const colOf = (i) => i % cols;
  const rowOf = (i) => (i - i % cols) / cols;
  const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
  const biomeAt = (c, r) => tileLayer.cells?.[`${c},${r}`];
  const passable = (c, r) => {
    if (!inBounds(c, r)) return false;
    const b = biomeAt(c, r);
    return b === void 0 || !blocked.has(b);
  };
  const biomeFactor = (c, r) => {
    const b = biomeAt(c, r);
    return b === void 0 ? 1 : biomeCost[b] ?? 1;
  };
  const toCol = (n2) => Math.min(cols - 1, Math.max(0, Math.floor(n2 * cols)));
  const toRow = (n2) => Math.min(rows - 1, Math.max(0, Math.floor(n2 * rows)));
  const snap = (c0, r0) => {
    if (passable(c0, r0)) return idx(c0, r0);
    for (let rad = 1; rad <= SNAP_RADIUS; rad++) {
      let best = -1;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (!passable(c, r)) continue;
          const id = idx(c, r);
          if (best === -1 || id < best) best = id;
        }
      }
      if (best !== -1) return best;
    }
    return -1;
  };
  const startIdx = snap(toCol(clampStart[0]), toRow(clampStart[1]));
  const goalIdx = snap(toCol(clampGoal[0]), toRow(clampGoal[1]));
  if (startIdx < 0 || goalIdx < 0) return unreachable;
  const gc = colOf(goalIdx);
  const gr = rowOf(goalIdx);
  const heuristic = (i) => minFactor * octile(gc - colOf(i), gr - rowOf(i));
  const n = cols * rows;
  const g = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = new MinHeap();
  g[startIdx] = 0;
  open.push({ f: heuristic(startIdx), i: startIdx });
  let expansions = 0;
  let found = false;
  while (open.size > 0 && expansions < maxExpansions) {
    const cur = open.pop().i;
    if (closed[cur]) continue;
    if (cur === goalIdx) {
      found = true;
      break;
    }
    closed[cur] = 1;
    expansions++;
    const cc = colOf(cur);
    const cr = rowOf(cur);
    const elevCur = cellElevation(tileLayer, cc, cr);
    for (const [dc, dr] of NEIGHBORS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (!passable(nc, nr)) continue;
      const ni = idx(nc, nr);
      if (closed[ni]) continue;
      const stepDist = dc !== 0 && dr !== 0 ? SQRT2 : 1;
      const step = stepDist * biomeFactor(nc, nr) + slopeCost * Math.abs(cellElevation(tileLayer, nc, nr) - elevCur);
      const tentative = g[cur] + step;
      if (tentative < g[ni]) {
        g[ni] = tentative;
        from[ni] = cur;
        open.push({ f: tentative + heuristic(ni), i: ni });
      }
    }
  }
  if (!found) return unreachable;
  const cells = [];
  for (let cur = goalIdx; cur !== -1; cur = from[cur]) cells.push(cur);
  cells.reverse();
  const center = (i) => [
    (colOf(i) + 0.5) / cols,
    (rowOf(i) + 0.5) / rows
  ];
  let pts;
  if (cells.length <= 1) {
    pts = [clampStart, clampGoal];
  } else {
    pts = cells.map(center);
    pts[0] = clampStart;
    pts[pts.length - 1] = clampGoal;
  }
  return { points: simplify(pts), reachable: true, cost: g[goalIdx] };
}

// ../atlas/src/territory.ts
var DEFAULT_SAMPLES_X = 96;
var DEFAULT_SAMPLES_Y = 60;
function clamp015(v) {
  return Math.max(0, Math.min(1, v));
}
function suggestTerritories(seeds, options = {}) {
  if (!seeds.length) return [];
  const samplesX = Math.max(1, Math.floor(options.samplesX ?? DEFAULT_SAMPLES_X));
  const samplesY = Math.max(1, Math.floor(options.samplesY ?? DEFAULT_SAMPLES_Y));
  const exclude = options.exclude;
  const clamped = seeds.map((s) => ({
    key: s.key,
    x: clamp015(s.x),
    y: clamp015(s.y),
    weight: s.weight && s.weight > 0 ? s.weight : 1
  }));
  const assignment = new Int32Array(samplesX * samplesY).fill(-1);
  for (let j = 0; j < samplesY; j++) {
    const cy = (j + 0.5) / samplesY;
    for (let i = 0; i < samplesX; i++) {
      const cx = (i + 0.5) / samplesX;
      if (exclude && exclude(cx, cy)) continue;
      let best = -1;
      let bestDist = Infinity;
      for (let s = 0; s < clamped.length; s++) {
        const seed = clamped[s];
        const dist = Math.hypot(cx - seed.x, cy - seed.y) / seed.weight;
        if (dist < bestDist) {
          bestDist = dist;
          best = s;
        }
      }
      assignment[j * samplesX + i] = best;
    }
  }
  const regions = [];
  for (let s = 0; s < clamped.length; s++) {
    const component = largestComponent(assignment, samplesX, samplesY, s);
    if (!component || component.size === 0) {
      regions.push({ key: clamped[s].key, ring: [], sampleCount: 0 });
      continue;
    }
    const ring = traceBoundary(component, samplesX, samplesY).map(
      ([gx, gy]) => [gx / samplesX, gy / samplesY]
    );
    regions.push({ key: clamped[s].key, ring, sampleCount: component.size });
  }
  return regions;
}
function largestComponent(assignment, samplesX, samplesY, seedIndex) {
  const total = samplesX * samplesY;
  const visited = new Uint8Array(total);
  let best = null;
  for (let idx = 0; idx < total; idx++) {
    if (assignment[idx] !== seedIndex || visited[idx]) continue;
    const stack = [idx];
    visited[idx] = 1;
    const comp = [];
    while (stack.length) {
      const cur = stack.pop();
      comp.push(cur);
      const ci = cur % samplesX;
      const cj = (cur - ci) / samplesX;
      const neighbors = [
        [ci - 1, cj],
        [ci + 1, cj],
        [ci, cj - 1],
        [ci, cj + 1]
      ];
      for (const [ni, nj] of neighbors) {
        if (ni < 0 || ni >= samplesX || nj < 0 || nj >= samplesY) continue;
        const nIdx = nj * samplesX + ni;
        if (visited[nIdx] || assignment[nIdx] !== seedIndex) continue;
        visited[nIdx] = 1;
        stack.push(nIdx);
      }
    }
    if (!best || comp.length > best.length) best = comp;
  }
  return best ? new Set(best) : null;
}
function traceBoundary(component, samplesX, samplesY) {
  const filled = (ci, cj) => {
    if (ci < 0 || ci >= samplesX || cj < 0 || cj >= samplesY) return false;
    return component.has(cj * samplesX + ci);
  };
  const edges = [];
  for (const idx of component) {
    const ci = idx % samplesX;
    const cj = (idx - ci) / samplesX;
    const tl = [ci, cj];
    const tr = [ci + 1, cj];
    const br = [ci + 1, cj + 1];
    const bl = [ci, cj + 1];
    if (!filled(ci, cj - 1)) edges.push({ from: tl, to: tr });
    if (!filled(ci + 1, cj)) edges.push({ from: tr, to: br });
    if (!filled(ci, cj + 1)) edges.push({ from: br, to: bl });
    if (!filled(ci - 1, cj)) edges.push({ from: bl, to: tl });
  }
  const key = (p) => `${p[0]},${p[1]}`;
  const byStart = /* @__PURE__ */ new Map();
  for (const e of edges) {
    const k = key(e.from);
    const list = byStart.get(k);
    if (list) list.push(e);
    else byStart.set(k, [e]);
  }
  const used = /* @__PURE__ */ new Set();
  const loops = [];
  for (const start of edges) {
    if (used.has(start)) continue;
    const loop = [start.from];
    let current = start;
    while (current) {
      used.add(current);
      loop.push(current.to);
      if (current.to[0] === loop[0][0] && current.to[1] === loop[0][1]) break;
      const candidates = byStart.get(key(current.to)) ?? [];
      current = candidates.find((c) => !used.has(c));
    }
    loops.push(loop);
  }
  if (!loops.length) return [];
  let outer = loops[0];
  let outerArea = 0;
  for (const loop of loops) {
    const area = Math.abs(shoelace(loop));
    if (area > outerArea) {
      outerArea = area;
      outer = loop;
    }
  }
  return simplifyCollinear(outer);
}
function shoelace(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}
function simplifyCollinear(ring) {
  if (ring.length <= 4) return ring.slice();
  const pts = ring.slice(0, -1);
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const cross = (cur[0] - prev[0]) * (next[1] - cur[1]) - (cur[1] - prev[1]) * (next[0] - cur[0]);
    if (cross !== 0) out.push(cur);
  }
  if (!out.length) return ring.slice();
  out.push(out[0]);
  return out;
}

// ../atlas/src/name-culture.ts
var CULTURE_PROFILES = [
  {
    key: "nordisch",
    label: "Nordisch",
    onsets: ["Thor", "Grim", "Ulf", "Bjor", "Stein", "Frost", "Vald", "Ragn", "Sig", "Ost", "Nord", "Hrafn"],
    middles: ["en", "ar", "ol", "or", "und", "in"],
    endings: {
      settlement: ["heim", "fjord", "gard", "borg", "vik", "holm"],
      region: ["mark", "land", "gau", "reik"],
      river: ["strom", "bach", "elv", "fluss"],
      mountain: ["fjell", "horn", "spitze", "klippe"]
    },
    compoundChance: 0.18,
    prefixes: ["Alt-", "Ober-", "Nieder-"]
  },
  {
    key: "elbisch",
    label: "Elbisch",
    onsets: ["Ael", "Sil", "Gal", "Lor", "Mith", "Eryn", "Cael", "Fael", "Ithil", "Nyra", "Elu", "Syl"],
    middles: ["ia", "ie", "ael", "il", "en", "or"],
    endings: {
      settlement: ["iel", "lond", "thil", "mir", "dor"],
      region: ["nor", "wen", "driel", "ath"],
      river: ["duin", "nen", "ril", "wen"],
      mountain: ["dor", "tir", "orod", "thal"]
    },
    compoundChance: 0.12,
    prefixes: ["Alt-", "Hoch-"]
  },
  {
    key: "zwergisch",
    label: "Zwergisch",
    onsets: ["Thrain", "Dur", "Grom", "Bal", "Karn", "Ug", "Thok", "Brom", "Krag", "Dor", "Nain", "Bofur"],
    middles: ["un", "or", "ak", "um", "ol", "in"],
    endings: {
      settlement: ["barak", "dun", "grimm", "hold", "feste"],
      region: ["reich", "mark", "hold"],
      river: ["bach", "quell", "strom"],
      mountain: ["berg", "klamm", "schacht", "horn"]
    },
    compoundChance: 0.2,
    prefixes: ["Unter-", "Ober-"]
  },
  {
    key: "wuestenland",
    label: "Wüstenländisch",
    onsets: ["Al", "Sar", "Kaz", "Zahir", "Bas", "Nadir", "Qasr", "Ras", "Tamir", "Zan", "Amir", "Yusar"],
    middles: ["a", "i", "u", "ar", "an", "ir"],
    endings: {
      settlement: ["abad", "iyya", "sar", "kand"],
      region: ["sahra", "stan", "iyya"],
      river: ["wadi", "nahr", "oase"],
      mountain: ["kamm", "dar", "jabal", "riff"]
    },
    compoundChance: 0.1,
    prefixes: ["Al-", "Bir-"]
  },
  {
    key: "imperial",
    label: "Imperial / Altweltlich",
    onsets: ["Val", "Cor", "Aur", "Sever", "Max", "Octa", "Luc", "Traja", "Domin", "Fla", "Ner", "Aug"],
    middles: ["an", "or", "in", "ur", "es", "ia"],
    endings: {
      settlement: ["ia", "polis", "anum", "opolis", "ium"],
      region: ["ien", "anien", "ia"],
      river: ["us", "fluvium", "onus"],
      mountain: ["mons", "us", "anum"]
    },
    compoundChance: 0.08,
    prefixes: ["Neu-", "Alt-"]
  },
  {
    key: "sumpfland",
    label: "Sumpfländisch",
    onsets: ["Schlick", "Moor", "Nebel", "Faul", "Ried", "Sump", "Kroet", "Morast", "Duster", "Trueb", "Moder", "Fenn"],
    middles: ["en", "el", "ig", "um", "ach", "or"],
    endings: {
      settlement: ["moor", "bruch", "fenn", "ried", "sumpf"],
      region: ["moor", "marsch", "bruch"],
      river: ["ried", "lache", "tuempel"],
      mountain: ["kuppe", "horst", "damm"]
    },
    compoundChance: 0.15,
    prefixes: ["Nieder-", "Hinter-"]
  }
];
function listCultureProfiles() {
  return [...CULTURE_PROFILES];
}
function getCultureProfile(key) {
  if (!key) return void 0;
  return CULTURE_PROFILES.find((profile) => profile.key === key);
}
var DEFAULT_COUNT = 8;
var MIN_COUNT = 1;
var MAX_COUNT = 24;
var MIDDLE_CHANCE = 0.55;
var PREFIX_CHANCE = 0.15;
var MAX_ATTEMPTS_PER_NAME = 60;
var MAX_EXTENDED_ROUNDS = 16;
function pick(items, rng) {
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index];
}
function capitalize(word) {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}
function buildName(profile, kind, rng, middleCount) {
  const onset = pick(profile.onsets, rng).toLowerCase();
  const count = middleCount ?? (rng() < MIDDLE_CHANCE ? 1 : 0);
  let middles = "";
  for (let i = 0; i < count; i++) middles += pick(profile.middles, rng).toLowerCase();
  const ending = pick(profile.endings[kind], rng).toLowerCase();
  let core = onset + middles + ending;
  if (profile.compoundChance && rng() < profile.compoundChance) {
    core = pick(profile.onsets, rng).toLowerCase() + core;
  }
  let name = capitalize(core);
  if (profile.prefixes && profile.prefixes.length > 0 && rng() < PREFIX_CHANCE) {
    name = pick(profile.prefixes, rng) + name;
  }
  return name;
}
function buildUniqueName(profile, kind, rng, used) {
  for (let i = 0; i < MAX_ATTEMPTS_PER_NAME; i++) {
    const candidate = buildName(profile, kind, rng);
    if (!used.has(candidate)) return candidate;
  }
  for (let extra = 2; extra <= MAX_EXTENDED_ROUNDS; extra++) {
    for (let i = 0; i < MAX_ATTEMPTS_PER_NAME; i++) {
      const candidate = buildName(profile, kind, rng, extra);
      if (!used.has(candidate)) return candidate;
    }
  }
  return buildName(profile, kind, rng, MAX_EXTENDED_ROUNDS);
}
function clampCount(count) {
  const raw = Number.isFinite(count) ? count : DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(raw)));
}
function generatePlaceNames(opts) {
  const profile = getCultureProfile(opts.culture) ?? CULTURE_PROFILES[0];
  if (!profile) return [];
  const count = clampCount(opts.count);
  const seed = opts.seed ?? hashStringToSeed(opts.culture + opts.kind);
  const rng = mulberry32(seed);
  const used = /* @__PURE__ */ new Set();
  const names = [];
  for (let i = 0; i < count; i++) {
    const name = buildUniqueName(profile, opts.kind, rng, used);
    used.add(name);
    names.push(name);
  }
  return names;
}

// ../atlas/src/rtx-asset-prompt-context.ts
var RTX_ATLAS_ASSET_STYLEGUIDE_EXCERPT = [
  "Gouache assets use filled painterly shapes with body color, darker pigment edge, shadow, and highlight.",
  "The object anchor is base-center: the placement point sits at the lower middle and the drawing grows upward.",
  "Use muted map colors: earthy reds, ochres, greens, greys, and blues; no bright UI colors or photoreal textures.",
  "Never copy external Canvas of Kings assets; proposals must be original data reviewed by UWE."
];
var RTX_ATLAS_ASSET_CATALOG_EXCERPT = [
  "Stamp is a single AtlasObject asset; Plot fills an area; Path follows routes; Landmark can use pseudo-3D shadow/aura.",
  "Gen assets are settlement-generator parts; Terrain assets affect biome or ground texture.",
  "Useful backlog examples include fields, swamps, cliffs, ruins, market variants, ships, bridges, harbors, and fantasy landmarks."
];

// ../atlas/src/rtx-asset-proposal.ts
var RTX_ATLAS_ASSET_STYLEGUIDE_PATH = "docs/prompts/atlas-pictogram-styleguide.md";
var RTX_ATLAS_ASSET_CATALOG_PATH = "docs/design/atlas-redesign/asset-catalog.md";
var RTX_ATLAS_ASSET_REGISTRY_EXPORT = "@uwe/atlas/assets#GOUACHE_ASSETS";
var RTX_ATLAS_ASSET_OUTPUT_TYPES = ["json-recipe", "png-fallback"];
var RTX_ATLAS_ASSET_ENGINE_TAGS = ["Stamp", "Plot", "Path", "Landmark", "Gen", "Terrain"];
var RTX_GOUACHE_RECIPE_LAYER_ROLES = ["shadow", "base", "highlight", "detail", "outline"];
var RTX_GOUACHE_RECIPE_SHAPES = ["ellipse", "rect", "polygon", "path"];
var RTX_ATLAS_ASSET_GOUACHE_CATEGORIES = Object.keys(
  GOUACHE_CATEGORY_LABELS
);
var TOP_LEVEL_KEYS2 = [
  "name",
  "category",
  "tags",
  "engineTags",
  "palette",
  "prompt",
  "rationale",
  "styleguideNotes",
  "outputType",
  "recipe",
  "pngFallback"
];
var RECIPE_KEYS = ["schemaVersion", "coordinateSystem", "description", "layers"];
var LAYER_KEYS = [
  "id",
  "role",
  "shape",
  "fill",
  "stroke",
  "opacity",
  "lineWidth",
  "x",
  "y",
  "width",
  "height",
  "rx",
  "ry",
  "rotation",
  "points",
  "path"
];
var PNG_KEYS = [
  "mimeType",
  "width",
  "height",
  "transparentBackground",
  "filename",
  "sha256",
  "altText",
  "notes"
];
var NUMERIC_LAYER_RANGES = {
  opacity: [0, 1],
  lineWidth: [0, 10],
  x: [-4, 4],
  y: [-4, 4],
  width: [0, 8],
  height: [0, 8],
  rx: [0, 8],
  ry: [0, 8],
  rotation: [-Math.PI * 2, Math.PI * 2]
};
var SHAPE_REQUIRED_NUMBERS = {
  ellipse: ["x", "y", "rx", "ry"],
  rect: ["x", "y", "width", "height"]
};
var EXECUTABLE_KEYS2 = /* @__PURE__ */ new Set([
  "code",
  "sourcecode",
  "script",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "executable",
  "functionbody",
  "renderfunction",
  "drawfunction"
]);
var EXECUTABLE_TEXT2 = [
  /<\s*script\b/i,
  /\b(?:function|class)\s+[A-Za-z_$]/,
  /=>/,
  /\bimport\s+(?:type\s+)?(?:\{|[A-Za-z_$*])/,
  /\bexport\s+(?:default|function|class|const|let|var|\{|\*)/,
  /\b(?:eval|Function|setTimeout|setInterval)\s*\(/,
  /\b(?:require|process|child_process|Deno)\b/
];
var HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
var SAFE_ID = /^[a-z][a-z0-9_-]{1,47}$/i;
var SAFE_FILENAME = /^[a-z0-9][a-z0-9._-]{0,95}\.png$/i;
var SAFE_PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9,.\-\s]+$/;
function add2(issues, path, code, message) {
  issues.push({ path, code, message });
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isAllowed(value, allowed) {
  return typeof value === "string" && allowed.includes(value);
}
function rejectUnknown2(obj, allowed, path, issues) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      add2(issues, `${path}.${key}`, "unexpected_field", `Unexpected field "${key}".`);
    }
  }
}
function scanExecutable2(value, path, issues, seen = /* @__PURE__ */ new WeakSet()) {
  if (typeof value === "function") {
    add2(issues, path, "executable_code", "Function values are not accepted.");
    return;
  }
  if (typeof value === "string") {
    if (EXECUTABLE_TEXT2.some((pattern) => pattern.test(value))) {
      add2(issues, path, "executable_code", "Executable source text is not accepted.");
    }
    return;
  }
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanExecutable2(entry, `${path}[${index}]`, issues, seen));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (EXECUTABLE_KEYS2.has(key.toLowerCase())) {
      add2(issues, `${path}.${key}`, "executable_code", `Executable field "${key}" is not accepted.`);
    }
    scanExecutable2(entry, `${path}.${key}`, issues, seen);
  }
}
function stringValue2(obj, key, path, issues, opts = {}) {
  const value = obj[key];
  if (value === void 0) {
    if (opts.required) add2(issues, `${path}.${key}`, "missing_field", `${key} is required.`);
    return void 0;
  }
  if (typeof value !== "string") {
    add2(issues, `${path}.${key}`, "invalid_type", `${key} must be a string.`);
    return void 0;
  }
  const trimmed = value.trim();
  if (!trimmed || opts.max !== void 0 && trimmed.length > opts.max) {
    add2(issues, `${path}.${key}`, "invalid_value", `${key} is empty or too long.`);
    return void 0;
  }
  return trimmed;
}
function numberValue2(obj, key, path, issues, opts = {}) {
  const value = obj[key];
  if (value === void 0) {
    if (opts.required) add2(issues, `${path}.${key}`, "missing_field", `${key} is required.`);
    return void 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    add2(issues, `${path}.${key}`, "invalid_type", `${key} must be a finite number.`);
    return void 0;
  }
  if (opts.integer && !Number.isInteger(value)) {
    add2(issues, `${path}.${key}`, "invalid_value", `${key} must be an integer.`);
  }
  if (opts.min !== void 0 && value < opts.min) {
    add2(issues, `${path}.${key}`, "invalid_value", `${key} must be >= ${opts.min}.`);
  }
  if (opts.max !== void 0 && value > opts.max) {
    add2(issues, `${path}.${key}`, "invalid_value", `${key} must be <= ${opts.max}.`);
  }
  return value;
}
function stringArray(obj, key, path, issues, opts) {
  const value = obj[key];
  if (value === void 0) return [];
  if (!Array.isArray(value)) {
    add2(issues, `${path}.${key}`, "invalid_type", `${key} must be an array.`);
    return [];
  }
  if (value.length > opts.maxItems) {
    add2(issues, `${path}.${key}`, "invalid_value", `${key} has too many items.`);
  }
  return value.slice(0, opts.maxItems).flatMap((entry, index) => {
    if (typeof entry !== "string") {
      add2(issues, `${path}.${key}[${index}]`, "invalid_type", `${key} entries must be strings.`);
      return [];
    }
    const trimmed = entry.trim();
    if (!trimmed || trimmed.length > opts.maxLength || opts.pattern && !opts.pattern.test(trimmed)) {
      add2(issues, `${path}.${key}[${index}]`, "invalid_value", `${key} entry is invalid.`);
      return [];
    }
    return [trimmed];
  });
}
function parseEngineTags(obj, path, issues) {
  const value = obj.engineTags;
  if (value === void 0) return [];
  if (!Array.isArray(value)) {
    add2(issues, `${path}.engineTags`, "invalid_type", "engineTags must be an array.");
    return [];
  }
  const tags = [];
  value.forEach((entry, index) => {
    if (!isAllowed(entry, RTX_ATLAS_ASSET_ENGINE_TAGS)) {
      add2(issues, `${path}.engineTags[${index}]`, "invalid_value", "Unknown asset catalog engine tag.");
      return;
    }
    if (!tags.includes(entry)) tags.push(entry);
  });
  return tags;
}
function parsePoints(value, path, issues, minPoints) {
  if (value === void 0) return void 0;
  if (!Array.isArray(value) || value.length < minPoints || value.length > 64) {
    add2(issues, path, "invalid_value", `points must contain ${minPoints}-64 [x, y] entries.`);
    return void 0;
  }
  const points = [];
  value.forEach((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "number" || typeof entry[1] !== "number" || !Number.isFinite(entry[0]) || !Number.isFinite(entry[1]) || entry[0] < -4 || entry[0] > 4 || entry[1] < -4 || entry[1] > 4) {
      add2(issues, `${path}[${index}]`, "invalid_value", "points entries must be normalized [x, y] numbers.");
      return;
    }
    points.push([entry[0], entry[1]]);
  });
  return points;
}
function parseLayer(raw, path, issues) {
  if (!isRecord2(raw)) {
    add2(issues, path, "invalid_type", "Recipe layers must be objects.");
    return null;
  }
  const before2 = issues.length;
  rejectUnknown2(raw, LAYER_KEYS, path, issues);
  const id = stringValue2(raw, "id", path, issues, { required: true, max: 48 });
  if (id && !SAFE_ID.test(id)) add2(issues, `${path}.id`, "invalid_value", "Layer id must be slug-like.");
  const role = isAllowed(raw.role, RTX_GOUACHE_RECIPE_LAYER_ROLES) ? raw.role : void 0;
  if (!role) add2(issues, `${path}.role`, "invalid_value", "Unknown layer role.");
  const shape = isAllowed(raw.shape, RTX_GOUACHE_RECIPE_SHAPES) ? raw.shape : void 0;
  if (!shape) add2(issues, `${path}.shape`, "invalid_value", "Unknown layer shape.");
  const fill = stringValue2(raw, "fill", path, issues, { max: 16 });
  if (fill && !HEX_COLOR.test(fill)) add2(issues, `${path}.fill`, "invalid_value", "fill must be a hex color.");
  const stroke = stringValue2(raw, "stroke", path, issues, { max: 16 });
  if (stroke && !HEX_COLOR.test(stroke)) add2(issues, `${path}.stroke`, "invalid_value", "stroke must be a hex color.");
  if (!id || !role || !shape) return null;
  const layer = { id, role, shape };
  if (fill) layer.fill = fill;
  if (stroke) layer.stroke = stroke;
  for (const field of Object.keys(NUMERIC_LAYER_RANGES)) {
    const [min, max] = NUMERIC_LAYER_RANGES[field];
    const value = numberValue2(raw, field, path, issues, { min, max });
    if (value !== void 0) layer[field] = value;
  }
  for (const field of SHAPE_REQUIRED_NUMBERS[shape] ?? []) {
    if (raw[field] === void 0) add2(issues, `${path}.${field}`, "missing_field", `${field} is required for ${shape}.`);
  }
  const minPoints = shape === "polygon" ? 3 : 2;
  const points = parsePoints(raw.points, `${path}.points`, issues, minPoints);
  if (points) layer.points = points;
  if (shape === "polygon" && !points) add2(issues, `${path}.points`, "missing_field", "polygon layers require points.");
  const pathData = stringValue2(raw, "path", path, issues, { max: 1200 });
  if (pathData && !SAFE_PATH.test(pathData)) {
    add2(issues, `${path}.path`, "invalid_value", "path must contain SVG path commands and numbers only.");
  }
  if (pathData) layer.path = pathData;
  if (shape === "path" && !pathData) add2(issues, `${path}.path`, "missing_field", "path layers require path.");
  return issues.length === before2 ? layer : null;
}
function parseRecipe(raw, path, issues) {
  if (!isRecord2(raw)) {
    add2(issues, path, "invalid_type", "recipe must be an object.");
    return null;
  }
  const before2 = issues.length;
  rejectUnknown2(raw, RECIPE_KEYS, path, issues);
  if (raw.schemaVersion !== 1) add2(issues, `${path}.schemaVersion`, "invalid_value", "schemaVersion must be 1.");
  if (raw.coordinateSystem !== void 0 && raw.coordinateSystem !== "base-center-normalized") {
    add2(issues, `${path}.coordinateSystem`, "invalid_value", "coordinateSystem must be base-center-normalized.");
  }
  if (!Array.isArray(raw.layers) || raw.layers.length === 0 || raw.layers.length > 64) {
    add2(issues, `${path}.layers`, "invalid_value", "recipe.layers must contain 1-64 layer objects.");
  }
  const description = stringValue2(raw, "description", path, issues, { max: 500 });
  const layers = Array.isArray(raw.layers) ? raw.layers.flatMap((layer, index) => {
    const parsed = parseLayer(layer, `${path}.layers[${index}]`, issues);
    return parsed ? [parsed] : [];
  }) : [];
  if (issues.length !== before2) return null;
  return {
    schemaVersion: 1,
    coordinateSystem: "base-center-normalized",
    ...description ? { description } : {},
    layers
  };
}
function parsePngFallback(raw, path, issues) {
  if (!isRecord2(raw)) {
    add2(issues, path, "invalid_type", "pngFallback must be an object.");
    return null;
  }
  const before2 = issues.length;
  rejectUnknown2(raw, PNG_KEYS, path, issues);
  if (raw.mimeType !== "image/png") add2(issues, `${path}.mimeType`, "invalid_value", "mimeType must be image/png.");
  const width = numberValue2(raw, "width", path, issues, { required: true, integer: true, min: 1, max: 4096 });
  const height = numberValue2(raw, "height", path, issues, { required: true, integer: true, min: 1, max: 4096 });
  if (typeof raw.transparentBackground !== "boolean") {
    add2(issues, `${path}.transparentBackground`, "missing_field", "transparentBackground must be a boolean.");
  }
  const filename = stringValue2(raw, "filename", path, issues, { max: 100 });
  if (filename && !SAFE_FILENAME.test(filename)) {
    add2(issues, `${path}.filename`, "invalid_value", "filename must be a safe .png filename.");
  }
  const sha256 = stringValue2(raw, "sha256", path, issues, { max: 64 });
  if (sha256 && !/^[0-9a-f]{64}$/i.test(sha256)) {
    add2(issues, `${path}.sha256`, "invalid_value", "sha256 must be 64 hex chars.");
  }
  const altText = stringValue2(raw, "altText", path, issues, { max: 240 });
  const notes = stringValue2(raw, "notes", path, issues, { max: 500 });
  if (issues.length !== before2 || width === void 0 || height === void 0 || typeof raw.transparentBackground !== "boolean") {
    return null;
  }
  return {
    mimeType: "image/png",
    width,
    height,
    transparentBackground: raw.transparentBackground,
    ...filename ? { filename } : {},
    ...sha256 ? { sha256 } : {},
    ...altText ? { altText } : {},
    ...notes ? { notes } : {}
  };
}
function inferOutputType(obj, issues) {
  if (obj.outputType !== void 0) {
    if (isAllowed(obj.outputType, RTX_ATLAS_ASSET_OUTPUT_TYPES)) return obj.outputType;
    add2(issues, "$.outputType", "invalid_value", "outputType must be json-recipe or png-fallback.");
    return void 0;
  }
  if (obj.recipe !== void 0 && obj.pngFallback === void 0) return "json-recipe";
  if (obj.pngFallback !== void 0 && obj.recipe === void 0) return "png-fallback";
  add2(issues, "$.outputType", "missing_field", "Provide outputType or exactly one of recipe/pngFallback.");
  return void 0;
}
function validateRtxAtlasAssetProposal(raw) {
  const errors = [];
  scanExecutable2(raw, "$", errors);
  if (!isRecord2(raw)) {
    add2(errors, "$", "invalid_type", "Proposal must be a JSON object.");
    return { ok: false, errors };
  }
  rejectUnknown2(raw, TOP_LEVEL_KEYS2, "$", errors);
  const name = stringValue2(raw, "name", "$", errors, { required: true, max: 80 });
  const category = isAllowed(raw.category, RTX_ATLAS_ASSET_GOUACHE_CATEGORIES) ? raw.category : void 0;
  if (!category) add2(errors, "$.category", "invalid_value", "Unknown Gouache category.");
  const tags = stringArray(raw, "tags", "$", errors, { maxItems: 12, maxLength: 40 });
  const engineTags = parseEngineTags(raw, "$", errors);
  const palette = stringArray(raw, "palette", "$", errors, { maxItems: 8, maxLength: 16, pattern: HEX_COLOR });
  const prompt = stringValue2(raw, "prompt", "$", errors, { max: 280 });
  const rationale = stringValue2(raw, "rationale", "$", errors, { max: 800 });
  const styleguideNotes = stringValue2(raw, "styleguideNotes", "$", errors, { max: 800 });
  const outputType = inferOutputType(raw, errors);
  if (raw.recipe !== void 0 && raw.pngFallback !== void 0) {
    add2(errors, "$", "invalid_value", "Provide a JSON recipe or PNG fallback metadata, not both.");
  }
  const recipe = outputType === "json-recipe" ? parseRecipe(raw.recipe, "$.recipe", errors) : void 0;
  const pngFallback = outputType === "png-fallback" ? parsePngFallback(raw.pngFallback, "$.pngFallback", errors) : void 0;
  if (errors.length > 0 || !name || !category || !outputType) return { ok: false, errors };
  const base = {
    name,
    category,
    tags,
    engineTags,
    palette,
    ...prompt ? { prompt } : {},
    ...rationale ? { rationale } : {},
    ...styleguideNotes ? { styleguideNotes } : {}
  };
  if (outputType === "json-recipe" && recipe) {
    return { ok: true, proposal: { ...base, outputType, recipe }, warnings: [] };
  }
  if (outputType === "png-fallback" && pngFallback) {
    return { ok: true, proposal: { ...base, outputType, pngFallback }, warnings: [] };
  }
  return {
    ok: false,
    errors: [{
      path: "$.outputType",
      code: "missing_field",
      message: "A valid JSON recipe or PNG fallback metadata is required."
    }]
  };
}
function isRtxAtlasAssetProposal(raw) {
  return validateRtxAtlasAssetProposal(raw).ok;
}
function buildRtxAtlasAssetPromptContext(assets = GOUACHE_ASSETS) {
  return {
    styleguidePath: RTX_ATLAS_ASSET_STYLEGUIDE_PATH,
    assetCatalogPath: RTX_ATLAS_ASSET_CATALOG_PATH,
    registryExport: RTX_ATLAS_ASSET_REGISTRY_EXPORT,
    acceptedOutputs: [...RTX_ATLAS_ASSET_OUTPUT_TYPES],
    gouacheCategories: [...RTX_ATLAS_ASSET_GOUACHE_CATEGORIES],
    assetCatalogTags: [...RTX_ATLAS_ASSET_ENGINE_TAGS],
    existingAssets: assets.map((asset) => ({
      key: asset.key,
      name: asset.name,
      category: asset.category
    })),
    styleguideExcerpt: [...RTX_ATLAS_ASSET_STYLEGUIDE_EXCERPT],
    assetCatalogExcerpt: [...RTX_ATLAS_ASSET_CATALOG_EXCERPT],
    rules: [
      "Use the Atlas pictogram styleguide as the visual and review source.",
      "Use the asset catalog for backlog tags and engine placement context.",
      "Return either a json-recipe object or png-fallback metadata.",
      "Do not return JavaScript, TypeScript, JSX, TSX, HTML, scripts, or functions.",
      "RTX proposals are review inputs and must not auto-apply."
    ]
  };
}
function formatRtxAtlasAssetPromptContext(context = buildRtxAtlasAssetPromptContext()) {
  const existingAssets = context.existingAssets.map((asset) => `${asset.key} (${asset.category}: ${asset.name})`).join(", ");
  return [
    "Atlas RTX Gouache asset context:",
    `- Styleguide: ${context.styleguidePath}`,
    `- Asset catalog/backlog: ${context.assetCatalogPath}`,
    `- Existing registry: ${context.registryExport}`,
    `- Accepted outputs: ${context.acceptedOutputs.join(", ")}`,
    `- Gouache categories: ${context.gouacheCategories.join(", ")}`,
    `- Asset catalog engine tags: ${context.assetCatalogTags.join(", ")}`,
    `- Existing Gouache assets: ${existingAssets || "none"}`,
    `- Styleguide excerpt: ${context.styleguideExcerpt.join(" ")}`,
    `- Asset catalog excerpt: ${context.assetCatalogExcerpt.join(" ")}`,
    "- Security: JSON recipe data or PNG fallback metadata only; no executable code.",
    "- Review flow: return a proposal for UWE validation, not an auto-applied asset."
  ].join("\n");
}

// ../atlas/src/rtx-asset-preview.ts
var RTX_RECIPE_NORMALIZED_EXTENT = 4;
var RTX_RECIPE_ROLE_DEFAULT_OPACITY = {
  shadow: 0.2,
  base: 1,
  highlight: 0.85,
  detail: 1,
  outline: 1
};
var HEX_COLOR2 = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
var TAU = Math.PI * 2;
var PATH_ARG_COUNTS = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  Q: 4,
  C: 6,
  Z: 0
};
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function safeHexColor(value) {
  return typeof value === "string" && HEX_COLOR2.test(value) ? value : void 0;
}
function clamp016(value) {
  return Math.min(1, Math.max(0, value));
}
function buildEllipseOps(layer, project, unit) {
  const { x, y, rx, ry } = layer;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(rx) || !isFiniteNumber(ry)) return null;
  if (rx < 0 || ry < 0) return null;
  const [px, py] = project(x, y);
  const rotation = isFiniteNumber(layer.rotation) ? layer.rotation : 0;
  return [["ellipse", px, py, rx * unit, ry * unit, rotation, 0, TAU]];
}
function buildRectOps(layer, project, unit) {
  const { x, y, width, height } = layer;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) return null;
  if (width < 0 || height < 0) return null;
  const rotation = isFiniteNumber(layer.rotation) ? layer.rotation : 0;
  const [cx, cy] = project(x, y);
  const hw = width / 2 * unit;
  const hh = height / 2 * unit;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corners = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh]
  ].map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
  const ops = [["moveTo", corners[0][0], corners[0][1]]];
  for (const [px, py] of corners.slice(1)) ops.push(["lineTo", px, py]);
  ops.push(["closePath"]);
  return ops;
}
function buildPolygonOps(layer, project) {
  const points = layer.points;
  if (!Array.isArray(points) || points.length < 3) return null;
  const projected = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2 || !isFiniteNumber(point[0]) || !isFiniteNumber(point[1])) {
      return null;
    }
    projected.push(project(point[0], point[1]));
  }
  const ops = [["moveTo", projected[0][0], projected[0][1]]];
  for (const [px, py] of projected.slice(1)) ops.push(["lineTo", px, py]);
  ops.push(["closePath"]);
  return ops;
}
function buildPathOps(layer, project) {
  const d = layer.path;
  if (typeof d !== "string" || !d.trim()) return null;
  const groups = d.match(/[A-Za-z][^A-Za-z]*/g);
  if (!groups || !groups.join("").trim()) return null;
  if (d.slice(0, d.indexOf(groups[0])).trim()) return null;
  const ops = [];
  let nx = 0;
  let ny = 0;
  for (const group of groups) {
    const op = group[0];
    const argCount = PATH_ARG_COUNTS[op];
    if (argCount === void 0) return null;
    const args = group.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (args.some((value) => !Number.isFinite(value))) return null;
    if (argCount === 0) {
      if (args.length > 0) return null;
      ops.push(["closePath"]);
      continue;
    }
    if (args.length === 0 || args.length % argCount !== 0) return null;
    for (let i = 0; i < args.length; i += argCount) {
      switch (op) {
        case "M": {
          nx = args[i];
          ny = args[i + 1];
          ops.push([i === 0 ? "moveTo" : "lineTo", ...project(nx, ny)]);
          break;
        }
        case "L": {
          nx = args[i];
          ny = args[i + 1];
          ops.push(["lineTo", ...project(nx, ny)]);
          break;
        }
        case "H": {
          nx = args[i];
          ops.push(["lineTo", ...project(nx, ny)]);
          break;
        }
        case "V": {
          ny = args[i];
          ops.push(["lineTo", ...project(nx, ny)]);
          break;
        }
        case "Q": {
          const cp = project(args[i], args[i + 1]);
          nx = args[i + 2];
          ny = args[i + 3];
          ops.push(["quadraticCurveTo", cp[0], cp[1], ...project(nx, ny)]);
          break;
        }
        case "C": {
          const c1 = project(args[i], args[i + 1]);
          const c2 = project(args[i + 2], args[i + 3]);
          nx = args[i + 4];
          ny = args[i + 5];
          ops.push(["bezierCurveTo", c1[0], c1[1], c2[0], c2[1], ...project(nx, ny)]);
          break;
        }
      }
    }
  }
  return ops.length > 0 ? ops : null;
}
function buildLayerOps(layer, project, unit) {
  switch (layer.shape) {
    case "ellipse":
      return buildEllipseOps(layer, project, unit);
    case "rect":
      return buildRectOps(layer, project, unit);
    case "polygon":
      return buildPolygonOps(layer, project);
    case "path":
      return buildPathOps(layer, project);
    default:
      return null;
  }
}
function isDrawableRecipe(recipe) {
  return typeof recipe === "object" && recipe !== null && !Array.isArray(recipe) && recipe.schemaVersion === 1 && Array.isArray(recipe.layers) && recipe.layers.length > 0;
}
function drawRtxGouacheRecipePreview(ctx, recipe, opts) {
  if (!ctx || !isDrawableRecipe(recipe)) return;
  if (!isFiniteNumber(opts.x) || !isFiniteNumber(opts.y)) return;
  const unit = opts.unitScale ?? 16;
  if (!isFiniteNumber(unit) || unit <= 0) return;
  const fallbackLineWidth = isFiniteNumber(opts.lineWidth) && opts.lineWidth > 0 ? opts.lineWidth : 1.4;
  const project = (nx, ny) => [opts.x + nx * unit, opts.y + ny * unit];
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const layer of recipe.layers) {
    if (typeof layer !== "object" || layer === null) continue;
    const fill = safeHexColor(layer.fill);
    const stroke = safeHexColor(layer.stroke);
    if (!fill && !stroke) continue;
    const ops = buildLayerOps(layer, project, unit);
    if (!ops) continue;
    const roleDefault = RTX_RECIPE_ROLE_DEFAULT_OPACITY[layer.role] ?? 1;
    ctx.globalAlpha = clamp016(isFiniteNumber(layer.opacity) ? layer.opacity : roleDefault);
    ctx.beginPath();
    for (const [name, ...args] of ops) {
      ctx[name](...args);
    }
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    const strokeWidth = isFiniteNumber(layer.lineWidth) ? layer.lineWidth : fallbackLineWidth;
    if (stroke && strokeWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }
  ctx.restore();
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

// ../atlas/src/draft-proposal.ts
var KIND_ALIASES = {
  coastline: AtlasFeatureKind.region,
  region: AtlasFeatureKind.region,
  forest: AtlasFeatureKind.biome,
  biome: AtlasFeatureKind.biome,
  mountain: AtlasFeatureKind.relief,
  relief: AtlasFeatureKind.relief,
  river: AtlasFeatureKind.river,
  road: AtlasFeatureKind.road,
  city: AtlasFeatureKind.pin,
  pin: AtlasFeatureKind.pin,
  plot: AtlasFeatureKind.plot
};
var DEFAULT_LAYER = {
  region: LAYER_Z.relief,
  river: LAYER_Z.rivers,
  road: LAYER_Z.roads,
  biome: LAYER_Z.biome,
  relief: LAYER_Z.relief,
  pin: LAYER_Z.objects,
  plot: 18
};
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function jsonRecord(value, maxKeys = 24) {
  if (!isRecord3(value)) return void 0;
  const out = {};
  for (const [key, entry] of Object.entries(value).slice(0, maxKeys)) {
    if (entry == null || typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      out[key] = entry;
    }
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function safeString(value, maxLength) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : void 0;
}
function resolveKind(raw) {
  const kind = typeof raw.kind === "string" ? KIND_ALIASES[raw.kind] : void 0;
  if (kind) return kind;
  return typeof raw.atlasKind === "string" ? KIND_ALIASES[raw.atlasKind] ?? null : null;
}
function geometryMatchesKind(kind, geometry) {
  if (kind === "region" || kind === "biome" || kind === "plot") return geometry.type === "Polygon";
  if (kind === "river" || kind === "road" || kind === "relief") return geometry.type === "Path";
  return kind === "pin" && geometry.type === "Point";
}
function resolveBiome(raw, style) {
  const candidate = typeof style.biomeKind === "string" ? style.biomeKind : raw.biome;
  return typeof candidate === "string" && Object.values(BiomeKind).includes(candidate) ? candidate : void 0;
}
function resolveLayer(raw, kind) {
  return typeof raw.layer === "number" && Number.isFinite(raw.layer) && raw.layer >= 0 && raw.layer <= 100 ? raw.layer : DEFAULT_LAYER[kind];
}
function normalizeAtlasDraftFeature(raw) {
  if (!isRecord3(raw)) return null;
  const kind = resolveKind(raw);
  if (!kind) return null;
  const geometry = tryParseGeometry(raw.geometry);
  if (!geometry || !geometryMatchesKind(kind, geometry)) return null;
  const style = jsonRecord(raw.style) ?? {};
  const biome = resolveBiome(raw, style);
  if (kind === "biome" && biome) style.biomeKind = biome;
  if (kind === "plot") {
    style.plotPreset = "gouache_scatter";
    style.biomeKind = biome ?? BiomeKind.forest;
    style.density = typeof style.density === "number" && Number.isFinite(style.density) ? style.density : 1;
    style.seed = typeof style.seed === "number" && Number.isFinite(style.seed) ? style.seed : hashStringToSeed(String(raw.id ?? raw.labelHint ?? "atlas-plot"));
  }
  return {
    ...safeString(raw.id, 120) ? { id: safeString(raw.id, 120) } : {},
    kind,
    geometry,
    ...Object.keys(style).length > 0 ? { style } : {},
    ...safeString(raw.labelHint, 120) ? { labelHint: safeString(raw.labelHint, 120) } : {},
    labelColor: raw.labelColor === "red" ? "red" : "black",
    layer: resolveLayer(raw, kind),
    ...jsonRecord(raw.meta) ? { meta: jsonRecord(raw.meta) } : {}
  };
}
function normalizeAtlasDraftFeatures(rawFeatures) {
  if (!Array.isArray(rawFeatures)) return [];
  return rawFeatures.map((feature) => normalizeAtlasDraftFeature(feature)).filter((feature) => feature !== null);
}

// ../atlas/src/stamp-prompt.ts
var ATLAS_STAMP_STYLE_PROMPT = "gouache painted fantasy map asset, opaque matte painted map stamp, flat painterly fills with soft shadow and subtle highlight, darker pigment edge outline, muted earth palette on transparent background, top-down-friendly medieval cartography icon, isolated map symbol, no photo, no 3d render, no plain line art, DnD map stamp";
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
var ATLAS_LABEL_PRESETS = {
  region: { key: "region", label: "Region (gesperrt)", sizePx: 15, letterSpacingPx: 2.2, uppercase: true, bold: true, italic: false, halo: true },
  city: { key: "city", label: "Stadt", sizePx: 13, letterSpacingPx: 0.4, uppercase: false, bold: true, italic: false, halo: true },
  river: { key: "river", label: "Fluss (kursiv)", sizePx: 11.5, letterSpacingPx: 1.1, uppercase: false, bold: false, italic: true, halo: false }
};
function resolveLabelPreset(key) {
  return typeof key === "string" ? ATLAS_LABEL_PRESETS[key] : void 0;
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
function clamp017(v) {
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
  const alignToPath = options.alignToPath ?? false;
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
    const segmentAngleDeg = alignToPath ? Math.atan2(uy, ux) * 180 / Math.PI : 0;
    let d = accumulated === 0 ? spacing / 2 : spacing - accumulated;
    while (d <= segLen) {
      const along = (rng() - 0.5) * spacing * jitter;
      const cx = ax + ux * (d + along);
      const cy = ay + uy * (d + along);
      for (const sign of signs) {
        const scale = 0.8 + rng() * 0.4;
        const jitterRotation = (rng() - 0.5) * 2 * rotationRange;
        const rotation = alignToPath ? segmentAngleDeg + jitterRotation : jitterRotation;
        const x = clamp017(cx + px * offset * sign);
        const y = clamp017(cy + py * offset * sign);
        results.push({ glyphKey, x, y, scale, rotation });
      }
      d += spacing;
    }
    accumulated = segLen - (d - spacing);
  }
  return results;
}

// ../atlas/src/settlement-layout.ts
var WALL_CLEARANCE_FACTOR = 0.03;
var OBJECT_SPACING_FACTOR = 0.04;
var ROAD_CLEARANCE_FACTOR = 0.035;
var PLAZA_CLEARANCE_FACTOR = 0.08;
var BEST_CANDIDATE_SAMPLES = 4;
function rotationToward(from, to) {
  return Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
}
function distanceToPaths(point, paths) {
  let nearest = Infinity;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      nearest = Math.min(nearest, distToSegment(point, path[i], path[i + 1]));
    }
  }
  return nearest;
}
function tooClose(point, occupied, minDistance) {
  return occupied.some(([x, y]) => Math.hypot(point[0] - x, point[1] - y) < minDistance);
}
function nearestOccupiedDistance(point, occupied) {
  let nearest = Infinity;
  for (const [x, y] of occupied) {
    nearest = Math.min(nearest, Math.hypot(point[0] - x, point[1] - y));
  }
  return nearest;
}
function pointInRing3(point, ring) {
  const [px, py] = point;
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
function placeSettlementBuildings(input) {
  const placements = [];
  if (input.count <= 0) return placements;
  const [minX, minY, maxX, maxY] = input.bbox;
  const roadClearance = input.span * ROAD_CLEARANCE_FACTOR;
  const plazaClearance = input.span * PLAZA_CLEARANCE_FACTOR;
  const spacing = input.span * OBJECT_SPACING_FACTOR;
  const wallClearance = input.wallRing ? input.span * WALL_CLEARANCE_FACTOR : 0;
  const wallPaths = input.wallRing ? [input.wallRing] : [];
  const blocked = [...input.occupied];
  const budget = input.count * 90 + 100;
  let attempts = 0;
  while (placements.length < input.count && attempts < budget) {
    let best;
    let bestScore = -Infinity;
    let found = 0;
    while (found < BEST_CANDIDATE_SAMPLES && attempts < budget) {
      attempts++;
      const point = [minX + input.rng() * (maxX - minX), minY + input.rng() * (maxY - minY)];
      if (!input.isInterior(point)) continue;
      if (Math.hypot(point[0] - input.center[0], point[1] - input.center[1]) < plazaClearance) continue;
      if (input.roadPaths.length > 0 && distanceToPaths(point, input.roadPaths) < roadClearance) continue;
      if (wallClearance > 0 && distanceToPaths(point, wallPaths) < wallClearance) continue;
      if (input.keepOutRings?.some((ring) => pointInRing3(point, ring))) continue;
      if (tooClose(point, blocked, spacing)) continue;
      found++;
      const score = nearestOccupiedDistance(point, blocked);
      if (score > bestScore) {
        bestScore = score;
        best = point;
      }
    }
    if (!best) continue;
    blocked.push(best);
    placements.push({
      point: best,
      rotation: rotationToward(input.center, best) + 90 + (input.rng() - 0.5) * 16,
      scale: 0.78 + input.rng() * 0.36
    });
  }
  return placements;
}
function applySettlementCondition(features, objects, condition) {
  const tagStyle = (style) => ({
    ...style,
    condition
  });
  let houseIndex = -1;
  let towerIndex = -1;
  const nextObjects = [];
  for (const object of objects) {
    if (object.kind === "building") {
      houseIndex++;
      if (condition === "abandoned" && houseIndex % 2 === 0 && houseIndex % 5 !== 0) continue;
      if (condition === "ruined" && houseIndex % 5 < 3) {
        nextObjects.push({ ...object, style: { ...tagStyle(object.style), gouache: "g_ruin" } });
        continue;
      }
      if (condition === "besieged" && houseIndex % 5 === 0) {
        nextObjects.push({ ...object, style: { ...tagStyle(object.style), gouache: "g_tent" } });
        continue;
      }
    } else if (object.kind === "tower") {
      towerIndex++;
      if (condition === "ruined" && towerIndex % 2 === 0) continue;
    }
    nextObjects.push({ ...object, style: tagStyle(object.style) });
  }
  return {
    features: features.map((feature) => ({ ...feature, style: tagStyle(feature.style) })),
    objects: nextObjects
  };
}

// ../atlas/src/settlement-waterfront.ts
function clamp4(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
function clampInt(value, min, max) {
  return Math.round(clamp4(value, min, max));
}
function resolveWaterfrontOptions(value) {
  if (!value) return void 0;
  const opts = value === true ? {} : value;
  const resolved = {
    pierCount: clampInt(opts.pierCount ?? 2, 1, 4),
    includeDock: opts.includeDock ?? true
  };
  if (Number.isFinite(opts.edgeFraction)) resolved.edgeFraction = opts.edgeFraction;
  return resolved;
}
function samePoint(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;
}
function openRing(ring) {
  if (ring.length > 1 && samePoint(ring[0], ring[ring.length - 1])) {
    return ring.slice(0, -1).map(([x, y]) => [x, y]);
  }
  return ring.map(([x, y]) => [x, y]);
}
function moveToward(from, to, amount) {
  return [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount];
}
function lerpPoint(a, b, amount) {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
}
function offsetPoint(point, direction, distance) {
  return [point[0] + direction[0] * distance, point[1] + direction[1] * distance];
}
function rotationToward2(from, to) {
  return Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
}
function ringEdges(ring) {
  const open = openRing(ring);
  if (open.length < 2) return [];
  const lengths = [];
  let total = 0;
  for (let i = 0; i < open.length; i++) {
    const start = open[i];
    const end = open[(i + 1) % open.length];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return [];
  let walked = 0;
  return open.map((start, i) => {
    const end = open[(i + 1) % open.length];
    const length = lengths[i];
    const fractionStart = walked / total;
    walked += length;
    return {
      start,
      end,
      midpoint: lerpPoint(start, end, 0.5),
      length,
      fractionStart,
      fractionEnd: walked / total
    };
  });
}
function edgeAtFraction(ring, fraction) {
  const edges = ringEdges(ring);
  if (edges.length === 0) return void 0;
  const target = (fraction % 1 + 1) % 1;
  return edges.find((edge) => target >= edge.fractionStart && target <= edge.fractionEnd) ?? edges[0];
}
function longestRingEdge(ring) {
  return ringEdges(ring).reduce(
    (longest, edge) => !longest || edge.length > longest.length ? edge : longest,
    void 0
  );
}
function exteriorNormal(edge, signedArea) {
  if (edge.length <= 0) return [0, -1];
  const dx = edge.end[0] - edge.start[0];
  const dy = edge.end[1] - edge.start[1];
  return signedArea >= 0 ? [dy / edge.length, -dx / edge.length] : [-dy / edge.length, dx / edge.length];
}
function firstInteriorPointToward(from, to, isInteriorPoint) {
  for (const amount of [0.04, 0.08, 0.14, 0.22, 0.35]) {
    const point = moveToward(from, to, amount);
    if (isInteriorPoint(point)) return point;
  }
  return void 0;
}
function appendSettlementWaterfront(input) {
  const edge = input.options.edgeFraction == null ? longestRingEdge(input.outer) : edgeAtFraction(input.outer, input.options.edgeFraction);
  if (!edge || edge.length <= 0) return 0;
  const normal = exteriorNormal(edge, input.signedOuterArea);
  const shoreStart = moveToward(edge.start, edge.end, 0.12);
  const shoreEnd = moveToward(edge.end, edge.start, 0.12);
  const waterStart = offsetPoint(shoreStart, normal, input.span * 0.075);
  const waterEnd = offsetPoint(shoreEnd, normal, input.span * 0.075);
  const landEnd = moveToward(shoreEnd, input.center, 0.1);
  const landStart = moveToward(shoreStart, input.center, 0.1);
  input.features.push({
    id: `${input.idPrefix}-feature-waterfront`,
    kind: "waterfront",
    atlasKind: AtlasFeatureKind.region,
    geometry: {
      type: "Polygon",
      rings: [[waterStart, waterEnd, landEnd, landStart, waterStart]]
    },
    layer: LAYER_Z.rivers,
    visibility: input.visibility,
    style: {
      settlement: "waterfront",
      fillColor: "#94b7c5",
      strokeColor: "#365f6b",
      strokeWidth: 2e-3,
      opacity: 0.58
    },
    labelHint: "Waterfront",
    meta: {
      role: "waterfront",
      edgeFraction: (edge.fractionStart + edge.fractionEnd) / 2
    },
    ...input.nodePart
  });
  for (let i = 0; i < input.options.pierCount; i++) {
    const amount = (i + 1) / (input.options.pierCount + 1);
    const shore = lerpPoint(edge.start, edge.end, amount);
    const land = firstInteriorPointToward(shore, input.center, input.isInteriorPoint) ?? moveToward(shore, input.center, 0.1);
    const water = offsetPoint(shore, normal, input.span * (0.09 + input.rng() * 0.025));
    const path = [land, shore, water];
    input.roadPaths.push(path);
    input.features.push({
      id: `${input.idPrefix}-feature-pier-${i}`,
      kind: "pier",
      atlasKind: AtlasFeatureKind.road,
      geometry: { type: "Path", coordinates: path },
      layer: LAYER_Z.roads + 2,
      visibility: input.visibility,
      style: {
        settlement: "pier",
        strokeColor: "#5f4229",
        strokeWidth: 5e-3,
        opacity: 0.92
      },
      labelHint: `Pier ${i + 1}`,
      meta: { pierIndex: i, role: "waterfront" },
      ...input.nodePart
    });
  }
  if (input.options.includeDock) {
    const avoid = input.dockAvoidPoints ?? [];
    const minAvoid = input.dockAvoidDistance ?? 0;
    const isClear = (point2) => minAvoid <= 0 || avoid.every(([x, y]) => Math.hypot(point2[0] - x, point2[1] - y) >= minAvoid);
    const point = firstInteriorPointToward(
      edge.midpoint,
      input.center,
      (candidate) => input.isInteriorPoint(candidate) && isClear(candidate)
    ) ?? firstInteriorPointToward(edge.midpoint, input.center, input.isInteriorPoint) ?? input.center;
    input.addDockObject(point, rotationToward2(point, offsetPoint(point, normal, 1)), 0.9, {
      role: "waterfront"
    });
  }
  return input.options.pierCount;
}

// ../atlas/src/settlement.ts
var DEFAULT_SEED = 7331;
var DEFAULT_VISIBILITY = "dm_only";
var DEFAULT_PALETTE_ITEMS = {
  building: "village",
  keep: "castle",
  market: "village",
  well: "village",
  gate: "tower",
  tower: "tower",
  dock: "harbor"
};
var DEFAULT_GOUACHE = {
  building: "g_house",
  keep: "g_keep",
  market: "g_stall",
  well: "g_well",
  gate: "g_tower",
  tower: "g_tower",
  dock: "g_ship"
};
function clamp5(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
function clampInt2(value, min, max) {
  return Math.round(clamp5(value, min, max));
}
function seedToNumber(seed) {
  if (seed == null) return DEFAULT_SEED;
  return typeof seed === "number" ? seed | 0 : hashStringToSeed(seed);
}
function samePoint2(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;
}
function openRing2(ring) {
  if (ring.length > 1 && samePoint2(ring[0], ring[ring.length - 1])) {
    return ring.slice(0, -1).map(([x, y]) => [x, y]);
  }
  return ring.map(([x, y]) => [x, y]);
}
function closeRing(ring) {
  const open = openRing2(ring);
  return open.length > 0 ? [...open, open[0]] : [];
}
function ringSignedArea(ring) {
  const open = openRing2(ring);
  if (open.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < open.length; i++) {
    const [x1, y1] = open[i];
    const [x2, y2] = open[(i + 1) % open.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}
function ringArea3(ring) {
  return Math.abs(ringSignedArea(ring));
}
function polygonArea2(polygon) {
  const outer = polygon.rings[0];
  if (!outer) return 0;
  const holes = polygon.rings.slice(1).reduce((sum, ring) => sum + ringArea3(ring), 0);
  return Math.max(0, ringArea3(outer) - holes);
}
function ringBbox3(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}
function ringCentroid(ring) {
  const open = openRing2(ring);
  if (open.length === 0) return [0.5, 0.5];
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < open.length; i++) {
    const [x1, y1] = open[i];
    const [x2, y2] = open[(i + 1) % open.length];
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) {
    const sums = open.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return [sums[0] / open.length, sums[1] / open.length];
  }
  return [cx / (3 * twiceArea), cy / (3 * twiceArea)];
}
function pointInRing4(point, ring) {
  const [px, py] = point;
  const open = openRing2(ring);
  let inside = false;
  for (let i = 0, j = open.length - 1; i < open.length; j = i++) {
    const [xi, yi] = open[i];
    const [xj, yj] = open[j];
    if (yi > py !== yj > py && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
function pointInPolygonWithHoles(point, polygon) {
  const outer = polygon.rings[0];
  if (!outer || !pointInRing4(point, outer)) return false;
  return !polygon.rings.slice(1).some((ring) => pointInRing4(point, ring));
}
function randomPointInPolygon(polygon, bbox, rng) {
  const [minX, minY, maxX, maxY] = bbox;
  if (maxX <= minX || maxY <= minY) return void 0;
  for (let i = 0; i < 500; i++) {
    const point = [minX + rng() * (maxX - minX), minY + rng() * (maxY - minY)];
    if (pointInPolygonWithHoles(point, polygon)) return point;
  }
  return void 0;
}
function interiorPoint(polygon, bbox, rng) {
  const outer = polygon.rings[0];
  if (!outer) return void 0;
  const centroid2 = ringCentroid(outer);
  if (pointInPolygonWithHoles(centroid2, polygon)) return centroid2;
  const random = randomPointInPolygon(polygon, bbox, rng);
  if (random) return random;
  return openRing2(outer).find((point) => pointInPolygonWithHoles(point, polygon));
}
function moveToward2(from, to, amount) {
  return [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount];
}
function pointOnRing(ring, fraction) {
  const closed = closeRing(ring);
  if (closed.length === 0) return [0.5, 0.5];
  if (closed.length === 1) return closed[0];
  let total = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [ax, ay] = closed[i];
    const [bx, by] = closed[i + 1];
    total += Math.hypot(bx - ax, by - ay);
  }
  if (total <= 0) return closed[0];
  let target = (fraction % 1 + 1) % 1;
  target *= total;
  let walked = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [ax, ay] = closed[i];
    const [bx, by] = closed[i + 1];
    const seg = Math.hypot(bx - ax, by - ay);
    if (seg === 0) continue;
    if (walked + seg >= target) {
      const t = (target - walked) / seg;
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    walked += seg;
  }
  return closed[closed.length - 1];
}
function squarePolygon(center, radius) {
  const [cx, cy] = center;
  const ring = [
    [cx - radius, cy - radius],
    [cx + radius, cy - radius],
    [cx + radius, cy + radius],
    [cx - radius, cy + radius],
    [cx - radius, cy - radius]
  ];
  return { type: "Polygon", rings: [ring] };
}
function safeSquarePolygon(center, maxRadius, polygon) {
  let radius = maxRadius;
  for (let i = 0; i < 8; i++) {
    const candidate = squarePolygon(center, radius);
    const corners = candidate.rings[0].slice(0, -1);
    if (corners.every((point) => pointInPolygonWithHoles(point, polygon))) return candidate;
    radius *= 0.65;
  }
  return squarePolygon(center, Math.max(maxRadius * 0.08, 1e-3));
}
function objectStyle(kind) {
  return {
    settlement: kind,
    gouache: DEFAULT_GOUACHE[kind],
    lineWidth: kind === "keep" || kind === "tower" || kind === "gate" ? 1.6 : 1.2,
    blur: kind === "well" ? 0.2 : void 0
  };
}
function createObject(kind, id, point, rotation, scale, opts) {
  return {
    id,
    kind,
    paletteItemId: opts.paletteItemIds?.[kind] ?? DEFAULT_PALETTE_ITEMS[kind],
    x: point[0],
    y: point[1],
    scale,
    rotation,
    layer: LAYER_Z.objects,
    visibility: opts.visibility,
    style: objectStyle(kind),
    ...opts.nodeId ? { nodeId: opts.nodeId } : {},
    ...opts.meta ? { meta: opts.meta } : {}
  };
}
function pointNear(center, distance, angle, polygon, rng, bbox) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const a = angle + attempt * 0.73;
    for (let step = 1; step >= 0.15; step -= 0.17) {
      const point = [
        center[0] + Math.cos(a) * distance * step,
        center[1] + Math.sin(a) * distance * step
      ];
      if (pointInPolygonWithHoles(point, polygon)) return point;
    }
  }
  return randomPointInPolygon(polygon, bbox, rng) ?? center;
}
function generateSettlement(polygon, options = {}) {
  const seed = seedToNumber(options.seed);
  const rng = mulberry32(seed);
  const outer = polygon.rings[0];
  const visibility = options.visibility ?? DEFAULT_VISIBILITY;
  const idPrefix = options.idPrefix ?? `settlement-${seed}`;
  const features = [];
  const objects = [];
  if (!outer || openRing2(outer).length < 3) {
    return {
      seed,
      center: [0.5, 0.5],
      features,
      objects,
      meta: { area: 0, buildingCount: 0, gateCount: 0 }
    };
  }
  const area = polygonArea2(polygon);
  const bbox = ringBbox3(outer);
  const [minX, minY, maxX, maxY] = bbox;
  const span = Math.max(1e-3, Math.min(maxX - minX, maxY - minY));
  const center = interiorPoint(polygon, bbox, rng);
  if (!center || area <= 0) {
    return {
      seed,
      center: [0.5, 0.5],
      features,
      objects,
      meta: { area: 0, buildingCount: 0, gateCount: 0 }
    };
  }
  const includeWalls = options.includeWalls ?? true;
  const includeRoads = options.includeRoads ?? true;
  const includeKeep = options.includeKeep ?? true;
  const includeMarket = options.includeMarket ?? true;
  const includeWell = options.includeWell ?? true;
  const gateCount = clampInt2(options.gateCount ?? 4, 1, 6);
  const towerCount = clampInt2(options.towerCount ?? (includeWalls ? gateCount : 0), 0, 12);
  const density = Math.max(0, options.density ?? 1);
  const inferredBuildingCount = density <= 0 ? 0 : clampInt2(area * 90 * density, 6, 36);
  const buildingCount = clampInt2(options.buildingCount ?? inferredBuildingCount, 0, 60);
  const waterfrontOptions = resolveWaterfrontOptions(options.waterfront);
  const nodePart = options.nodeId ? { nodeId: options.nodeId } : {};
  let generatedPierCount = 0;
  const roadPaths = [];
  const gates = [];
  const gateOffset = rng();
  for (let i = 0; i < gateCount; i++) {
    gates.push(pointOnRing(outer, gateOffset + i / gateCount));
  }
  if (includeWalls) {
    features.push({
      id: `${idPrefix}-feature-wall`,
      kind: "wall",
      atlasKind: AtlasFeatureKind.road,
      geometry: { type: "Path", coordinates: closeRing(outer), closed: true },
      layer: LAYER_Z.roads + 5,
      visibility,
      style: {
        settlement: "wall",
        strokeColor: "#4f4036",
        strokeWidth: 6e-3,
        opacity: 0.95
      },
      labelHint: "Wall",
      ...nodePart
    });
  }
  if (includeRoads) {
    for (let i = 0; i < gates.length; i++) {
      const gate = gates[i];
      const bendBase = moveToward2(gate, center, 0.55);
      const angle = rotationToward(gate, center) + 90;
      const bend = [
        bendBase[0] + Math.cos(angle * Math.PI / 180) * (rng() - 0.5) * span * 0.12,
        bendBase[1] + Math.sin(angle * Math.PI / 180) * (rng() - 0.5) * span * 0.12
      ];
      const path = [moveToward2(gate, center, 0.04), pointInPolygonWithHoles(bend, polygon) ? bend : bendBase, center];
      roadPaths.push(path);
      features.push({
        id: `${idPrefix}-feature-road-${i}`,
        kind: "road",
        atlasKind: AtlasFeatureKind.road,
        geometry: { type: "Path", coordinates: path },
        layer: LAYER_Z.roads,
        visibility,
        style: {
          settlement: "road",
          strokeColor: "#8f6f4a",
          strokeWidth: 4e-3,
          opacity: 0.9
        },
        labelHint: `Road ${i + 1}`,
        meta: { gateIndex: i },
        ...nodePart
      });
    }
  }
  if (includeMarket) {
    const plaza = safeSquarePolygon(center, span * 0.055, polygon);
    features.push({
      id: `${idPrefix}-feature-plaza`,
      kind: "plaza",
      atlasKind: AtlasFeatureKind.region,
      geometry: plaza,
      layer: LAYER_Z.roads - 1,
      visibility,
      style: {
        settlement: "plaza",
        fillColor: "#d8bd8b",
        strokeColor: "#8f6f4a",
        strokeWidth: 2e-3,
        opacity: 0.65
      },
      labelHint: "Market square",
      ...nodePart
    });
  }
  const occupied = [];
  const addObject = (kind, suffix, point, rotation, scale, meta) => {
    occupied.push(point);
    objects.push(
      createObject(kind, `${idPrefix}-object-${suffix}`, point, rotation, scale, {
        nodeId: options.nodeId,
        visibility,
        paletteItemIds: options.paletteItemIds,
        meta
      })
    );
  };
  const gatePoints = gates.map((gate) => moveToward2(gate, center, 0.035));
  const towerPoints = [];
  for (let i = 0; i < towerCount; i++) {
    towerPoints.push(
      moveToward2(pointOnRing(outer, gateOffset + (i + 0.5) / Math.max(1, towerCount)), center, 0.035)
    );
  }
  if (waterfrontOptions) {
    generatedPierCount = appendSettlementWaterfront({
      options: waterfrontOptions,
      outer,
      center,
      span,
      idPrefix,
      visibility,
      nodePart,
      signedOuterArea: ringSignedArea(outer),
      features,
      roadPaths,
      rng,
      isInteriorPoint: (point) => pointInPolygonWithHoles(point, polygon),
      dockAvoidPoints: [...gatePoints, ...towerPoints],
      dockAvoidDistance: span * 0.05,
      addDockObject: (point, rotation, scale, meta) => addObject("dock", "dock", point, rotation, scale, meta)
    });
  }
  const anchorSpacing = span * 0.05;
  const pickAnchorPoint = (distance) => {
    const baseAngle = rng() * Math.PI * 2;
    let candidate = center;
    for (let attempt = 0; attempt < 6; attempt++) {
      candidate = pointNear(center, distance, baseAngle + attempt * 1.7, polygon, rng, bbox);
      if (!tooClose(candidate, occupied, anchorSpacing)) return candidate;
    }
    return candidate;
  };
  if (includeKeep) {
    const point = pickAnchorPoint(span * 0.22);
    addObject("keep", "keep", point, rotationToward(point, center), 1.25, { role: "anchor" });
  }
  if (includeMarket) {
    const point = pickAnchorPoint(span * 0.035);
    addObject("market", "market", point, (rng() - 0.5) * 12, 0.95, { role: "civic" });
  }
  if (includeWell) {
    const point = pickAnchorPoint(span * 0.075);
    addObject("well", "well", point, 0, 0.68, { role: "civic" });
  }
  for (let i = 0; i < gatePoints.length; i++) {
    const point = gatePoints[i];
    if (!pointInPolygonWithHoles(point, polygon)) continue;
    addObject("gate", `gate-${i}`, point, rotationToward(point, center), 0.72, { gateIndex: i });
  }
  for (let i = 0; i < towerPoints.length; i++) {
    const point = towerPoints[i];
    if (!pointInPolygonWithHoles(point, polygon)) continue;
    addObject("tower", `tower-${i}`, point, rotationToward(point, center), 0.78, { towerIndex: i });
  }
  const waterfrontRings = features.filter((feature) => feature.kind === "waterfront" && feature.geometry.type === "Polygon").map((feature) => feature.geometry.rings[0]).filter((ring) => ring.length >= 3);
  const buildingPlacements = placeSettlementBuildings({
    count: buildingCount,
    bbox,
    center,
    span,
    rng,
    isInterior: (point) => pointInPolygonWithHoles(point, polygon),
    occupied,
    roadPaths,
    ...includeWalls ? { wallRing: closeRing(outer) } : {},
    ...waterfrontRings.length > 0 ? { keepOutRings: waterfrontRings } : {}
  });
  buildingPlacements.forEach((placement, index) => {
    addObject("building", `building-${index}`, placement.point, placement.rotation, placement.scale);
  });
  const condition = options.condition;
  const conditioned = condition && condition !== "thriving" ? applySettlementCondition(features, objects, condition) : void 0;
  const finalFeatures = conditioned?.features ?? features;
  const finalObjects = conditioned?.objects ?? objects;
  return {
    seed,
    center,
    features: finalFeatures,
    objects: finalObjects,
    meta: {
      area,
      buildingCount: finalObjects.filter((object) => object.kind === "building").length,
      gateCount,
      ...waterfrontOptions && generatedPierCount > 0 ? { waterfront: true, pierCount: generatedPierCount } : {}
    }
  };
}

// ../atlas/src/export-grid.ts
var EPSILON = 1e-9;
function clamp6(value, lo, hi) {
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
    const x = clamp6(minX + k * cellSize, minX, maxX);
    lines.push({ x1: x, y1: minY, x2: x, y2: maxY });
  }
  const rowCount = Math.floor(rect.height / cellSize + EPSILON);
  for (let k = 0; k <= rowCount; k++) {
    const y = clamp6(minY + k * cellSize, minY, maxY);
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
    xs.push(clamp6(cx + size * Math.cos(angle), minX, maxX));
    ys.push(clamp6(cy + size * Math.sin(angle), minY, maxY));
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
  ATLAS_LABEL_PRESETS,
  ATLAS_PLOT_FILL_PROPOSAL_KIND,
  ATLAS_PLOT_FILL_SCHEMA_VERSION,
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
  CARTOUCHE_STYLES,
  CLIMATE_ZONES,
  CONTOUR_MAJOR_EVERY,
  CULTURE_PROFILES,
  DEFAULT_CONTOUR_STEPS,
  DEFAULT_LIGHT_DIRECTION,
  DEFAULT_PARALLAX_STRENGTH,
  DEFAULT_TERRAIN_BLEND_WIDTH,
  DRAW_LAYERS,
  GLYPH_TO_GOUACHE,
  GOUACHE_ASSETS,
  GOUACHE_ASSET_KEYS,
  GOUACHE_CATEGORY_LABELS,
  LAYER_Z,
  RTX_ATLAS_ASSET_CATALOG_PATH,
  RTX_ATLAS_ASSET_ENGINE_TAGS,
  RTX_ATLAS_ASSET_GOUACHE_CATEGORIES,
  RTX_ATLAS_ASSET_OUTPUT_TYPES,
  RTX_ATLAS_ASSET_REGISTRY_EXPORT,
  RTX_ATLAS_ASSET_STYLEGUIDE_PATH,
  RTX_GOUACHE_RECIPE_LAYER_ROLES,
  RTX_GOUACHE_RECIPE_SHAPES,
  RTX_RECIPE_NORMALIZED_EXTENT,
  RTX_RECIPE_ROLE_DEFAULT_OPACITY,
  SCHEMA_VERSION,
  STYLE_PRESETS,
  TERRAIN_TRAVEL_FACTOR,
  TOLKIEN_INK,
  WATER_BIOME,
  applyColorIntensity,
  assembleStampPrompt,
  buildAtlasPlotFillPromptContext,
  buildContourLines,
  buildGridLines,
  buildHillshadeRGBA,
  buildReliefShading,
  buildRtxAtlasAssetPromptContext,
  buildVineLayout,
  canvasToWorld,
  cellElevation,
  centroid,
  climateBands,
  climateZoneAt,
  createHillshadeCanvas,
  distToSegment,
  drawCartouche,
  drawCompassRose,
  drawGouacheAsset,
  drawRtxGouacheRecipePreview,
  drawScaleBar,
  drawSvgPath,
  drawVine,
  elevationShadowOffset,
  emptyDrawLayerMap,
  fillPlotWithGouacheAssets,
  findBridgePoints,
  formatAtlasPlotFillPromptContext,
  formatRtxAtlasAssetPromptContext,
  generateDraft,
  generatePathAttachments,
  generatePlaceNames,
  generateSettlement,
  getCultureProfile,
  getGlyphByKey,
  getGouacheAsset,
  gouacheKeyForGlyph,
  groupGlyphsByCategory,
  hasElevation,
  hashStringToSeed,
  isAtlasPlotFillProposal,
  isGouacheAsset,
  isRtxAtlasAssetProposal,
  layoutCharactersOnPath,
  lightDirectionSigns,
  listCultureProfiles,
  listGlyphsByCategory,
  listGouacheAssetsByCategory,
  migrateDoc,
  mulberry32,
  normalizeAtlasDraftFeature,
  normalizeAtlasDraftFeatures,
  normalizeContourSteps,
  normalizeElevationCells,
  normalizeLightDirection,
  normalizeParallaxStrength,
  paintTerrainBlobs,
  parallaxCanvasOffset,
  parseExtent,
  parseFeatureGeometry,
  parseGeometry,
  pathLength,
  planTravelRoute,
  pointAtDistance,
  pointInPolygon,
  proceduralDraft,
  randomStampVariation,
  rerollDraft,
  resolveLabelPreset,
  resolveStylePreset,
  riverFlowsUphill,
  roundedRectPath,
  routeRoad,
  sampleElevation,
  sampleElevationAlongPath,
  sampleTaperedWidths,
  scatterGlyphsAlongPath,
  scatterGlyphsInPolygon,
  serializeDoc,
  serializeGeometry,
  smoothPath,
  snapPointToWater,
  stampSeedFromKey,
  suggestTerritories,
  translateGeometry,
  tryParseGeometry,
  validateAtlasPlotFillProposal,
  validateRtxAtlasAssetProposal,
  worldToCanvas
};
