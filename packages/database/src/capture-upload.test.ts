import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  CAPTURE_UPLOAD_NAMESPACE,
  resolveCaptureUploadFilePath,
  saveCaptureUploadFile,
} from "./capture-upload";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("capture upload", () => {
  let tempDir: string;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-capture-upload-"));
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("saves validated image under capture namespace", () => {
    const validated = saveCaptureUploadFile(PNG_1X1, {
      originalFilename: "test.png",
      declaredMimeType: "image/png",
      uploadsRoot: tempDir,
      imagesOnly: true,
    });

    assert.ok(validated.storageKey.startsWith(`${CAPTURE_UPLOAD_NAMESPACE}/`));
    const filePath = resolveCaptureUploadFilePath(validated.storageKey, tempDir);
    assert.ok(fs.existsSync(filePath));
    assert.equal(validated.mimeType, "image/png");
  });

  it("rejects non-image when imagesOnly is set", () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n");
    assert.throws(
      () =>
        saveCaptureUploadFile(pdf, {
          originalFilename: "doc.pdf",
          declaredMimeType: "application/pdf",
          uploadsRoot: tempDir,
          imagesOnly: true,
        }),
      /images only/i,
    );
  });

  it("saves validated audio under capture namespace", () => {
    const wavHeader = Buffer.alloc(44);
    wavHeader.write("RIFF", 0, "ascii");
    wavHeader.writeUInt32LE(36, 4);
    wavHeader.write("WAVE", 8, "ascii");

    const validated = saveCaptureUploadFile(wavHeader, {
      originalFilename: "memo.wav",
      declaredMimeType: "audio/wav",
      uploadsRoot: tempDir,
      audioOnly: true,
    });

    assert.ok(validated.storageKey.startsWith(`${CAPTURE_UPLOAD_NAMESPACE}/`));
    assert.equal(validated.mimeType, "audio/wav");
  });

  it("rejects non-audio when audioOnly is set", () => {
    assert.throws(
      () =>
        saveCaptureUploadFile(PNG_1X1, {
          originalFilename: "photo.png",
          declaredMimeType: "image/png",
          uploadsRoot: tempDir,
          audioOnly: true,
        }),
      /audio only/i,
    );
  });
});
