import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { ModelScanPath } from "@uwe/connector-model-profile";

import { inferFilesystemModelType, scanFilesystemModels } from "./filesystem-models";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "uwe-fs-models-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeFile(relPath: string, contents = "x"): string {
  const full = join(root, relPath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, contents, "utf8");
  return full;
}

function scanPath(path: string, overrides: Partial<ModelScanPath> = {}): ModelScanPath {
  return { id: `scan-${path}`, path, enabled: true, label: null, ...overrides };
}

describe("inferFilesystemModelType", () => {
  it("detects embedding and vision models, defaulting to chat", () => {
    assert.equal(inferFilesystemModelType("nomic-embed-text.gguf"), "embedding");
    assert.equal(inferFilesystemModelType("llava-v1.6.gguf"), "vision");
    assert.equal(inferFilesystemModelType("llama-3.2-8b-instruct.gguf"), "chat");
  });
});

describe("scanFilesystemModels", () => {
  it("finds .gguf files recursively and reports metadata", () => {
    const modelPath = writeFile("models/llama3.gguf", "abc");
    writeFile("models/nested/qwen-embed.gguf", "de");
    writeFile("models/readme.txt", "not a model");

    const found = scanFilesystemModels([scanPath(join(root, "models"))]);

    assert.equal(found.length, 2);
    const byName = new Map(found.map((m) => [m.name, m]));
    assert.ok(byName.has("llama3"));
    assert.ok(byName.has("qwen-embed"));
    assert.equal(byName.get("llama3")?.provider, "filesystem");
    assert.equal(byName.get("llama3")?.path, modelPath);
    assert.equal(byName.get("llama3")?.sizeBytes, 3);
    assert.equal(byName.get("qwen-embed")?.modelType, "embedding");
  });

  it("skips disabled paths and missing directories", () => {
    writeFile("active/model.gguf");
    const found = scanFilesystemModels([
      scanPath(join(root, "active"), { enabled: false }),
      scanPath(join(root, "does-not-exist")),
    ]);
    assert.deepEqual(found, []);
  });

  it("deduplicates models found via overlapping scan paths", () => {
    writeFile("shared/model.gguf");
    const found = scanFilesystemModels([
      scanPath(join(root, "shared")),
      scanPath(join(root, "shared"), { id: "scan-dupe" }),
    ]);
    assert.equal(found.length, 1);
  });
});
