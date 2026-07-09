import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { worldWikiPath } from "./world-last-route";

describe("world-revalidate", () => {
  it("targets the wiki listing path", () => {
    assert.equal(worldWikiPath("terra"), "/worlds/terra/wiki");
  });
});
