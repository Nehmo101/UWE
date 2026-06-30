import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { layoutCharactersOnPath, pathLength, pointAtDistance } from "./label-layout";

describe("label-layout", () => {
  it("pathLength sums segment lengths", () => {
    assert.equal(pathLength([[0, 0], [0.1, 0], [0.1, 0.1]]), 0.2);
  });

  it("pointAtDistance returns start and end", () => {
    const path: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    const start = pointAtDistance(path, 0);
    assert.deepEqual(start.point, [0, 0]);
    assert.equal(start.rotation, 0);

    const end = pointAtDistance(path, 1);
    assert.deepEqual(end.point, [1, 0]);
  });

  it("layoutCharactersOnPath is deterministic", () => {
    const path: [number, number][] = [
      [0.2, 0.5],
      [0.5, 0.45],
      [0.8, 0.5],
    ];
    const a = layoutCharactersOnPath("GONDOR", path, 0.01);
    const b = layoutCharactersOnPath("GONDOR", path, 0.01);
    assert.deepEqual(a, b);
    assert.equal(a.length, 6);
    assert.equal(a[0]!.char, "G");
  });

  it("layoutCharactersOnPath supports path reversal", () => {
    const path: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    const forward = layoutCharactersOnPath("AB", path, 0.2);
    const reversed = layoutCharactersOnPath("AB", path, 0.2, true);
    assert.notDeepEqual(forward[0]!.x, reversed[0]!.x);
  });
});
