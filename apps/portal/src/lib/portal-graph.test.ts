import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { portalGraphApiUrl, remapPortalGraphHrefs } from "./portal-graph";

describe("portal-graph", () => {
  it("remaps graph node hrefs to auth world paths", () => {
    const nodes = remapPortalGraphHrefs("terra", [
      {
        id: "page-1",
        title: "Hafen",
        slug: "hafen",
        type: "location",
        category: "location",
        visibility: "player_visible",
        tags: [],
        href: "/worlds/terra/locations/hafen",
      },
    ]);

    assert.equal(nodes[0]?.href, "/auth/worlds/terra/hafen");
  });

  it("builds graph API URLs with optional focus params", () => {
    assert.equal(
      portalGraphApiUrl("terra"),
      "/api/worlds/terra/graph",
    );
    assert.equal(
      portalGraphApiUrl("terra", { focusPageId: "abc", mode: "neighbors" }),
      "/api/worlds/terra/graph?focusPageId=abc&mode=neighbors",
    );
  });
});
