import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { downscaleImageForVision } from "./image-processing";

describe("downscaleImageForVision", () => {
  it("shrinks an oversized image to the max dimension as JPEG", async () => {
    // 3000x2000 PNG well above the 1600px cap.
    const original = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const result = await downscaleImageForVision({ buffer: original, mimeType: "image/png" });
    assert.equal(result.downscaled, true);
    assert.equal(result.mimeType, "image/jpeg");

    const meta = await sharp(result.buffer).metadata();
    assert.equal(meta.format, "jpeg");
    assert.ok((meta.width ?? 0) <= 1600 && (meta.height ?? 0) <= 1600);
    // Aspect ratio preserved: 3000x2000 → 1600x1067.
    assert.equal(meta.width, 1600);
  });

  it("does not enlarge an image already under the cap", async () => {
    const small = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const result = await downscaleImageForVision({ buffer: small, mimeType: "image/jpeg" });
    const meta = await sharp(result.buffer).metadata();
    assert.equal(meta.width, 800);
    assert.equal(meta.height, 600);
  });

  it("returns the original untouched when the buffer is not a decodable image", async () => {
    const garbage = Buffer.from("not an image", "utf8");
    const result = await downscaleImageForVision({ buffer: garbage, mimeType: "image/png" });
    assert.equal(result.downscaled, false);
    assert.equal(result.mimeType, "image/png");
    assert.equal(result.buffer, garbage);
  });
});
