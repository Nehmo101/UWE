import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAIN_MODEL_NAMES } from "@uwe/product-contracts";
import {
  BRAIN_EXPORT_MODEL_KEYS,
  brainExportCoversContract,
} from "./brain-export";

describe("brain export covers the contract's brain models", () => {
  it("exports exactly the uwe-brain.db model set", () => {
    assert.equal(
      brainExportCoversContract(),
      true,
      "BRAIN_EXPORT_MODEL_KEYS must equal BRAIN_MODEL_NAMES — add the new model to the export.",
    );
  });

  it("matches the contract count and has no duplicates", () => {
    assert.equal(BRAIN_EXPORT_MODEL_KEYS.length, BRAIN_MODEL_NAMES.length);
    assert.equal(new Set(BRAIN_EXPORT_MODEL_KEYS).size, BRAIN_EXPORT_MODEL_KEYS.length);
  });
});
