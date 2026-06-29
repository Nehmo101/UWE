import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeCanvasDimensions } from "./image-studio-mask";

describe("image-studio-mask", () => {
  it("computeCanvasDimensions scales down large images", () => {
    const dims = computeCanvasDimensions(2048, 1024, 1024);
    assert.equal(dims.width, 1024);
    assert.equal(dims.height, 512);
    assert.ok(dims.scale < 1);
  });

  it("computeCanvasDimensions keeps small images unchanged", () => {
    const dims = computeCanvasDimensions(800, 600, 1024);
    assert.equal(dims.width, 800);
    assert.equal(dims.height, 600);
    assert.equal(dims.scale, 1);
  });
});
