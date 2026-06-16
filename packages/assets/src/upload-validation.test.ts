import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assetContentDisposition, validateUploadBuffer } from "./upload-validation";

describe("upload validation", () => {
  it("accepts PNG with matching magic bytes", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = validateUploadBuffer(buffer, "image/png", "map.png");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mimeType, "image/png");
    }
  });

  it("rejects HTML uploads", () => {
    const buffer = Buffer.from("<html><script>alert(1)</script></html>", "utf8");
    const result = validateUploadBuffer(buffer, "text/html", "evil.html");
    assert.equal(result.ok, false);
  });

  it("rejects SVG uploads", () => {
    const buffer = Buffer.from('<svg onload="alert(1)"></svg>', "utf8");
    const result = validateUploadBuffer(buffer, "image/svg+xml", "evil.svg");
    assert.equal(result.ok, false);
  });

  it("rejects MIME spoofing", () => {
    const buffer = Buffer.from("<html>x</html>", "utf8");
    const result = validateUploadBuffer(buffer, "image/png", "spoof.png");
    assert.equal(result.ok, false);
  });

  it("enforces size limits", () => {
    const buffer = Buffer.alloc(1024);
    buffer[0] = 0x89;
    buffer[1] = 0x50;
    buffer[2] = 0x4e;
    buffer[3] = 0x47;
    const result = validateUploadBuffer(buffer, "image/png", "big.png", {
      UPLOAD_MAX_BYTES: "512",
    });
    assert.equal(result.ok, false);
  });

  it("serves SVG as attachment when forced through legacy assets", () => {
    const disposition = assetContentDisposition("image/svg+xml", "icon.svg");
    assert.equal(disposition.inline, false);
    assert.match(disposition.header, /^attachment;/);
  });
});
