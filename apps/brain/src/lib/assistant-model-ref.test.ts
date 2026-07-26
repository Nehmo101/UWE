import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAssistantModelRef,
  isSameAssistantModel,
  parseAssistantModelRef,
} from "./assistant-model-ref";

describe("assistant model reference encoding", () => {
  it("round-trips a reference through a single form field", () => {
    const ref = { connectorId: "con-1", modelId: "ollama:qwen2.5:14b", label: "Qwen 2.5 14B" };
    assert.deepEqual(parseAssistantModelRef(formatAssistantModelRef(ref)), ref);
  });

  it("keeps a label that itself contains the separator", () => {
    const ref = { connectorId: "con-1", modelId: "m-1", label: "Qwen :: schnell" };
    assert.deepEqual(parseAssistantModelRef(formatAssistantModelRef(ref)), ref);
  });

  it("treats an empty selection as no reference", () => {
    assert.equal(parseAssistantModelRef(""), null);
    assert.equal(parseAssistantModelRef("   "), null);
    assert.equal(parseAssistantModelRef(null), null);
    assert.equal(parseAssistantModelRef(undefined), null);
  });

  it("rejects a malformed value instead of building a half reference", () => {
    assert.equal(parseAssistantModelRef("nur-connector"), null);
    assert.equal(parseAssistantModelRef("::modell::Label"), null);
    assert.equal(parseAssistantModelRef("con-1::"), null);
  });

  it("falls back to the model id when no label was stored", () => {
    assert.deepEqual(parseAssistantModelRef("con-1::m-1::"), {
      connectorId: "con-1",
      modelId: "m-1",
      label: "m-1",
    });
  });

  it("matches an option against a stored reference by ids only", () => {
    const ref = { connectorId: "con-1", modelId: "m-1", label: "Alter Anzeigename" };

    // The label is a snapshot and may drift; identity is connector + model.
    assert.equal(isSameAssistantModel({ connectorId: "con-1", modelId: "m-1" }, ref), true);
    assert.equal(isSameAssistantModel({ connectorId: "con-2", modelId: "m-1" }, ref), false);
    assert.equal(isSameAssistantModel({ connectorId: "con-1", modelId: "m-2" }, ref), false);
    assert.equal(isSameAssistantModel({ connectorId: "con-1", modelId: "m-1" }, null), false);
  });
});
