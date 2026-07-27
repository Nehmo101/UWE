import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateSettlement } from "./settlement";
import type { SettlementLayout, SettlementObjectKind, SettlementOptions } from "./settlement";
import type { Coordinate, Polygon } from "./geometry";
import { distToSegment } from "./geometry";
import { hashStringToSeed } from "./prng";
import { OBJECT_SPACING_FACTOR, WALL_CLEARANCE_FACTOR } from "./settlement-layout";

const SITE: Polygon = {
  type: "Polygon",
  rings: [
    [
      [0.2, 0.2],
      [0.82, 0.18],
      [0.86, 0.7],
      [0.48, 0.82],
      [0.16, 0.62],
      [0.2, 0.2],
    ],
  ],
};

const WITH_HOLE: Polygon = {
  type: "Polygon",
  rings: [
    [
      [0.1, 0.1],
      [0.9, 0.1],
      [0.9, 0.9],
      [0.1, 0.9],
      [0.1, 0.1],
    ],
    [
      [0.43, 0.43],
      [0.57, 0.43],
      [0.57, 0.57],
      [0.43, 0.57],
      [0.43, 0.43],
    ],
  ],
};

function pointInRing(point: Coordinate, ring: Coordinate[]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(point: Coordinate, polygon: Polygon): boolean {
  const outer = polygon.rings[0];
  if (!outer || !pointInRing(point, outer)) return false;
  return !polygon.rings.slice(1).some((ring) => pointInRing(point, ring));
}

describe("generateSettlement", () => {
  it("is deterministic for a fixed polygon and seed", () => {
    const a = generateSettlement(SITE, { seed: 42, idPrefix: "s" });
    const b = generateSettlement(SITE, { seed: 42, idPrefix: "s" });
    const c = generateSettlement(SITE, { seed: 43, idPrefix: "s" });

    assert.deepEqual(a, b);
    assert.notDeepEqual(a.objects, c.objects);
  });

  it("returns walls, roads, plaza, civic anchors, gates, towers, and buildings", () => {
    const layout = generateSettlement(SITE, { seed: 9, idPrefix: "hamlet", buildingCount: 8 });

    assert.equal(layout.seed, 9);
    assert.equal(layout.features.filter((feature) => feature.kind === "wall").length, 1);
    assert.equal(layout.features.filter((feature) => feature.kind === "road").length, 4);
    assert.equal(layout.features.filter((feature) => feature.kind === "plaza").length, 1);
    assert.equal(layout.objects.filter((object) => object.kind === "building").length, 8);

    const objectKinds = new Set(layout.objects.map((object) => object.kind));
    const requiredKinds: SettlementObjectKind[] = ["keep", "market", "well", "gate", "tower", "building"];
    for (const kind of requiredKinds) {
      assert.ok(objectKinds.has(kind), `missing ${kind}`);
    }

    for (const feature of layout.features) {
      assert.ok(feature.id.startsWith("hamlet-feature-"));
    }
    for (const object of layout.objects) {
      assert.ok(object.id.startsWith("hamlet-object-"));
      assert.equal(object.layer, 50);
      assert.equal(object.style.settlement, object.kind);
    }
  });

  it("keeps waterfront generation optional and can add dockyard geometry", () => {
    const inland = generateSettlement(SITE, { seed: 9, idPrefix: "port", buildingCount: 6 });
    const waterfront = generateSettlement(SITE, {
      seed: 9,
      idPrefix: "port",
      buildingCount: 6,
      waterfront: true,
    });

    assert.equal(
      inland.features.some((feature) => feature.kind === "waterfront" || feature.kind === "pier"),
      false,
    );
    assert.equal(inland.objects.some((object) => object.kind === "dock"), false);

    const waterfrontFeature = waterfront.features.find((feature) => feature.kind === "waterfront");
    const pierFeatures = waterfront.features.filter((feature) => feature.kind === "pier");
    const dock = waterfront.objects.find((object) => object.kind === "dock");

    assert.ok(waterfrontFeature);
    assert.equal(waterfrontFeature.atlasKind, "region");
    assert.equal(waterfrontFeature.style.fillColor, "#94b7c5");
    assert.equal(pierFeatures.length, 2);
    assert.ok(pierFeatures.every((feature) => feature.atlasKind === "road"));
    assert.ok(dock);
    assert.equal(dock.paletteItemId, "harbor");
    assert.equal(dock.style.settlement, "dock");
    assert.ok(pointInPolygon([dock.x, dock.y], SITE), "dock marker must stay inside the settlement polygon");
    assert.equal(waterfront.meta.waterfront, true);
    assert.equal(waterfront.meta.pierCount, 2);
  });

  it("honors waterfront pier count and dock suppression options", () => {
    const layout = generateSettlement(SITE, {
      seed: 18,
      idPrefix: "shipyard",
      buildingCount: 4,
      waterfront: { edgeFraction: 0.25, pierCount: 4, includeDock: false },
    });

    assert.equal(layout.features.filter((feature) => feature.kind === "waterfront").length, 1);
    assert.equal(layout.features.filter((feature) => feature.kind === "pier").length, 4);
    assert.equal(layout.objects.filter((object) => object.kind === "dock").length, 0);
    assert.equal(layout.meta.pierCount, 4);
  });

  it("is deterministic for the waterfront parameter combinations exposed in the editor UI", () => {
    const opts = {
      seed: 42,
      idPrefix: "harbor",
      buildingCount: 6,
      waterfront: { edgeFraction: 0.5, pierCount: 3, includeDock: true },
    };
    const a = generateSettlement(SITE, opts);
    const b = generateSettlement(SITE, opts);

    assert.deepEqual(a, b);
    assert.equal(a.features.filter((feature) => feature.kind === "pier").length, 3);
    assert.equal(a.objects.filter((object) => object.kind === "dock").length, 1);
    assert.equal(a.meta.pierCount, 3);
  });

  it("clamps out-of-range waterfront pier counts to 1..4", () => {
    const high = generateSettlement(SITE, { seed: 42, idPrefix: "harbor", waterfront: { pierCount: 99 } });
    const low = generateSettlement(SITE, { seed: 42, idPrefix: "harbor", waterfront: { pierCount: 0 } });

    assert.equal(high.features.filter((feature) => feature.kind === "pier").length, 4);
    assert.equal(high.meta.pierCount, 4);
    assert.equal(low.features.filter((feature) => feature.kind === "pier").length, 1);
    assert.equal(low.meta.pierCount, 1);
  });

  it("threads node, count, gate, and palette options through the output", () => {
    const layout = generateSettlement(SITE, {
      seed: "stone-market",
      idPrefix: "stone",
      nodeId: "node-1",
      buildingCount: 3,
      gateCount: 2,
      towerCount: 1,
      paletteItemIds: {
        building: "pi_house",
        keep: "pi_keep",
      },
    });

    assert.equal(layout.features.filter((feature) => feature.kind === "road").length, 2);
    assert.equal(layout.objects.filter((object) => object.kind === "gate").length, 2);
    assert.equal(layout.objects.filter((object) => object.kind === "tower").length, 1);
    assert.equal(layout.objects.filter((object) => object.kind === "building").length, 3);
    assert.ok(layout.features.every((feature) => feature.nodeId === "node-1"));
    assert.ok(layout.objects.every((object) => object.nodeId === "node-1"));

    for (const building of layout.objects.filter((object) => object.kind === "building")) {
      assert.equal(building.paletteItemId, "pi_house");
    }
    assert.equal(layout.objects.find((object) => object.kind === "keep")?.paletteItemId, "pi_keep");
  });

  it("places generated objects inside the polygon and outside holes", () => {
    const layout = generateSettlement(WITH_HOLE, {
      seed: 128,
      buildingCount: 18,
      gateCount: 4,
    });

    assert.ok(layout.objects.length > 0);
    for (const object of layout.objects) {
      assert.ok(pointInPolygon([object.x, object.y], WITH_HOLE), `${object.id} must be inside buildable area`);
    }
  });

  it("returns an empty layout for invalid polygons", () => {
    const layout = generateSettlement({ type: "Polygon", rings: [[]] }, { seed: 1 });

    assert.equal(layout.seed, 1);
    assert.deepEqual(layout.features, []);
    assert.deepEqual(layout.objects, []);
    assert.equal(layout.meta.area, 0);
  });
});

// ---------------------------------------------------------------------------
// Golden regressions
//
// The digests below freeze the full generator output for fixed
// (polygon, options, seed) combinations: per-kind feature/object counts, the
// meta block, and a checksum over every emitted coordinate (rounded to 1e-6).
// Any unintended behavior change — a shifted building, a different RNG draw
// order, a new clearance — changes the checksum and fails the test. When a
// change is intentional, regenerate the digests and update them deliberately.
// ---------------------------------------------------------------------------

function coordChecksum(values: readonly number[]): string {
  return hashStringToSeed(values.map((value) => value.toFixed(6)).join("|")).toString(16);
}

function settlementDigest(layout: SettlementLayout) {
  const featureCounts: Record<string, number> = {};
  for (const feature of layout.features) {
    featureCounts[feature.kind] = (featureCounts[feature.kind] ?? 0) + 1;
  }
  const objectCounts: Record<string, number> = {};
  for (const object of layout.objects) {
    objectCounts[object.kind] = (objectCounts[object.kind] ?? 0) + 1;
  }
  const values: number[] = [layout.seed, layout.center[0], layout.center[1]];
  for (const feature of layout.features) {
    if (feature.geometry.type === "Path") {
      for (const [x, y] of feature.geometry.coordinates) values.push(x, y);
    } else {
      for (const ring of feature.geometry.rings) for (const [x, y] of ring) values.push(x, y);
    }
  }
  for (const object of layout.objects) {
    values.push(object.x, object.y, object.scale, object.rotation);
  }
  return {
    featureCounts,
    objectCounts,
    meta: { ...layout.meta, area: Number(layout.meta.area.toFixed(6)) },
    coordChecksum: coordChecksum(values),
  };
}

interface GoldenCase {
  name: string;
  polygon: Polygon;
  options: SettlementOptions;
  digest: ReturnType<typeof settlementDigest>;
}

const GOLDEN_CASES: GoldenCase[] = [
  {
    name: "inland walled town (SITE, seed 42)",
    polygon: SITE,
    options: { seed: 42, idPrefix: "golden", buildingCount: 8 },
    digest: {
      featureCounts: { wall: 1, road: 4, plaza: 1 },
      objectCounts: { keep: 1, market: 1, well: 1, gate: 4, tower: 4, building: 8 },
      meta: { area: 0.3674, buildingCount: 8, gateCount: 4 },
      coordChecksum: "83c9bd7",
    },
  },
  {
    name: "town around a hole (WITH_HOLE, seed 128)",
    polygon: WITH_HOLE,
    options: { seed: 128, idPrefix: "golden-hole", buildingCount: 18, gateCount: 4 },
    digest: {
      featureCounts: { wall: 1, road: 4, plaza: 1 },
      objectCounts: { keep: 1, market: 1, well: 1, gate: 4, tower: 4, building: 18 },
      meta: { area: 0.6204, buildingCount: 18, gateCount: 4 },
      coordChecksum: "eb2e2c7a",
    },
  },
  {
    name: "waterfront harbor town (SITE, seed 9)",
    polygon: SITE,
    options: {
      seed: 9,
      idPrefix: "golden-port",
      buildingCount: 6,
      waterfront: { edgeFraction: 0.5, pierCount: 3, includeDock: true },
    },
    digest: {
      featureCounts: { wall: 1, road: 4, plaza: 1, waterfront: 1, pier: 3 },
      objectCounts: { dock: 1, keep: 1, market: 1, well: 1, gate: 4, tower: 4, building: 6 },
      meta: { area: 0.3674, buildingCount: 6, gateCount: 4, waterfront: true, pierCount: 3 },
      coordChecksum: "da78a346",
    },
  },
];

function polygonSpan(polygon: Polygon): number {
  const outer = polygon.rings[0]!;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outer) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return Math.max(0.001, Math.min(maxX - minX, maxY - minY));
}

function distanceToRing(point: Coordinate, ring: readonly Coordinate[]): number {
  let nearest = Infinity;
  for (let i = 0; i < ring.length; i++) {
    nearest = Math.min(nearest, distToSegment(point, ring[i]!, ring[(i + 1) % ring.length]!));
  }
  return nearest;
}

describe("generateSettlement / golden regressions", () => {
  for (const golden of GOLDEN_CASES) {
    it(`pins the ${golden.name} layout`, () => {
      const digest = settlementDigest(generateSettlement(golden.polygon, golden.options));
      assert.deepEqual(digest, golden.digest);
    });
  }

  it("keeps buildings free of overlaps, the wall, and the water strip", () => {
    const epsilon = 1e-9;
    for (const golden of GOLDEN_CASES) {
      const layout = generateSettlement(golden.polygon, golden.options);
      const span = polygonSpan(golden.polygon);
      const spacing = span * OBJECT_SPACING_FACTOR;
      const wallClearance = span * WALL_CLEARANCE_FACTOR;
      const outer = golden.polygon.rings[0]!;
      const buildings = layout.objects.filter((object) => object.kind === "building");
      const others = layout.objects.filter((object) => object.kind !== "building");
      const waterRing = layout.features.find(
        (feature) => feature.kind === "waterfront" && feature.geometry.type === "Polygon",
      );

      for (let i = 0; i < buildings.length; i++) {
        const a = buildings[i]!;
        const point: Coordinate = [a.x, a.y];
        for (let j = i + 1; j < buildings.length; j++) {
          const b = buildings[j]!;
          assert.ok(
            Math.hypot(a.x - b.x, a.y - b.y) >= spacing - epsilon,
            `${golden.name}: buildings ${i}/${j} overlap`,
          );
        }
        for (const other of others) {
          assert.ok(
            Math.hypot(a.x - other.x, a.y - other.y) >= spacing - epsilon,
            `${golden.name}: building ${i} overlaps ${other.kind}`,
          );
        }
        assert.ok(
          distanceToRing(point, outer) >= wallClearance - epsilon,
          `${golden.name}: building ${i} hugs the wall`,
        );
        if (waterRing && waterRing.geometry.type === "Polygon") {
          assert.ok(
            !pointInRing(point, waterRing.geometry.rings[0]! as Coordinate[]),
            `${golden.name}: building ${i} stands in the water strip`,
          );
        }
      }
    }
  });
});
