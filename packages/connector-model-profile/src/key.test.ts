import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { modelProfileKey } from "./key";

describe("modelProfileKey", () => {
  it("combines provider and name, lowercasing the provider", () => {
    assert.equal(modelProfileKey("Ollama", "llama3.2:latest"), "ollama::llama3.2:latest");
  });

  it("ignores an empty/undefined path", () => {
    assert.equal(modelProfileKey("ollama", "qwen2.5"), "ollama::qwen2.5");
    assert.equal(modelProfileKey("ollama", "qwen2.5", ""), "ollama::qwen2.5");
    assert.equal(modelProfileKey("ollama", "qwen2.5", null), "ollama::qwen2.5");
  });

  it("folds the normalized path in for filesystem models", () => {
    const a = modelProfileKey("filesystem", "model.gguf", "C:\\models\\model.gguf");
    const b = modelProfileKey("filesystem", "model.gguf", "C:/models/model.gguf/");
    assert.equal(a, b);
    assert.match(a, /filesystem::model\.gguf::C:\/models\/model\.gguf/);
  });

  it("distinguishes the same name in different directories", () => {
    const a = modelProfileKey("filesystem", "model.gguf", "/a/model.gguf");
    const b = modelProfileKey("filesystem", "model.gguf", "/b/model.gguf");
    assert.notEqual(a, b);
  });
});
