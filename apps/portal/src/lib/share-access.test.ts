import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isShareLinkPasswordRequired } from "./share-access";

describe("share access hardening", () => {
  it("requires passwords on share links when PLAYER_PREVIEW_REQUIRE_TOKEN is true", () => {
    const previous = process.env.PLAYER_PREVIEW_REQUIRE_TOKEN;
    process.env.PLAYER_PREVIEW_REQUIRE_TOKEN = "true";

    try {
      assert.equal(isShareLinkPasswordRequired({ passwordHash: null }), true);
      assert.equal(
        isShareLinkPasswordRequired({ passwordHash: "hashed" }),
        false,
      );
    } finally {
      if (previous === undefined) {
        delete process.env.PLAYER_PREVIEW_REQUIRE_TOKEN;
      } else {
        process.env.PLAYER_PREVIEW_REQUIRE_TOKEN = previous;
      }
    }
  });
});
