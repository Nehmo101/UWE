import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  computeTokenExpiry,
  type SpotifyFetch,
} from "@uwe/soundboard";
import { createPrismaClient } from "./client";
import {
  SpotifyConnectionService,
} from "./spotify-connection-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("SpotifyConnectionService", () => {
  const databaseUrl = createTestDatabaseUrl();
  const db = createPrismaClient(databaseUrl);
  const encryptionSecret = "test-spotify-token-secret";

  const oauthConfig = {
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "http://localhost:3000/api/spotify/callback",
  };

  let service: SpotifyConnectionService;
  let worldId = "";
  const worldSlug = "spotify-test-world";

  after(async () => {
    await db.$disconnect();
  });

  it("stores encrypted tokens and refreshes them before expiry", async () => {
    service = new SpotifyConnectionService(db, oauthConfig, encryptionSecret);

    const world = await db.world.create({
      data: {
        name: "Spotify Test World",
        slug: worldSlug,
      },
    });
    worldId = world.id;

    await service.saveConnection({
      worldId,
      spotifyUserId: "spotify-user-1",
      spotifyDisplayName: "Test DJ",
      tokens: {
        accessToken: "initial-access-token",
        refreshToken: "initial-refresh-token",
        expiresAt: computeTokenExpiry(60),
        scope: "user-modify-playback-state",
      },
    });

    const status = await service.getStatusByWorldSlug(worldSlug);
    assert.equal(status.connected, true);
    assert.equal(status.spotifyDisplayName, "Test DJ");

    const fetchImpl: SpotifyFetch = async (_input, init) => {
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get("grant_type"), "refresh_token");
      assert.equal(body.get("refresh_token"), "initial-refresh-token");

      return new Response(
        JSON.stringify({
          access_token: "refreshed-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "user-modify-playback-state",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as typeof fetch;

    try {
      await db.spotifyConnection.update({
        where: { worldId },
        data: { expiresAt: new Date(Date.now() + 60_000) },
      });

      const accessToken = await service.getValidAccessTokenByWorldSlug(worldSlug);
      assert.equal(accessToken, "refreshed-access-token");

      const stored = await db.spotifyConnection.findUnique({ where: { worldId } });
      assert.ok(stored);
      assert.notEqual(stored.accessTokenEncrypted, "refreshed-access-token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("disconnects a world and clears stored tokens", async () => {
    const removed = await service.disconnectByWorldSlug(worldSlug);
    assert.equal(removed, true);

    const status = await service.getStatusByWorldSlug(worldSlug);
    assert.equal(status.connected, false);
  });
});
