import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLandmassTemplate, LANDMASS_TEMPLATES } from "./landmass-templates";
import { createHeightmap, type HeightmapGrid } from "./planet-field";

const THRESHOLD = 0.03;

/** Component sizes of cells above the threshold (4-neighbour flood fill, planar). */
function landComponents(grid: HeightmapGrid, threshold = THRESHOLD): number[] {
  const { width, height, data } = grid;
  const visited = new Uint8Array(data.length);
  const sizes: number[] = [];
  for (let start = 0; start < data.length; start++) {
    if (visited[start] || data[start] <= threshold) continue;
    let size = 0;
    const stack = [start];
    visited[start] = 1;
    while (stack.length > 0) {
      const index = stack.pop() as number;
      size++;
      const x = index % width;
      const y = (index - x) / width;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const n = ny * width + nx;
        if (visited[n] || data[n] <= threshold) continue;
        visited[n] = 1;
        stack.push(n);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

test("templates are deterministic per (kind, seed)", () => {
  for (const template of LANDMASS_TEMPLATES) {
    const a = createHeightmap(96, 96);
    const b = createHeightmap(96, 96);
    applyLandmassTemplate(a, template.key, 42, false);
    applyLandmassTemplate(b, template.key, 42, false);
    assert.deepEqual(Array.from(a.data), Array.from(b.data), `${template.key} deterministic`);
    const c = createHeightmap(96, 96);
    applyLandmassTemplate(c, template.key, 43, false);
    assert.notDeepEqual(Array.from(a.data), Array.from(c.data), `${template.key} varies with the seed`);
  }
});

test("kontinent has one connected landmass covering >15% of the cells", () => {
  for (const seed of [1, 7, 42]) {
    const grid = createHeightmap(128, 128);
    applyLandmassTemplate(grid, "kontinent", seed, false);
    const components = landComponents(grid);
    assert.ok(components.length > 0, "land exists");
    const largest = components[0];
    assert.ok(
      largest > grid.data.length * 0.15,
      `seed ${seed}: largest component covers >15% (got ${((largest / grid.data.length) * 100).toFixed(1)}%)`,
    );
  }
});

test("archipel has more separate land patches than kontinent", () => {
  for (const seed of [1, 7, 42]) {
    const continent = createHeightmap(128, 128);
    applyLandmassTemplate(continent, "kontinent", seed, false);
    const archipelago = createHeightmap(128, 128);
    applyLandmassTemplate(archipelago, "archipel", seed, false);
    const continentPatches = landComponents(continent).length;
    const archipelagoPatches = landComponents(archipelago).length;
    assert.ok(
      archipelagoPatches > continentPatches,
      `seed ${seed}: archipel (${archipelagoPatches}) > kontinent (${continentPatches})`,
    );
  }
});

test("hochinsel: center is higher than the rim", () => {
  const grid = createHeightmap(128, 128);
  applyLandmassTemplate(grid, "hochinsel", 5, false);
  const at = (u: number, v: number) =>
    grid.data[Math.round(v * (grid.height - 1)) * grid.width + Math.round(u * (grid.width - 1))];
  const center = at(0.5, 0.5);
  const edge = at(0.05, 0.5);
  assert.ok(center > 0.1, `plateau raised (got ${center})`);
  assert.ok(edge < 0, `surroundings lowered (got ${edge})`);
  assert.ok(center > edge, "center above the rim");
});

test("templates also work on the globe grid", () => {
  const grid = createHeightmap(128, 64);
  applyLandmassTemplate(grid, "kontinent", 3, true);
  assert.ok(grid.data.some((value) => value > THRESHOLD), "land raised on the globe");
  assert.ok(grid.data.some((value) => value < 0), "sea floor lowered on the globe");
});
