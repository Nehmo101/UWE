import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSpotifyUrl,
  normalizeSpotifyUri,
  parseSpotifyUrl,
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
