import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proposeTagsForAsset } from "./asset-tag-proposal-service";

describe("proposeTagsForAsset", () => {
  it("extracts tags from title and type", () => {
    const tags = proposeTagsForAsset({
      title: "Forest Battlemap Nordwald",
      description: "Dungeon encounter map",
      type: "map",
      tags: ["existing"],
    });

    assert.ok(tags.includes("map"));
    assert.ok(tags.some((tag) => tag.toLowerCase().includes("forest") || tag.toLowerCase().includes("nordwald")));
    assert.ok(!tags.includes("existing"));
  });
});
