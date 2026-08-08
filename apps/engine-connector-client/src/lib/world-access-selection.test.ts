import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextWorldSelection } from "./world-access-selection";

describe("Command Center world access selection", () => {
  it("adds a world without dropping existing assignments", () => {
    assert.deepEqual(nextWorldSelection(["terra"], "aernis", true), ["terra", "aernis"]);
  });

  it("removes only the selected world", () => {
    assert.deepEqual(nextWorldSelection(["terra", "aernis"], "terra", false), ["aernis"]);
  });

  it("does not duplicate an already selected world", () => {
    assert.deepEqual(nextWorldSelection(["terra"], "terra", true), ["terra"]);
  });
});
