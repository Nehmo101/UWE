import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertResearchQuerySafe } from "./research-service";

describe("research-service privacy", () => {
  it("blocks dm_only markers in brain modes", () => {
    assert.throws(() => assertResearchQuerySafe("dm_only NPC list", "dnd_brain"));
    assert.doesNotThrow(() => assertResearchQuerySafe("D&D 5e grapple rules", "dnd_brain"));
    assert.doesNotThrow(() => assertResearchQuerySafe("dm_only leak", "open_web"));
  });
});
