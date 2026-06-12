import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { clearSpotifyCoverCache } from "@uwe/soundboard";
import { createPrismaClient } from "./client";
import { createSoundboardService } from "./soundboard";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("Soundboard Spotify thumbnail enrichment", () => {
  let databaseUrl: string;
  let worldId: string;
  const trackUrl = "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl";
  const autoCoverUrl = "https://cdn.example.com/spotify-auto.jpg";
  const manualCoverUrl = "https://cdn.example.com/spotify-manual.jpg";

  const fetchImpl = async (url: string) => {
    if (url.includes("/oembed")) {
      return {
        ok: true,
        json: async () => ({ thumbnail_url: autoCoverUrl }),
      };
    }

    return { ok: false, json: async () => null };
  };

  before(async () => {
    clearSpotifyCoverCache();
    databaseUrl = createTestDatabaseUrl();
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({
      name: "Spotify Thumb World",
      slug: "spotify-thumb-world",
      description: "Spotify thumbnail tests",
    });
    worldId = world.id;
    await createPrismaClient(databaseUrl).$disconnect();
  });

  after(async () => {
    clearSpotifyCoverCache();
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("auto-fetches Spotify cover on create when thumbnail is empty", async () => {
    clearSpotifyCoverCache();
    const soundboard = createSoundboardService(databaseUrl, {
      spotifyCoverOptions: { fetchImpl: fetchImpl as typeof fetch },
    });

    const button = await soundboard.create({
      worldId,
      title: "Auto Cover",
      sourceType: "spotify",
      sourceUrl: trackUrl,
    });

    assert.equal(button.thumbnail, autoCoverUrl);
  });

  it("does not overwrite a manual Spotify thumbnail on create", async () => {
    clearSpotifyCoverCache();
    const soundboard = createSoundboardService(databaseUrl, {
      spotifyCoverOptions: { fetchImpl: fetchImpl as typeof fetch },
    });

    const button = await soundboard.create({
      worldId,
      title: "Manual Cover",
      sourceType: "spotify",
      sourceUrl: trackUrl,
      thumbnail: manualCoverUrl,
    });

    assert.equal(button.thumbnail, manualCoverUrl);
  });

  it("does not overwrite a manual Spotify thumbnail on update", async () => {
    clearSpotifyCoverCache();
    const soundboard = createSoundboardService(databaseUrl, {
      spotifyCoverOptions: { fetchImpl: fetchImpl as typeof fetch },
    });

    const created = await soundboard.create({
      worldId,
      title: "Update Manual",
      sourceType: "spotify",
      sourceUrl: trackUrl,
      thumbnail: manualCoverUrl,
    });

    const updated = await soundboard.update(created.id, {
      title: "Updated Title",
      thumbnail: manualCoverUrl,
    });

    assert.equal(updated.title, "Updated Title");
    assert.equal(updated.thumbnail, manualCoverUrl);
  });
});
