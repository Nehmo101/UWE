import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  SpotifyLocalStoreError,
  buildAuthorizationUrl,
  clearSpotifySession,
  getValidAccessToken,
  listDevices,
  loadSpotifySession,
  saveSpotifySession,
  setDevice,
  spotifySessionPath,
  type SpotifyLocalConfig,
  type SpotifySession,
} from "./spotify-local-store";

const CONFIG: SpotifyLocalConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://127.0.0.1:8742/callback",
};

let dir: string;

function futureSession(overrides: Partial<SpotifySession> = {}): SpotifySession {
  return {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    deviceId: null,
    ...overrides,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "uwe-spotify-store-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("spotify-local-store persistence", () => {
  it("returns null when no session file exists", () => {
    assert.equal(loadSpotifySession(dir), null);
  });

  it("round-trips a saved session", () => {
    const session = futureSession({ deviceId: "device-1" });
    saveSpotifySession(dir, session);

    const loaded = loadSpotifySession(dir);
    assert.deepEqual(loaded, session);
  });

  it("ignores a corrupt session file", () => {
    saveSpotifySession(dir, futureSession());
    // Corrupt the file on disk.
    rmSync(spotifySessionPath(dir));
    assert.equal(loadSpotifySession(dir), null);
  });

  it("clears the session file", () => {
    saveSpotifySession(dir, futureSession());
    assert.ok(existsSync(spotifySessionPath(dir)));
    clearSpotifySession(dir);
    assert.equal(existsSync(spotifySessionPath(dir)), false);
    // Clearing again is safe.
    clearSpotifySession(dir);
  });

  it("does not write tokens in plaintext logs (file only)", () => {
    saveSpotifySession(dir, futureSession());
    const raw = readFileSync(spotifySessionPath(dir), "utf8");
    assert.match(raw, /access-token/);
  });
});

describe("setDevice", () => {
  it("requires an existing session", () => {
    assert.deepEqual(setDevice(dir, "device-1"), {
      ok: false,
      message: "Spotify ist nicht verbunden.",
    });
  });

  it("sets and resets the preferred device", () => {
    saveSpotifySession(dir, futureSession());

    assert.equal(setDevice(dir, "device-1").ok, true);
    assert.equal(loadSpotifySession(dir)?.deviceId, "device-1");

    assert.equal(setDevice(dir, null).ok, true);
    assert.equal(loadSpotifySession(dir)?.deviceId, null);
  });
});

describe("getValidAccessToken", () => {
  it("returns null without a session", async () => {
    assert.equal(await getValidAccessToken(dir, CONFIG), null);
  });

  it("returns the stored token when not near expiry (no refresh/network)", async () => {
    saveSpotifySession(dir, futureSession({ deviceId: "device-1" }));
    const result = await getValidAccessToken(dir, CONFIG);
    assert.deepEqual(result, { accessToken: "access-token", deviceId: "device-1" });
  });
});

describe("listDevices", () => {
  it("reports not connected without a session", async () => {
    const result = await listDevices(dir, CONFIG);
    assert.equal(result.ok, false);
    assert.equal(result.connected, false);
    assert.deepEqual(result.devices, []);
  });
});

describe("credential guards", () => {
  it("throws a friendly error when building an auth URL without credentials", () => {
    assert.throws(
      () => buildAuthorizationUrl({ clientId: "", clientSecret: "", redirectUri: CONFIG.redirectUri }, "state"),
      (error: unknown) => {
        assert.ok(error instanceof SpotifyLocalStoreError);
        assert.match(error.message, /Zugangsdaten/);
        return true;
      },
    );
  });
});
