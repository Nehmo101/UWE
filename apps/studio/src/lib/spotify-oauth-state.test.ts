import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeOAuthState,
  encodeOAuthState,
  hashStateCookieValue,
  verifySpotifyOAuthState,
} from "./spotify-oauth-state";

describe("Spotify OAuth callback state", () => {
  it("round-trips encoded OAuth state", () => {
    const encoded = encodeOAuthState({ worldSlug: "terra", nonce: "abc123" });
    const decoded = decodeOAuthState(encoded);
    assert.deepEqual(decoded, { worldSlug: "terra", nonce: "abc123" });
  });

  it("verifies the state cookie hash", () => {
    const state = encodeOAuthState({ worldSlug: "terra", nonce: "nonce-1" });
    const cookie = hashStateCookieValue("nonce-1");

    const verified = verifySpotifyOAuthState(state, cookie);
    assert.equal(verified.ok, true);
    if (verified.ok) {
      assert.equal(verified.state.worldSlug, "terra");
    }
  });

  it("rejects mismatched OAuth state cookies", () => {
    const state = encodeOAuthState({ worldSlug: "terra", nonce: "nonce-1" });
    const verified = verifySpotifyOAuthState(state, hashStateCookieValue("other-nonce"));
    assert.equal(verified.ok, false);
  });
});
