import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSpotifyAuthorizeUrl,
  getSpotifyAuthConfig,
  sanitizeSpotifyReturnPath,
} from "./spotify-auth";
import { mapButtonVolumeToSpotifyPercent } from "@uwe/soundboard";

describe("spotify-auth helpers", () => {
  it("sanitizeSpotifyReturnPath rejects external URLs", () => {
    assert.equal(sanitizeSpotifyReturnPath("/worlds/demo/soundboard"), "/worlds/demo/soundboard");
    assert.equal(sanitizeSpotifyReturnPath("https://evil.example"), "/");
    assert.equal(sanitizeSpotifyReturnPath("//evil.example"), "/");
    assert.equal(sanitizeSpotifyReturnPath(null), "/");
  });

  it("buildSpotifyAuthorizeUrl includes required OAuth params", () => {
    process.env.SPOTIFY_CLIENT_ID = "client-id";
    process.env.SPOTIFY_CLIENT_SECRET = "client-secret";
    process.env.NEXT_PUBLIC_STUDIO_URL = "http://localhost:3000";

    const config = getSpotifyAuthConfig();
    assert.ok(config);

    const url = new URL(buildSpotifyAuthorizeUrl("state-123"));
    assert.equal(url.hostname, "accounts.spotify.com");
    assert.equal(url.searchParams.get("client_id"), "client-id");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("state"), "state-123");
    assert.match(url.searchParams.get("scope") ?? "", /user-modify-playback-state/);

    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
  });
});

describe("volume mapping re-export sanity", () => {
  it("maps 0.75 to 75", () => {
    assert.equal(mapButtonVolumeToSpotifyPercent(0.75), 75);
  });
});
