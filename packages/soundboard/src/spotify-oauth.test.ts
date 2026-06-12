import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSpotifyAuthorizationUrl,
  computeTokenExpiry,
  refreshSpotifyAccessToken,
  shouldRefreshSpotifyToken,
  SPOTIFY_TOKEN_REFRESH_BUFFER_MS,
  type SpotifyFetch,
} from "./spotify-oauth";

describe("Spotify OAuth helpers", () => {
  it("builds the authorization URL with required params", () => {
    const url = buildSpotifyAuthorizationUrl(
      {
        clientId: "client-id",
        clientSecret: "secret",
        redirectUri: "http://localhost:3000/api/spotify/callback",
      },
      "state-token",
    );

    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, "https://accounts.spotify.com/authorize");
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("client_id"), "client-id");
    assert.equal(
      parsed.searchParams.get("redirect_uri"),
      "http://localhost:3000/api/spotify/callback",
    );
    assert.equal(parsed.searchParams.get("state"), "state-token");
    assert.match(parsed.searchParams.get("scope") ?? "", /user-modify-playback-state/);
  });

  it("computes token expiry from expires_in seconds", () => {
    const now = new Date("2026-06-12T12:00:00.000Z");
    const expiresAt = computeTokenExpiry(3600, now);
    assert.equal(expiresAt.toISOString(), "2026-06-12T13:00:00.000Z");
  });

  it("refreshes tokens before expiry using the configured buffer", () => {
    const now = new Date("2026-06-12T12:00:00.000Z");
    const expiresSoon = new Date(now.getTime() + SPOTIFY_TOKEN_REFRESH_BUFFER_MS);
    const expiresLater = new Date(now.getTime() + SPOTIFY_TOKEN_REFRESH_BUFFER_MS + 60_000);

    assert.equal(shouldRefreshSpotifyToken(expiresSoon, now), true);
    assert.equal(shouldRefreshSpotifyToken(expiresLater, now), false);
  });

  it("refreshes access tokens via the Spotify token endpoint", async () => {
    const fetchImpl: SpotifyFetch = async (input, init) => {
      assert.equal(input, "https://accounts.spotify.com/api/token");
      assert.equal(init?.method, "POST");

      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get("grant_type"), "refresh_token");
      assert.equal(body.get("refresh_token"), "refresh-token");

      return new Response(
        JSON.stringify({
          access_token: "new-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "rotated-refresh-token",
          scope: "user-modify-playback-state",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const result = await refreshSpotifyAccessToken(
      { clientId: "client-id", clientSecret: "client-secret" },
      "refresh-token",
      fetchImpl,
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.accessToken, "new-access-token");
      assert.equal(result.refreshToken, "rotated-refresh-token");
      assert.ok(result.expiresAt instanceof Date);
    }
  });

  it("returns Spotify errors from refresh responses", async () => {
    const fetchImpl: SpotifyFetch = async () =>
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Refresh token revoked",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );

    const result = await refreshSpotifyAccessToken(
      { clientId: "client-id", clientSecret: "client-secret" },
      "bad-refresh-token",
      fetchImpl,
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Refresh token revoked/);
      assert.equal(result.status, 400);
    }
  });
});
