import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  clearSpotifyCoverCache,
  extractYouTubeVideoId,
  fetchSpotifyCoverUrl,
  getYouTubeThumbnailUrl,
} from "@uwe/soundboard";
import { resolveThumbnail, type SoundboardButtonWithLinks } from "./soundboard";

function buildButton(
  overrides: Partial<SoundboardButtonWithLinks> & Pick<SoundboardButtonWithLinks, "sourceType">,
): SoundboardButtonWithLinks {
  return {
    id: "button-1",
    worldId: "world-1",
    campaignId: null,
    title: "Test",
    sourceUrl: null,
    assetId: null,
    thumbnail: null,
    volume: 1,
    loop: false,
    tags: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    campaign: null,
    asset: null,
    linkedPages: [],
    ...overrides,
  } as SoundboardButtonWithLinks;
}

describe("resolveThumbnail", () => {
  afterEach(() => {
    clearSpotifyCoverCache();
  });

  it("prefers an explicit thumbnail URL", () => {
    const thumbnail = resolveThumbnail(
      buildButton({
        sourceType: "spotify",
        sourceUrl: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
        thumbnail: "https://example.com/cover.jpg",
      }),
    );
    assert.equal(thumbnail, "https://example.com/cover.jpg");
  });

  it("uses manual Spotify thumbnail when no API is available", () => {
    const thumbnail = resolveThumbnail(
      buildButton({
        sourceType: "spotify",
        sourceUrl: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
        thumbnail: "https://cdn.example.com/spotify-cover.png",
      }),
    );
    assert.equal(thumbnail, "https://cdn.example.com/spotify-cover.png");
  });

  it("falls back to asset metadata thumbnailUrl", () => {
    const thumbnail = resolveThumbnail(
      buildButton({
        sourceType: "local",
        asset: {
          id: "asset-1",
          type: "audio",
          metadata: { thumbnailUrl: "https://example.com/asset-thumb.jpg" },
        } as unknown as SoundboardButtonWithLinks["asset"],
      }),
    );
    assert.equal(thumbnail, "https://example.com/asset-thumb.jpg");
  });

  it("derives YouTube thumbnails automatically", () => {
    const sourceUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const thumbnail = resolveThumbnail(
      buildButton({
        sourceType: "youtube",
        sourceUrl,
      }),
    );
    assert.equal(thumbnail, getYouTubeThumbnailUrl(extractYouTubeVideoId(sourceUrl)!));
  });

  it("returns null when no thumbnail source is available", () => {
    const thumbnail = resolveThumbnail(
      buildButton({
        sourceType: "spotify",
        sourceUrl: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
      }),
    );
    assert.equal(thumbnail, null);
  });

  it("uses a cached Spotify cover when the DB field is empty", async () => {
    const sourceUrl = "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl";
    const coverUrl = "https://cdn.example.com/spotify-track.jpg";
    const fetchImpl = async (url: string) => ({
      ok: url.includes("/oembed"),
      json: async () => ({ thumbnail_url: coverUrl }),
    });

    await fetchSpotifyCoverUrl(sourceUrl, { fetchImpl: fetchImpl as typeof fetch });

    const thumbnail = resolveThumbnail(
      buildButton({
        sourceType: "spotify",
        sourceUrl,
      }),
    );
    assert.equal(thumbnail, coverUrl);
  });

  it("returns an auto-fetched Spotify thumbnail stored on the button", () => {
    const coverUrl = "https://cdn.example.com/spotify-auto.jpg";
    const thumbnail = resolveThumbnail(
      buildButton({
        sourceType: "spotify",
        sourceUrl: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
        thumbnail: coverUrl,
      }),
    );
    assert.equal(thumbnail, coverUrl);
  });
});
