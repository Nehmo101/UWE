import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateSettlementWFC,
  runSettlementWFC,
  wfcTilesCompatible,
  WFC_TILES,
} from "./wfc-settlement";

const base = { center: { x: 0.4, z: -0.3 }, seed: 8231, idPrefix: "w" };

test("adjacency matrix is symmetric", () => {
  for (const a of WFC_TILES) {
    for (const b of WFC_TILES) {
      assert.equal(wfcTilesCompatible(a, b), wfcTilesCompatible(b, a), `${a} vs ${b}`);
    }
  }
});

test("deterministic: same inputs produce the identical settlement", () => {
  const a = generateSettlementWFC(base);
  const b = generateSettlementWFC(base);
  assert.deepEqual(a, b);
  const full = { ...base, walls: true, citadel: true, market: true };
  assert.deepEqual(generateSettlementWFC(full), generateSettlementWFC(full));
});

test("grid has roughly 40-70 cells around the center", () => {
  const { cells } = runSettlementWFC(base);
  assert.ok(cells.length >= 40 && cells.length <= 70, `${cells.length} cells`);
  for (const cell of cells) {
    const distance = Math.hypot(cell.x - base.center.x, cell.z - base.center.z);
    assert.ok(distance <= 0.42 * 1.2 + 1e-9, `cell ${cell.index} inside footprint`);
  }
});

test("collapsed neighbor pairs obey the adjacency matrix", () => {
  const combos = [{}, { walls: true }, { citadel: true, market: true }, { walls: true, citadel: true, market: true }];
  for (const combo of combos) {
    const result = runSettlementWFC({ ...base, ...combo });
    assert.equal(result.fallback, false, `no fallback for ${JSON.stringify(combo)}`);
    for (const cell of result.cells) {
      for (const neighborIndex of cell.neighbors) {
        if (neighborIndex <= cell.index) continue;
        const neighbor = result.cells[neighborIndex];
        assert.ok(
          wfcTilesCompatible(cell.state, neighbor.state),
          `${JSON.stringify(combo)}: ${cell.state}(${cell.index}) next to ${neighbor.state}(${neighbor.index})`,
        );
      }
    }
  }
});

test("walls seed the outer ring with mauer/turm", () => {
  const result = runSettlementWFC({ ...base, walls: true });
  const outerWall = result.cells.filter(
    (cell) => cell.outer && (cell.state === "mauer" || cell.state === "turm"),
  );
  assert.ok(outerWall.length >= 6, `${outerWall.length} wall cells on the outer ring`);
  // mauer never leaves the outer ring (domain restriction)
  for (const cell of result.cells) {
    if (cell.state === "mauer") assert.ok(cell.outer, `mauer cell ${cell.index} only outer`);
  }
  const wallLine = generateSettlementWFC({ ...base, walls: true }).features.find((f) =>
    f.localId.endsWith("-mauer"),
  );
  assert.ok(wallLine, "closed wall line feature exists");
  const points = wallLine!.points;
  const first = points[0];
  const last = points[points.length - 1];
  assert.equal(wallLine!.kind, "road");
  assert.ok(Math.hypot(first.x - last.x, first.z - last.z) < 1e-9, "wall line is closed");
});

test("market seeds at least one markt cell next to platz/gasse", () => {
  for (const combo of [{ market: true }, { market: true, citadel: true }]) {
    const result = runSettlementWFC({ ...base, ...combo });
    const markets = result.cells.filter((cell) => cell.state === "markt");
    assert.ok(markets.length >= 1, `markt cell exists for ${JSON.stringify(combo)}`);
    for (const markt of markets) {
      for (const neighborIndex of markt.neighbors) {
        const state = result.cells[neighborIndex].state;
        assert.ok(state === "platz" || state === "gasse", `markt neighbor is ${state}`);
      }
    }
  }
});

test("citadel puts a dominant tower on the center cell", () => {
  const result = runSettlementWFC({ ...base, citadel: true });
  assert.equal(result.cells[0].state, "turm");
  const big = generateSettlementWFC({ ...base, citadel: true }).objects.find(
    (o) => o.assetKind === "tower" && o.scale === 1.5,
  );
  assert.ok(big, "citadel tower present");
});

test("different seeds produce different layouts", () => {
  const a = runSettlementWFC(base);
  const b = runSettlementWFC({ ...base, seed: 999 });
  assert.notDeepEqual(
    a.cells.map((cell) => cell.state),
    b.cells.map((cell) => cell.state),
  );
});

test("20 seeds collapse without exception and produce valid output", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const result = generateSettlementWFC({
      ...base,
      seed,
      walls: seed % 2 === 0,
      citadel: seed % 3 === 0,
      market: seed % 4 !== 0,
    });
    const ids = new Set(result.objects.map((o) => o.localId));
    assert.equal(ids.size, result.objects.length, `unique object ids for seed ${seed}`);
    for (const feature of result.features) {
      assert.equal(feature.kind, "road");
      assert.ok(feature.points.length >= 2, `feature ${feature.localId} has a path`);
    }
  }
});

test("lanes become road features along neighboring gasse cells", () => {
  const grid = runSettlementWFC({ ...base, market: true });
  const laneCount = grid.cells.filter((cell) => cell.state === "gasse").length;
  assert.ok(laneCount >= 2, "enough lanes in this layout");
  const result = generateSettlementWFC({ ...base, market: true });
  const lanes = result.features.filter((f) => f.localId.includes("-gasse-"));
  assert.ok(lanes.length >= 1, "at least one lane chain");
  for (const lane of lanes) assert.ok(lane.points.length >= 2);
});
