import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSignedMediaToken,
  requiresSignedMediaAccess,
  verifySignedMediaToken,
} from "./signed-media";

describe("signed media access", () => {
  it("requires signatures for protected visibilities", () => {
    assert.equal(requiresSignedMediaAccess("private"), true);
    assert.equal(requiresSignedMediaAccess("dm_only"), true);
    assert.equal(requiresSignedMediaAccess("player_visible"), false);
    assert.equal(requiresSignedMediaAccess("public"), false);
  });

  it("validates signed tokens for protected assets", () => {
    const token = createSignedMediaToken({
      assetId: "asset-1",
      worldSlug: "terra",
      ttlSeconds: 60,
    });

    assert.equal(
      verifySignedMediaToken(token, { assetId: "asset-1", worldSlug: "terra" }),
      true,
    );
    assert.equal(
      verifySignedMediaToken(token, { assetId: "asset-2", worldSlug: "terra" }),
      false,
    );
  });
});
