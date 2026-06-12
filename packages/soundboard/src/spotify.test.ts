import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  clearSpotifyCoverCache,
  fetchSpotifyCoverUrl,
  fetchSpotifyCoverViaOEmbed,
  fetchSpotifyCoverViaWebApi,
  getCachedSpotifyCoverUrl,
  isSpotifyUrl,
  mapButtonVolumeToSpotifyPercent,
  mapSpotifyHttpError,
  normalizeSpotifyUri,
  parseSpotifyUrl,
  pauseSpotifyPlayback,
  pickBestSpotifyImage,
  playSpotifyTrack,
  resumeSpotifyPlayback,
  setSpotifyVolume,
  stopSpotifyPlayback,
  type SpotifyFetch,
} from "./spotify";

describe("Spotify URL parser", () => {
  const validCases = [
    {
      url: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
      type: "track",
      id: "11dFghVXANMlKmJXsNCbNl",
    },
    {
      url: "https://open.spotify.com/intl-de/track/11dFghVXANMlKmJXsNCbNl?si=abc",
      type: "track",
      id: "11dFghVXANMlKmJXsNCbNl",
    },
    {
      url: "https://open.spotify.com/album/2noRn2Aes5aoNVsR6duXjY",
      type: "album",
      id: "2noRn2Aes5aoNVsR6duXjY",
    },
    {
      url: "https://open.spotify.com/intl-fr/playlist/37i9dQZF1DXcBWIGoYBM5M",
      type: "playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
    },
    {
      url: "https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg",
      type: "artist",
      id: "0TnOYISbd1XYRBk9myaseg",
    },
    {
      url: "spotify:track:11dFghVXANMlKmJXsNCbNl",
      type: "track",
      id: "11dFghVXANMlKmJXsNCbNl",
    },
  ] as const;

  for (const testCase of validCases) {
    it(`parses valid Spotify URL: ${testCase.type}`, () => {
      const parsed = parseSpotifyUrl(testCase.url);
      assert.ok(parsed);
      assert.equal(parsed.type, testCase.type);
      assert.equal(parsed.id, testCase.id);
      assert.equal(parsed.uri, `spotify:${testCase.type}:${testCase.id}`);
      assert.equal(isSpotifyUrl(testCase.url), true);
      assert.equal(normalizeSpotifyUri(testCase.url), parsed.uri);
    });
  }

  const invalidCases = [
    "",
    "not-a-url",
    "https://example.com/track/abc123456789",
    "https://open.spotify.com/",
    "https://open.spotify.com/user/demo",
    "https://open.spotify.com/track/",
    "https://open.spotify.com/track/!!!",
    "spotify:user:demo",
    "spotify:episode:abc123456789",
  ];

  for (const url of invalidCases) {
    it(`rejects invalid Spotify URL: ${url || "(empty)"}`, () => {
      assert.equal(parseSpotifyUrl(url), null);
      assert.equal(isSpotifyUrl(url), false);
      assert.equal(normalizeSpotifyUri(url), null);
    });
  }
});

describe("Spotify cover art", () => {
  afterEach(() => {
    clearSpotifyCoverCache();
  });

  it("prefers the largest Spotify image", () => {
    const url = pickBestSpotifyImage([
      { url: "https://example.com/small.jpg", width: 64, height: 64 },
      { url: "https://example.com/large.jpg", width: 640, height: 640 },
    ]);
    assert.equal(url, "https://example.com/large.jpg");
  });

  it("fetches track covers via oEmbed", async () => {
    const trackUrl = "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl";
    const coverUrl = "https://cdn.example.com/spotify-track.jpg";
    const fetchImpl = async (url: string) => ({
      ok: url.includes("/oembed"),
      json: async () => ({ thumbnail_url: coverUrl }),
    });

    const result = await fetchSpotifyCoverViaOEmbed(trackUrl, fetchImpl as typeof fetch);
    assert.equal(result, coverUrl);
  });

  it("fetches album covers via Web API when oEmbed is unavailable", async () => {
    const albumUrl = "https://open.spotify.com/album/2noRn2Aes5aoNVsR6duXjY";
    const coverUrl = "https://cdn.example.com/spotify-album.jpg";
    const parsed = parseSpotifyUrl(albumUrl);
    assert.ok(parsed);

    const fetchImpl = async (url: string) => {
      if (url.includes("/oembed")) {
        return { ok: false, json: async () => null };
      }

      if (url.includes("/albums/")) {
        return {
          ok: true,
          json: async () => ({
            images: [{ url: coverUrl, width: 640, height: 640 }],
          }),
        };
      }

      return { ok: false, json: async () => null };
    };

    const result = await fetchSpotifyCoverViaWebApi(parsed, "token", fetchImpl as typeof fetch);
    assert.equal(result, coverUrl);
  });

  it("uses oEmbed first and caches the resolved cover URL", async () => {
    const trackUrl = "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl";
    const coverUrl = "https://cdn.example.com/spotify-track.jpg";
    let apiCalls = 0;

    const fetchImpl = async (url: string) => {
      apiCalls += 1;
      if (url.includes("/oembed")) {
        return {
          ok: true,
          json: async () => ({ thumbnail_url: coverUrl }),
        };
      }

      return { ok: false, json: async () => null };
    };

    const first = await fetchSpotifyCoverUrl(trackUrl, { fetchImpl: fetchImpl as typeof fetch });
    const second = await fetchSpotifyCoverUrl(trackUrl, { fetchImpl: fetchImpl as typeof fetch });

    assert.equal(first, coverUrl);
    assert.equal(second, coverUrl);
    assert.equal(apiCalls, 1);
    assert.equal(getCachedSpotifyCoverUrl(trackUrl), coverUrl);
  });
});

describe("Spotify volume mapping", () => {
  it("maps 0–1 button volume to 0–100 Spotify percent", () => {
    assert.equal(mapButtonVolumeToSpotifyPercent(0), 0);
    assert.equal(mapButtonVolumeToSpotifyPercent(0.5), 50);
    assert.equal(mapButtonVolumeToSpotifyPercent(1), 100);
    assert.equal(mapButtonVolumeToSpotifyPercent(1.5), 100);
    assert.equal(mapButtonVolumeToSpotifyPercent(-0.2), 0);
  });
});

describe("Spotify HTTP error mapping", () => {
  it("maps 401 to expired token message", () => {
    assert.match(mapSpotifyHttpError(401), /abgelaufen/i);
  });

  it("maps 403 to Premium message", () => {
    assert.match(mapSpotifyHttpError(403, "Premium required"), /Premium/i);
  });

  it("maps 404 to no active device message", () => {
    assert.match(mapSpotifyHttpError(404, "No active device found"), /Gerät/i);
  });
});

function createMockFetch(
  handler: (url: string, init?: RequestInit) => { status: number; body?: string },
): SpotifyFetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const result = handler(url, init);
    return new Response(result.body ?? null, { status: result.status });
  }) as SpotifyFetch;
}

describe("Spotify Web API playback", () => {
  const trackUri = "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl";
  const accessToken = "test-access-token";

  it("playSpotifyTrack calls PUT /v1/me/player/play with track URI and volume", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedBody = "";
    let capturedAuth = "";

    const fetchImpl = createMockFetch((_url, init) => {
      capturedUrl = _url;
      capturedMethod = init?.method ?? "GET";
      capturedBody = String(init?.body ?? "");
      capturedAuth = String(
        (init?.headers as Record<string, string> | undefined)?.Authorization ?? "",
      );
      return { status: 204 };
    });

    const result = await playSpotifyTrack(
      { accessToken, uri: trackUri, volume: 0.75 },
      fetchImpl,
    );

    assert.equal(result.ok, true);
    assert.match(capturedUrl, /\/v1\/me\/player\/play\?volume_percent=75$/);
    assert.equal(capturedMethod, "PUT");
    assert.equal(capturedAuth, "Bearer test-access-token");
    assert.deepEqual(JSON.parse(capturedBody), {
      uris: ["spotify:track:11dFghVXANMlKmJXsNCbNl"],
    });
  });

  it("playSpotifyTrack sends context_uri for playlists", async () => {
    let capturedBody = "";

    const fetchImpl = createMockFetch((_url, init) => {
      capturedBody = String(init?.body ?? "");
      return { status: 204 };
    });

    const result = await playSpotifyTrack(
      {
        accessToken,
        uri: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      },
      fetchImpl,
    );

    assert.equal(result.ok, true);
    assert.deepEqual(JSON.parse(capturedBody), {
      context_uri: "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
    });
  });

  it("returns German error for 401 unauthorized", async () => {
    const fetchImpl = createMockFetch(() => ({ status: 401, body: "token expired" }));

    const result = await playSpotifyTrack({ accessToken, uri: trackUri }, fetchImpl);

    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.match(result.message, /abgelaufen/i);
  });

  it("returns German error for 403 without Premium", async () => {
    const fetchImpl = createMockFetch(() => ({
      status: 403,
      body: "Player command failed: Premium required",
    }));

    const result = await playSpotifyTrack({ accessToken, uri: trackUri }, fetchImpl);

    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.match(result.message, /Premium/i);
  });

  it("returns German error for 404 no active device", async () => {
    const fetchImpl = createMockFetch(() => ({
      status: 404,
      body: "No active device found",
    }));

    const result = await playSpotifyTrack({ accessToken, uri: trackUri }, fetchImpl);

    assert.equal(result.ok, false);
    assert.equal(result.status, 404);
    assert.match(result.message, /Gerät/i);
  });

  it("returns error when access token is missing", async () => {
    const result = await playSpotifyTrack({ uri: trackUri });

    assert.equal(result.ok, false);
    assert.match(result.message, /nicht verbunden/i);
  });

  it("pauseSpotifyPlayback calls PUT /v1/me/player/pause", async () => {
    let capturedUrl = "";

    const fetchImpl = createMockFetch((url) => {
      capturedUrl = url;
      return { status: 204 };
    });

    const result = await pauseSpotifyPlayback({ accessToken }, fetchImpl);

    assert.equal(result.ok, true);
    assert.match(capturedUrl, /\/v1\/me\/player\/pause$/);
  });

  it("resumeSpotifyPlayback calls PUT /v1/me/player/play without body", async () => {
    let capturedUrl = "";
    let capturedBody = initBodyTracker();

    const fetchImpl = createMockFetch((url, init) => {
      capturedUrl = url;
      capturedBody.value = init?.body;
      return { status: 204 };
    });

    const result = await resumeSpotifyPlayback({ accessToken }, fetchImpl);

    assert.equal(result.ok, true);
    assert.match(capturedUrl, /\/v1\/me\/player\/play$/);
    assert.equal(capturedBody.value, undefined);
  });

  it("stopSpotifyPlayback uses pause endpoint", async () => {
    let capturedUrl = "";

    const fetchImpl = createMockFetch((url) => {
      capturedUrl = url;
      return { status: 204 };
    });

    const result = await stopSpotifyPlayback({ accessToken }, fetchImpl);

    assert.equal(result.ok, true);
    assert.match(capturedUrl, /\/v1\/me\/player\/pause$/);
  });

  it("setSpotifyVolume maps volume to volume_percent query param", async () => {
    let capturedUrl = "";

    const fetchImpl = createMockFetch((url) => {
      capturedUrl = url;
      return { status: 204 };
    });

    const result = await setSpotifyVolume({ accessToken, volume: 0.4 }, fetchImpl);

    assert.equal(result.ok, true);
    assert.match(capturedUrl, /\/v1\/me\/player\/volume\?volume_percent=40$/);
  });
});

function initBodyTracker(): { value: unknown } {
  return { value: Symbol("unset") };
}
