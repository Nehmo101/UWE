import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCloudEditModel } from "./index";

describe("resolveCloudEditModel", () => {
  it("keeps edit-capable models", () => {
    assert.equal(resolveCloudEditModel("gpt-image-1", {}), "gpt-image-1");
    assert.equal(resolveCloudEditModel("dall-e-2", {}), "dall-e-2");
  });

  it("falls back to gpt-image-1 for dall-e-3 (no edits support)", () => {
    assert.equal(resolveCloudEditModel("dall-e-3", {}), "gpt-image-1");
    assert.equal(resolveCloudEditModel(undefined, {}), "gpt-image-1");
  });

  it("honours the explicit env override", () => {
    assert.equal(
      resolveCloudEditModel("dall-e-3", { IMAGE_STUDIO_CLOUD_EDIT_MODEL: "custom-edit" }),
      "custom-edit",
    );
  });
});
