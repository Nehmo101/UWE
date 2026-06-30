import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AtlasGeometry, Point, Path, Polygon, LabelAnchor } from "./geometry";
import {
  AtlasParseError,
  parseGeometry,
  serializeGeometry,
  parseFeatureGeometry,
  parseExtent,
  tryParseGeometry,
} from "./serialization";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundTrip(g: AtlasGeometry): AtlasGeometry {
  return parseGeometry(serializeGeometry(g));
}

// ---------------------------------------------------------------------------
// Point
// ---------------------------------------------------------------------------

describe("geometry / Point", () => {
  it("round-trips a minimal Point", () => {
    const p: Point = { type: "Point", coordinates: [0.5, 0.75] };
    assert.deepEqual(roundTrip(p), p);
  });

  it("round-trips a Point with z", () => {
    const p: Point = { type: "Point", coordinates: [1.0, 0.0], z: 42 };
    assert.deepEqual(roundTrip(p), p);
  });

  it("rejects a Point with non-numeric coordinates", () => {
    assert.throws(
      () => parseGeometry({ type: "Point", coordinates: ["a", 0] }),
      AtlasParseError,
    );
  });

  it("rejects a Point with missing coordinates", () => {
    assert.throws(
      () => parseGeometry({ type: "Point" }),
      AtlasParseError,
    );
  });
});

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

describe("geometry / Path", () => {
  it("round-trips an open Path", () => {
    const path: Path = {
      type: "Path",
      coordinates: [
        [0.0, 0.0],
        [0.5, 0.5],
        [1.0, 0.0],
      ],
    };
    assert.deepEqual(roundTrip(path), path);
  });

  it("round-trips a closed Path", () => {
    const path: Path = {
      type: "Path",
      coordinates: [
        [0.0, 0.0],
        [0.5, 1.0],
        [1.0, 0.0],
      ],
      closed: true,
    };
    assert.deepEqual(roundTrip(path), path);
  });

  it("rejects an empty coordinate array", () => {
    assert.throws(
      () => parseGeometry({ type: "Path", coordinates: [] }),
      AtlasParseError,
    );
  });
});

// ---------------------------------------------------------------------------
// Polygon
// ---------------------------------------------------------------------------

describe("geometry / Polygon", () => {
  it("round-trips a single-ring Polygon", () => {
    const poly: Polygon = {
      type: "Polygon",
      rings: [
        [
          [0.0, 0.0],
          [1.0, 0.0],
          [1.0, 1.0],
          [0.0, 1.0],
          [0.0, 0.0],
        ],
      ],
    };
    assert.deepEqual(roundTrip(poly), poly);
  });

  it("round-trips a Polygon with a hole", () => {
    const poly: Polygon = {
      type: "Polygon",
      rings: [
        [
          [0.0, 0.0],
          [1.0, 0.0],
          [1.0, 1.0],
          [0.0, 0.0],
        ],
        [
          [0.2, 0.2],
          [0.5, 0.2],
          [0.5, 0.5],
          [0.2, 0.2],
        ],
      ],
    };
    assert.deepEqual(roundTrip(poly), poly);
  });

  it("rejects a Polygon with no rings", () => {
    assert.throws(
      () => parseGeometry({ type: "Polygon", rings: [] }),
      AtlasParseError,
    );
  });
});

// ---------------------------------------------------------------------------
// LabelAnchor
// ---------------------------------------------------------------------------

describe("geometry / LabelAnchor", () => {
  it("round-trips a LabelAnchor", () => {
    const label: LabelAnchor = {
      type: "LabelAnchor",
      coordinates: [0.3, 0.7],
      text: "Minas Tirith",
    };
    assert.deepEqual(roundTrip(label), label);
  });

  it("round-trips a LabelAnchor with rotation", () => {
    const label: LabelAnchor = {
      type: "LabelAnchor",
      coordinates: [0.1, 0.9],
      text: "The Shire",
      rotation: 15,
    };
    assert.deepEqual(roundTrip(label), label);
  });

  it("round-trips a curved LabelAnchor preserving pathCoordinates and pathReversed (true)", () => {
    const label: LabelAnchor = {
      type: "LabelAnchor",
      coordinates: [0.4, 0.6],
      text: "Misty Mountains",
      pathCoordinates: [
        [0.1, 0.5],
        [0.4, 0.6],
        [0.7, 0.5],
      ],
      pathReversed: true,
    };
    assert.deepEqual(roundTrip(label), label);
  });

  it("round-trips a curved LabelAnchor preserving pathReversed (false)", () => {
    const label: LabelAnchor = {
      type: "LabelAnchor",
      coordinates: [0.4, 0.6],
      text: "Anduin",
      pathCoordinates: [
        [0.1, 0.5],
        [0.7, 0.5],
      ],
      pathReversed: false,
    };
    assert.deepEqual(roundTrip(label), label);
  });

  it("rejects a LabelAnchor with no text", () => {
    assert.throws(
      () => parseGeometry({ type: "LabelAnchor", coordinates: [0, 0] }),
      AtlasParseError,
    );
  });
});

// ---------------------------------------------------------------------------
// Unknown type
// ---------------------------------------------------------------------------

describe("geometry / unknown type", () => {
  it("throws AtlasParseError for unknown geometry type", () => {
    assert.throws(
      () => parseGeometry({ type: "Circle", coordinates: [0, 0] }),
      AtlasParseError,
    );
  });

  it("throws for non-object input", () => {
    assert.throws(() => parseGeometry(null), AtlasParseError);
    assert.throws(() => parseGeometry(42), AtlasParseError);
    assert.throws(() => parseGeometry([1, 2]), AtlasParseError);
  });
});

// ---------------------------------------------------------------------------
// tryParseGeometry
// ---------------------------------------------------------------------------

describe("tryParseGeometry", () => {
  it("returns null for invalid input without throwing", () => {
    assert.equal(tryParseGeometry(null), null);
    assert.equal(tryParseGeometry({ type: "Unknown" }), null);
  });

  it("returns parsed geometry for valid input", () => {
    const p: Point = { type: "Point", coordinates: [0.1, 0.2] };
    assert.deepEqual(tryParseGeometry(p), p);
  });
});

// ---------------------------------------------------------------------------
// parseFeatureGeometry
// ---------------------------------------------------------------------------

describe("parseFeatureGeometry", () => {
  it("parses a feature geometry envelope", () => {
    const envelope = {
      geometry: { type: "Point", coordinates: [0.5, 0.5] },
      crs: "canvas-norm",
      bbox: [0.4, 0.4, 0.6, 0.6] as [number, number, number, number],
    };
    const result = parseFeatureGeometry(envelope);
    assert.equal(result.geometry.type, "Point");
    assert.equal(result.crs, "canvas-norm");
    assert.deepEqual(result.bbox, [0.4, 0.4, 0.6, 0.6]);
  });

  it("parses without optional crs/bbox", () => {
    const envelope = {
      geometry: { type: "Path", coordinates: [[0, 0], [1, 1]] },
    };
    const result = parseFeatureGeometry(envelope);
    assert.equal(result.geometry.type, "Path");
    assert.equal(result.crs, undefined);
    assert.equal(result.bbox, undefined);
  });
});

// ---------------------------------------------------------------------------
// parseExtent
// ---------------------------------------------------------------------------

describe("parseExtent", () => {
  it("parses a bbox-only extent", () => {
    const result = parseExtent({ bbox: [0, 0, 1, 1] });
    assert.deepEqual(result.bbox, [0, 0, 1, 1]);
    assert.equal(result.silhouette, undefined);
  });

  it("parses an extent with silhouette polygon", () => {
    const result = parseExtent({
      bbox: [0, 0, 1, 1],
      silhouette: {
        type: "Polygon",
        rings: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      },
    });
    assert.equal(result.silhouette?.type, "Polygon");
  });

  it("rejects invalid bbox", () => {
    assert.throws(
      () => parseExtent({ bbox: [0, 0, 1] }),
      AtlasParseError,
    );
  });

  it("rejects non-Polygon silhouette", () => {
    assert.throws(
      () =>
        parseExtent({
          bbox: [0, 0, 1, 1],
          silhouette: { type: "Point", coordinates: [0, 0] },
        }),
      AtlasParseError,
    );
  });
});
