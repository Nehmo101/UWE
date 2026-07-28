import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAMILY_MODEL_NAMES } from "@uwe/product-contracts";
import {
  FAMILY_EXPORT_MODEL_KEYS,
  familyExportCoversContract,
} from "./family-export";

describe("family export covers the contract's family models", () => {
  it("exports exactly the uwe-family.db model set", () => {
    assert.equal(
      familyExportCoversContract(),
      true,
      "FAMILY_EXPORT_MODEL_KEYS must equal FAMILY_MODEL_NAMES — add the new model to the export.",
    );
  });

  it("matches the contract count and has no duplicates", () => {
    assert.equal(FAMILY_EXPORT_MODEL_KEYS.length, FAMILY_MODEL_NAMES.length);
    assert.equal(new Set(FAMILY_EXPORT_MODEL_KEYS).size, FAMILY_EXPORT_MODEL_KEYS.length);
  });
});
