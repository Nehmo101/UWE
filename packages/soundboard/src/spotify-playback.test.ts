import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { playSpotifyTrack } from "./spotify";

describe("Spotify playback adapter", () => {
  it("starts playback via the Web API", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];

    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({
        url,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });

      if (url.includes("/me/player/play")) {
        return new Response(null, { status: 204 });
      }

      return new Response(null, { status: 404 });
    };

    const result = await playSpotifyTrack(
      {
        accessToken: "access-token",
        uri: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
        volume: 0.5,
      },
      fetchImpl as typeof fetch,
    );

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.method, "PUT");
    assert.match(calls[0]?.url ?? "", /\/me\/player\/play/);
    assert.match(calls[0]?.url ?? "", /volume_percent=50/);
    assert.match(calls[0]?.body ?? "", /11dFghVXANMlKmJXsNCbNl/);
  });

  it("requires an access token", async () => {
    const result = await playSpotifyTrack({
      uri: "spotify:track:11dFghVXANMlKmJXsNCbNl",
    });

    assert.equal(result.ok, false);
    assert.match(result.message, /nicht verbunden/i);
  });
});
