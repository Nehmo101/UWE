import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  buildStorageKey,
  ensureUploadDirectory,
  resolveAssetFilePath,
} from "@uwe/assets";
import {
  countActiveBySourceType,
  createActiveSoundsState,
  pauseSound,
  playSound,
  resumeSound,
  setSoundVolume,
  stopAllSounds,
  stopSound,
} from "@uwe/soundboard";
import { createAuthService } from "./auth";
import { seedAuthUsers } from "./auth-seed";
import { createPrismaClient } from "./client";
import {
  createSoundboardService,
  extractYouTubeVideoId,
  toPortalSoundboardButtonView,
} from "./soundboard";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("UWE soundboard", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let roomPageId: string;
  let playerUserId: string;
  let localButtonId: string;
  let youtubeButtonId: string;
  let spotifyButtonId: string;
  let dmOnlyButtonId: string;
  let uploadsRoot: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-soundboard-uploads-"));
    process.env.UWE_UPLOADS_ROOT = uploadsRoot;

    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);
    const soundboard = createSoundboardService(databaseUrl);

    const world = await repo.createWorld({
      name: "Soundboard Test World",
      slug: "soundboard-test",
      description: "Soundboard integration tests",
    });
    worldSlug = world.slug;

    const campaign = await repo.createCampaign({
      worldId: world.id,
      name: "Main Campaign",
      slug: "main",
    });

    const users = await seedAuthUsers(auth, repo, world.id);
    playerUserId = users.players[0]!.id;

    const room = await repo.createPage({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Throne Room",
      slug: "throne-room",
      type: "room",
    });
    roomPageId = room.id;

    const storageKey = buildStorageKey(world.id, "ambient.mp3");
    ensureUploadDirectory(world.id, uploadsRoot);
    fs.writeFileSync(resolveAssetFilePath(storageKey, uploadsRoot), "fake-audio");

    const audioAsset = await repo.createAsset({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Ambient Loop",
      type: "audio",
      storageKey,
      mimeType: "audio/mpeg",
      size: 10,
      visibility: "player_visible",
    });

    const localButton = await soundboard.create({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Ambient",
      sourceType: "local",
      assetId: audioAsset.id,
      volume: 0.8,
      loop: true,
      tags: ["ambient", "dungeon"],
      visibility: "player_visible",
      linkedPageIds: [roomPageId],
    });
    localButtonId = localButton.id;

    const youtubeButton = await soundboard.create({
      worldId: world.id,
      campaignId: campaign.id,
      title: "Battle Theme",
      sourceType: "youtube",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      visibility: "player_visible",
    });
    youtubeButtonId = youtubeButton.id;

    const spotifyButton = await soundboard.create({
      worldId: world.id,
      title: "Tavern Playlist",
      sourceType: "spotify",
      sourceUrl: "https://open.spotify.com/track/abc123",
      visibility: "player_visible",
    });
    spotifyButtonId = spotifyButton.id;

    const dmOnlyButton = await soundboard.create({
      worldId: world.id,
      title: "Secret Stinger",
      sourceType: "local",
      sourceUrl: null,
      assetId: audioAsset.id,
      visibility: "dm_only",
    });
    dmOnlyButtonId = dmOnlyButton.id;

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
    fs.rmSync(uploadsRoot, { recursive: true, force: true });
    delete process.env.UWE_UPLOADS_ROOT;
  });

  it("creates a soundboard button", async () => {
    const soundboard = createSoundboardService(databaseUrl);
    const button = await soundboard.getById(localButtonId);

    assert.ok(button);
    assert.equal(button.title, "Ambient");
    assert.equal(button.sourceType, "local");
    assert.equal(button.assetId, button.asset?.id);
    assert.equal(button.loop, true);
    assert.deepEqual(button.tags ? JSON.parse(JSON.stringify(button.tags)) : [], ["ambient", "dungeon"]);
    assert.equal(button.linkedPages.length, 1);
    assert.equal(button.linkedPages[0]?.pageId, roomPageId);
  });

  it("links local sound to asset correctly", async () => {
    const soundboard = createSoundboardService(databaseUrl);
    const button = await soundboard.getById(localButtonId);

    assert.ok(button?.asset);
    assert.equal(button.asset.type, "audio");
    assert.equal(button.asset.title, "Ambient Loop");
  });

  it("stores YouTube and Spotify links", async () => {
    const soundboard = createSoundboardService(databaseUrl);

    const youtube = await soundboard.getById(youtubeButtonId);
    assert.ok(youtube);
    assert.equal(youtube.sourceType, "youtube");
    assert.equal(youtube.sourceUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(extractYouTubeVideoId(youtube.sourceUrl!), "dQw4w9WgXcQ");

    const spotify = await soundboard.getById(spotifyButtonId);
    assert.ok(spotify);
    assert.equal(spotify.sourceType, "spotify");
    assert.equal(spotify.sourceUrl, "https://open.spotify.com/track/abc123");
  });

  it("does not expose dm_only sounds in player portal", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const soundboard = createSoundboardService(databaseUrl);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(playerCtx);

    const portalButtons = await auth.listSoundboardForViewer(worldSlug, playerCtx);
    const portalIds = portalButtons.map((button) => button.id);

    assert.ok(portalIds.includes(localButtonId));
    assert.ok(portalIds.includes(youtubeButtonId));
    assert.ok(portalIds.includes(spotifyButtonId));
    assert.ok(!portalIds.includes(dmOnlyButtonId));

    const dmOnlyDetail = await auth.getSoundboardButtonForViewer(
      worldSlug,
      dmOnlyButtonId,
      playerCtx,
    );
    assert.equal(dmOnlyDetail, null);

    const allButtons = await soundboard.listByWorld(worldSlug);
    assert.ok(allButtons.some((button) => button.id === dmOnlyButtonId));

    const portalRaw = await soundboard.listForPortal(worldSlug);
    const portalViews = portalRaw.map(toPortalSoundboardButtonView);
    assert.ok(!portalViews.some((button) => button.id === dmOnlyButtonId));

    await db.$disconnect();
  });

  it("manages active sounds state with source limits", () => {
    let state = createActiveSoundsState();

    const localOne = playSound(state, {
      id: "local-1",
      title: "Rain",
      sourceType: "local",
      assetId: "asset-1",
      volume: 0.5,
      loop: true,
    });
    state = localOne.state;

    const localTwo = playSound(state, {
      id: "local-2",
      title: "Wind",
      sourceType: "local",
      assetId: "asset-2",
      volume: 0.7,
      loop: false,
    });
    state = localTwo.state;
    assert.equal(state.sounds.length, 2);

    const ytOne = playSound(state, {
      id: "yt-1",
      title: "Theme A",
      sourceType: "youtube",
      sourceUrl: "https://youtube.com/watch?v=a",
      volume: 1,
      loop: false,
    });
    state = ytOne.state;

    const ytTwo = playSound(state, {
      id: "yt-2",
      title: "Theme B",
      sourceType: "youtube",
      sourceUrl: "https://youtube.com/watch?v=b",
      volume: 1,
      loop: false,
    });
    state = ytTwo.state;
    assert.equal(countActiveBySourceType(state, "youtube"), 2);

    const spotifyOne = playSound(state, {
      id: "sp-1",
      title: "Track 1",
      sourceType: "spotify",
      sourceUrl: "https://open.spotify.com/track/1",
      volume: 0.9,
      loop: false,
    });
    state = spotifyOne.state;
    assert.equal(countActiveBySourceType(state, "spotify"), 1);

    const spotifyTwo = playSound(state, {
      id: "sp-2",
      title: "Track 2",
      sourceType: "spotify",
      sourceUrl: "https://open.spotify.com/track/2",
      volume: 0.9,
      loop: false,
    });
    state = spotifyTwo.state;
    assert.equal(countActiveBySourceType(state, "spotify"), 1);
    assert.equal(state.sounds.filter((sound) => sound.sourceType === "spotify").length, 1);

    const firstLocal = state.sounds.find((sound) => sound.buttonId === "local-1");
    assert.ok(firstLocal);
    state = setSoundVolume(state, firstLocal.instanceId, 0.25);
    assert.equal(state.sounds.find((sound) => sound.buttonId === "local-1")?.volume, 0.25);

    state = pauseSound(state, firstLocal.instanceId);
    assert.equal(state.sounds.find((sound) => sound.buttonId === "local-1")?.status, "paused");

    state = resumeSound(state, firstLocal.instanceId);
    assert.equal(state.sounds.find((sound) => sound.buttonId === "local-1")?.status, "playing");

    state = stopSound(state, firstLocal.instanceId);
    assert.equal(state.sounds.find((sound) => sound.buttonId === "local-1"), undefined);

    state = stopAllSounds();
    assert.equal(state.sounds.length, 0);
  });
});
