/**
 * GeoJSON-like geometry primitives for the Atlas World Builder.
 *
 * All coordinates are in normalised canvas space [0.0, 1.0] unless
 * an explicit coordinate system is attached via the `crs` field.
 */

// ---------------------------------------------------------------------------
// Primitive coordinate types
// ---------------------------------------------------------------------------

/** A single 2-D coordinate [x, y]. */
export type Coordinate = [number, number];

/** A 2-D bounding box [minX, minY, maxX, maxY]. */
export type BBox = [number, number, number, number];

// ---------------------------------------------------------------------------
// Geometry shapes
// ---------------------------------------------------------------------------

export interface Point {
  type: "Point";
  coordinates: Coordinate;
  /** Optional altitude / z-value. */
  z?: number;
}

export interface Path {
  type: "Path";
  /** Ordered list of coordinates forming an open polyline. */
  coordinates: Coordinate[];
  /** When true the path should be treated as closed (first == last). */
  closed?: boolean;
}

export interface Polygon {
  type: "Polygon";
  /**
   * Array of rings — first ring is the outer boundary, subsequent rings are
   * holes (same winding convention as GeoJSON).
   */
  rings: Coordinate[][];
}

/**
 * A labelled anchor: associates text with a specific coordinate.
 * Used by the `labels` draw layer.
 */
export interface LabelAnchor {
  type: "LabelAnchor";
  coordinates: Coordinate;
  text: string;
  /** Optional rotation in degrees (clockwise) for straight labels. */
  rotation?: number;
  /** When set, text follows this polyline (curved label). */
  pathCoordinates?: Coordinate[];
  /** When true, characters are laid out from end to start of the path. */
  pathReversed?: boolean;
}

/** Discriminated union of all supported geometry shapes. */
export type AtlasGeometry = Point | Path | Polygon | LabelAnchor;

// ---------------------------------------------------------------------------
// Extent (bounding region for an AtlasNode)
// ---------------------------------------------------------------------------

/**
 * The rendered extent of a map node expressed as a polygon silhouette or
 * simple bounding box.  Stored as JSON in the database `extent` / `silhouette`
 * fields.
 */
export interface AtlasExtent {
  /** Normalised bounding box. */
  bbox: BBox;
  /** Optional silhouette polygon — used for coastline / region clipping. */
  silhouette?: Polygon;
}

// ---------------------------------------------------------------------------
// Feature geometry envelope
// ---------------------------------------------------------------------------

/**
 * Envelope stored in `AtlasFeature.geometry`.
 * Wraps an `AtlasGeometry` with optional metadata.
 */
export interface AtlasFeatureGeometry {
  geometry: AtlasGeometry;
  /** Coordinate reference label, e.g. "canvas-norm" or "world-km". */
  crs?: string;
  /** Bounding box derived from geometry — may be cached for quick queries. */
  bbox?: BBox;
}

// ---------------------------------------------------------------------------
// Coordinate-space transforms
// ---------------------------------------------------------------------------

/**
 * Project a normalised coordinate (0..1) to canvas pixels given the current
 * pan/zoom and the canvas' world size in pixels.
 */
export function worldToCanvas(
  nx: number,
  ny: number,
  panX: number,
  panY: number,
  zoom: number,
  w: number,
  h: number,
): Coordinate {
  return [nx * w * zoom + panX, ny * h * zoom + panY];
}

/**
 * Inverse of {@link worldToCanvas}: map a canvas-pixel coordinate back to
 * normalised space, clamped to [0, 1].
 */
export function canvasToWorld(
  cx: number,
  cy: number,
  panX: number,
  panY: number,
  zoom: number,
  w: number,
  h: number,
): Coordinate {
  return [
    Math.max(0, Math.min(1, (cx - panX) / zoom / w)),
    Math.max(0, Math.min(1, (cy - panY) / zoom / h)),
  ];
}

// ---------------------------------------------------------------------------
// Point / polygon geometry
// ---------------------------------------------------------------------------

/** Ray-casting point-in-polygon test against a single ring. */
export function pointInPolygon(p: Coordinate, ring: Coordinate[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Shortest distance from point `p` to segment `a`–`b`. */
export function distToSegment(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Arithmetic centroid of a ring; falls back to the canvas centre when empty. */
export function centroid(ring: Coordinate[]): Coordinate {
  if (!ring || !ring.length) return [0.5, 0.5];
  let x = 0;
  let y = 0;
  for (const [a, b] of ring) {
    x += a;
    y += b;
  }
  return [x / ring.length, y / ring.length];
}

/** Translate any geometry by (dx, dy) in normalised space, returning a copy. */
export function translateGeometry(geo: AtlasGeometry, dx: number, dy: number): AtlasGeometry {
  const shift = ([a, b]: Coordinate): Coordinate => [a + dx, b + dy];
  if (geo.type === "Point") {
    return { ...geo, coordinates: shift(geo.coordinates) };
  }
  if (geo.type === "LabelAnchor") {
    const moved: LabelAnchor = { ...geo, coordinates: shift(geo.coordinates) };
    if (geo.pathCoordinates) moved.pathCoordinates = geo.pathCoordinates.map(shift);
    return moved;
  }
  if (geo.type === "Path") {
    return { ...geo, coordinates: geo.coordinates.map(shift) };
  }
  // Polygon
  return { ...geo, rings: geo.rings.map((r) => r.map(shift)) };
}
