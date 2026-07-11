import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildHeightfieldMesh, updateHeightsInPlace } from "./heightfield";

describe("heightfield mesh", () => {
  it("builds deterministic positions, normals, uvs and indices", () => {
    const grid = { cols: 2, rows: 1, elevation: { "1,0": 1 } };
    const first = buildHeightfieldMesh(grid, { worldWidth: 2, worldDepth: 1, heightScale: 0.5 });
    const second = buildHeightfieldMesh(grid, { worldWidth: 2, worldDepth: 1, heightScale: 0.5 });
    assert.deepEqual([...first.positions], [...second.positions]);
    assert.deepEqual([...first.normals], [...second.normals]);
    assert.deepEqual([...first.indices], [0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5]);
    assert.equal(first.positions.length, 18);
    assert.equal(first.uvs.length, 12);
    assert.ok([...first.normals].every(Number.isFinite));
  });

  it("keeps a flat mesh at y=0 and updates elevations in place", () => {
    const data = buildHeightfieldMesh({ cols: 2, rows: 2 });
    assert.deepEqual([...data.positions].filter((_, index) => index % 3 === 1), new Array(9).fill(0));
    const positions = data.positions;
    updateHeightsInPlace(data, { cols: 2, rows: 2, elevation: { "0,0": 1 } });
    assert.equal(data.positions, positions);
    assert.ok([...data.positions].some((value, index) => index % 3 === 1 && value > 0));
  });
});
