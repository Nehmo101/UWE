import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { afterEach, describe, it } from "node:test";
import {
  UploadValidationError,
  ZipSecurityError,
  assertSafeZipEntryName,
  buildAssetDownloadHeaders,
  buildSecureStorageKey,
  detectFileKind,
  extractSafeZipEntries,
  resolveAssetFilePath,
  sanitizeOriginalFilename,
  validateUploadInput,
} from "./index";

const MIN_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const MIN_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

describe("upload security policy", () => {
  const worldId = "world-test-id";

  afterEach(() => {
    delete process.env.UWE_UPLOAD_MAX_BYTES;
    delete process.env.UPLOAD_MAX_BYTES;
    delete process.env.UWE_MAX_UPLOAD_BYTES;
  });

  it("blocks .html uploads by extension", () => {
    const html = Buffer.from("<html><body>test</body></html>", "utf8");
    assert.throws(
      () =>
        validateUploadInput({
          buffer: html,
          originalFilename: "evil.html",
          declaredMimeType: "text/html",
          worldId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof UploadValidationError);
        assert.equal(error.code, "blocked_extension");
        return true;
      },
    );
  });

  it("blocks HTML content even with .png extension", () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>", "utf8");
    assert.throws(
      () =>
        validateUploadInput({
          buffer: html,
          originalFilename: "fake.png",
          declaredMimeType: "image/png",
          worldId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof UploadValidationError);
        assert.equal(error.code, "blocked_html");
        return true;
      },
    );
  });

  it("blocks .svg uploads", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "utf8");
    assert.throws(
      () =>
        validateUploadInput({
          buffer: svg,
          originalFilename: "icon.svg",
          declaredMimeType: "image/svg+xml",
          worldId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof UploadValidationError);
        assert.ok(error.code === "blocked_extension" || error.code === "blocked_svg");
        return true;
      },
    );
  });

  it("detects MIME/extension mismatch for PNG bytes declared as JPEG", () => {
    assert.throws(
      () =>
        validateUploadInput({
          buffer: MIN_PNG,
          originalFilename: "photo.jpg",
          declaredMimeType: "image/jpeg",
          worldId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof UploadValidationError);
        assert.equal(error.code, "mime_extension_mismatch");
        return true;
      },
    );
  });

  it("rejects declared MIME that does not match magic bytes", () => {
    assert.throws(
      () =>
        validateUploadInput({
          buffer: MIN_PNG,
          originalFilename: "photo.png",
          declaredMimeType: "application/pdf",
          worldId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof UploadValidationError);
        assert.equal(error.code, "mime_mismatch");
        return true;
      },
    );
  });

  it("accepts valid PNG uploads and generates UUID storage keys", () => {
    const result = validateUploadInput({
      buffer: MIN_PNG,
      originalFilename: "../../etc/passwd.png",
      declaredMimeType: "image/png",
      worldId,
    });

    assert.equal(result.kind, "png");
    assert.equal(result.mimeType, "image/png");
    assert.match(result.storageKey, new RegExp(`^${worldId}/[0-9a-f-]+\\.png$`));
    assert.equal(result.originalFilename, "passwd.png");
    assert.ok(!result.storageKey.includes(".."));
    assert.ok(!result.storageKey.includes("etc"));
  });

  it("blocks path traversal in storage key resolution", () => {
    assert.throws(
      () => resolveAssetFilePath("../../etc/passwd", "/tmp/uploads"),
      /Invalid storage key/,
    );
  });

  it("enforces max upload size from env", () => {
    process.env.UWE_UPLOAD_MAX_BYTES = "32";
    assert.throws(
      () =>
        validateUploadInput({
          buffer: MIN_PNG,
          originalFilename: "big.png",
          declaredMimeType: "image/png",
          worldId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof UploadValidationError);
        assert.equal(error.code, "file_too_large");
        return true;
      },
    );
  });

  it("falls back to legacy UPLOAD_MAX_BYTES when canonical env is unset", () => {
    process.env.UPLOAD_MAX_BYTES = "32";
    assert.throws(
      () =>
        validateUploadInput({
          buffer: MIN_PNG,
          originalFilename: "big.png",
          declaredMimeType: "image/png",
          worldId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof UploadValidationError);
        assert.equal(error.code, "file_too_large");
        return true;
      },
    );
  });

  it("falls back to legacy UWE_MAX_UPLOAD_BYTES when canonical env is unset", () => {
    process.env.UWE_MAX_UPLOAD_BYTES = "32";
    assert.throws(
      () =>
        validateUploadInput({
          buffer: MIN_PNG,
          originalFilename: "big.png",
          declaredMimeType: "image/png",
          worldId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof UploadValidationError);
        assert.equal(error.code, "file_too_large");
        return true;
      },
    );
  });

  it("prefers canonical UWE_UPLOAD_MAX_BYTES over legacy fallbacks", () => {
    process.env.UWE_UPLOAD_MAX_BYTES = String(1024 * 1024);
    process.env.UPLOAD_MAX_BYTES = "32";
    process.env.UWE_MAX_UPLOAD_BYTES = "32";
    const result = validateUploadInput({
      buffer: MIN_PNG,
      originalFilename: "small.png",
      declaredMimeType: "image/png",
      worldId,
    });
    assert.equal(result.kind, "png");
  });

  it("serves SVG assets as attachment (never inline)", () => {
    const headers = buildAssetDownloadHeaders({
      mimeType: "image/svg+xml",
      size: 128,
      title: "icon.svg",
    });
    assert.match(headers["Content-Disposition"] ?? "", /^attachment;/);
  });

  it("never embeds original filename in storage path", () => {
    const key = buildSecureStorageKey(worldId, ".png");
    assert.match(key, new RegExp(`^${worldId}/[0-9a-f-]+\\.png$`));
    assert.ok(!key.includes("secret"));
  });

  it("escapes dangerous original filenames for metadata", () => {
    assert.equal(sanitizeOriginalFilename("../../secret.html"), "secret.html");
    assert.equal(sanitizeOriginalFilename("foo/bar\\baz.png"), "baz.png");
  });

  it("accepts plain text documents", () => {
    const text = Buffer.from("# Hello\nWorld", "utf8");
    const result = validateUploadInput({
      buffer: text,
      originalFilename: "notes.md",
      declaredMimeType: "text/markdown",
      worldId,
    });
    assert.equal(result.kind, "text");
    assert.equal(result.extension, ".md");
  });

  it("detects PNG magic bytes", () => {
    const detection = detectFileKind(MIN_PNG);
    assert.equal(detection.kind, "png");
    assert.equal(detection.mimeType, "image/png");
  });

  it("detects JPEG magic bytes", () => {
    const detection = detectFileKind(MIN_JPEG);
    assert.equal(detection.kind, "jpeg");
  });
});

describe("ZIP import security", () => {
  it("blocks zip slip paths", () => {
    assert.throws(
      () => assertSafeZipEntryName("../../etc/passwd"),
      (error: unknown) => {
        assert.ok(error instanceof ZipSecurityError);
        assert.equal(error.code, "zip_slip");
        return true;
      },
    );
  });

  it("blocks zip slip during extraction", () => {
    const maliciousZip = Buffer.from(
      "UEsDBBQAAAAAAJ270FwaQb8VAwAAAAMAAAAOAAAALi4vLi4vZXZpbC5wbmdQTkdQSwECFAMUAAAAAACdu9BcGkG/FQMAAAADAAAADgAAAAAAAAAAAAAAgAEAAAAALi4vLi4vZXZpbC5wbmdQSwUGAAAAAAEAAQA8AAAALwAAAAAA",
      "base64",
    );

    assert.throws(
      () => extractSafeZipEntries(maliciousZip),
      (error: unknown) => {
        assert.ok(error instanceof ZipSecurityError);
        assert.equal(error.code, "zip_slip");
        return true;
      },
    );
  });

  it("blocks HTML files inside ZIP archives", () => {
    const zip = new AdmZip();
    zip.addFile("assets/world/evil.html", Buffer.from("<html></html>", "utf8"));
    const buffer = zip.toBuffer();

    assert.throws(
      () => extractSafeZipEntries(buffer),
      (error: unknown) => {
        assert.ok(error instanceof ZipSecurityError);
        assert.ok(error.code === "blocked_entry" || error.code === "blocked_content");
        return true;
      },
    );
  });

  it("allows safe asset entries under expected prefix", () => {
    const zip = new AdmZip();
    zip.addFile("assets/world123/file.png", MIN_PNG);
    const buffer = zip.toBuffer();

    const entries = extractSafeZipEntries(buffer, {
      allowedPrefix: "assets/",
      requirePrefix: true,
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.entryName, "assets/world123/file.png");
  });

  it("skips filtered entries instead of blocking the whole archive", () => {
    const zip = new AdmZip();
    zip.addFile("vault/notiz.md", Buffer.from("# Notiz", "utf8"));
    zip.addFile("vault/.obsidian/plugins/main.js", Buffer.from("console.log(1);", "utf8"));
    const buffer = zip.toBuffer();

    assert.throws(() => extractSafeZipEntries(buffer), ZipSecurityError);

    const entries = extractSafeZipEntries(buffer, {
      entryFilter: (entryName) => entryName.endsWith(".md"),
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.entryName, "vault/notiz.md");
  });

  it("still blocks zip slip for entries excluded by the filter", () => {
    const maliciousZip = Buffer.from(
      "UEsDBBQAAAAAAJ270FwaQb8VAwAAAAMAAAAOAAAALi4vLi4vZXZpbC5wbmdQTkdQSwECFAMUAAAAAACdu9BcGkG/FQMAAAADAAAADgAAAAAAAAAAAAAAgAEAAAAALi4vLi4vZXZpbC5wbmdQSwUGAAAAAAEAAQA8AAAALwAAAAAA",
      "base64",
    );

    assert.throws(
      () => extractSafeZipEntries(maliciousZip, { entryFilter: () => false }),
      (error: unknown) => {
        assert.ok(error instanceof ZipSecurityError);
        assert.equal(error.code, "zip_slip");
        return true;
      },
    );
  });
});
