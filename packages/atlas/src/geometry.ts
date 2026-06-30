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
