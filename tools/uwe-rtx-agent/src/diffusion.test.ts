import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateDiffusionImage } from "./diffusion";

describe("diffusion", () => {
  it("returns deterministic fallback image when no backend is configured", async () => {
    const first = await generateDiffusionImage({ prompt: "dragon over castle" });
    const second = await generateDiffusionImage({ prompt: "dragon over castle" });
    assert.equal(first.provider, "fallback");
    assert.ok(first.imageBase64.length > 100);
    assert.equal(first.imageBase64, second.imageBase64);
  });
});
