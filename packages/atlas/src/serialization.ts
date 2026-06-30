/**
 * Parse and validate Atlas geometry JSON.
 *
 * No external schema-validation library is used — validation is done with
 * explicit guards so the package stays dependency-free.
 */

import type {
  AtlasGeometry,
  AtlasExtent,
  AtlasFeatureGeometry,
  BBox,
  Coordinate,
  LabelAnchor,
  Path,
  Point,
  Polygon,
} from "./geometry";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class AtlasParseError extends Error {
  constructor(message: string) {
    super(`[atlas] ${message}`);
    this.name = "AtlasParseError";
  }
}

// ---------------------------------------------------------------------------
// Low-level guards
// ---------------------------------------------------------------------------

function isCoordinate(v: unknown): v is Coordinate {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number"
  );
}

function assertCoordinate(v: unknown, path: string): Coordinate {
  if (!isCoordinate(v)) {
    throw new AtlasParseError(`expected [number, number] at ${path}, got ${JSON.stringify(v)}`);
  }
  return v as Coordinate;
}

function assertCoordinateArray(v: unknown, path: string): Coordinate[] {
  if (!Array.isArray(v) || v.length === 0) {
    throw new AtlasParseError(`expected non-empty coordinate array at ${path}`);
  }
  return v.map((c, i) => assertCoordinate(c, `${path}[${i}]`));
}

function isBBox(v: unknown): v is BBox {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    v.every((n) => typeof n === "number")
  );
}

// ---------------------------------------------------------------------------
// Geometry parsers
// ---------------------------------------------------------------------------

function parsePoint(raw: Record<string, unknown>): Point {
  return {
    type: "Point",
    coordinates: assertCoordinate(raw.coordinates, "coordinates"),
    ...(typeof raw.z === "number" ? { z: raw.z } : {}),
  };
}

function parsePath(raw: Record<string, unknown>): Path {
  return {
    type: "Path",
    coordinates: assertCoordinateArray(raw.coordinates, "coordinates"),
    ...(typeof raw.closed === "boolean" ? { closed: raw.closed } : {}),
  };
}

function parsePolygon(raw: Record<string, unknown>): Polygon {
  if (!Array.isArray(raw.rings) || raw.rings.length === 0) {
    throw new AtlasParseError("Polygon must have at least one ring");
  }
  return {
    type: "Polygon",
    rings: (raw.rings as unknown[]).map((ring, i) =>
      assertCoordinateArray(ring, `rings[${i}]`)
    ),
  };
}

function parseLabelAnchor(raw: Record<string, unknown>): LabelAnchor {
  if (typeof raw.text !== "string") {
    throw new AtlasParseError("LabelAnchor.text must be a string");
  }
  return {
    type: "LabelAnchor",
    coordinates: assertCoordinate(raw.coordinates, "coordinates"),
    text: raw.text,
    ...(typeof raw.rotation === "number" ? { rotation: raw.rotation } : {}),
    ...(Array.isArray(raw.pathCoordinates)
      ? { pathCoordinates: assertCoordinateArray(raw.pathCoordinates, "pathCoordinates") }
      : {}),
    ...(typeof raw.pathReversed === "boolean" ? { pathReversed: raw.pathReversed } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an `AtlasGeometry` from an unknown JSON value.
 * Throws `AtlasParseError` on invalid input.
 */
export function parseGeometry(raw: unknown): AtlasGeometry {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new AtlasParseError(`expected geometry object, got ${typeof raw}`);
  }

  const obj = raw as Record<string, unknown>;

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

/**
 * Serialise an `AtlasGeometry` to a plain JSON-serialisable object.
 * (Round-trip: `parseGeometry(serializeGeometry(g))` must equal `g`.)
 */
export function serializeGeometry(geometry: AtlasGeometry): Record<string, unknown> {
  return geometry as unknown as Record<string, unknown>;
}

/**
 * Parse an `AtlasFeatureGeometry` envelope from JSON.
 */
export function parseFeatureGeometry(raw: unknown): AtlasFeatureGeometry {
  if (typeof raw !== "object" || raw === null) {
    throw new AtlasParseError("expected feature geometry object");
  }
  const obj = raw as Record<string, unknown>;
  const geometry = parseGeometry(obj.geometry);
  return {
    geometry,
    ...(typeof obj.crs === "string" ? { crs: obj.crs } : {}),
    ...(isBBox(obj.bbox) ? { bbox: obj.bbox } : {}),
  };
}

/**
 * Parse an `AtlasExtent` (bounding box + optional silhouette) from JSON.
 */
export function parseExtent(raw: unknown): AtlasExtent {
  if (typeof raw !== "object" || raw === null) {
    throw new AtlasParseError("expected extent object");
  }
  const obj = raw as Record<string, unknown>;

  if (!isBBox(obj.bbox)) {
    throw new AtlasParseError("extent.bbox must be [minX, minY, maxX, maxY]");
  }

  const result: AtlasExtent = { bbox: obj.bbox };

  if (obj.silhouette != null) {
    const sil = parseGeometry(obj.silhouette);
    if (sil.type !== "Polygon") {
      throw new AtlasParseError("extent.silhouette must be a Polygon geometry");
    }
    result.silhouette = sil;
  }

  return result;
}

/**
 * Safe wrapper around `parseGeometry` — returns `null` instead of throwing.
 */
export function tryParseGeometry(raw: unknown): AtlasGeometry | null {
  try {
    return parseGeometry(raw);
  } catch {
    return null;
  }
}
