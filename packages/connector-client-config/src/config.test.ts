import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ConnectorClientConfigError,
  defaultConnectorClientConfig,
  parseConnectorClientConfig,
} from "./config";
import { ConnectorConnectionStatus } from "./types";
import { maskToken } from "./mask-token";
import { validateHostUrl } from "./validate-host-url";

describe("defaultConnectorClientConfig", () => {
  it("returns safe first-run defaults", () => {
    const config = defaultConnectorClientConfig();

    assert.equal(config.hostUrl, "");
    assert.equal(config.token, "");
    assert.equal(config.name, "RTX Host Connector");
    assert.equal(config.transportMode, "queue");
    assert.equal(config.queueEnabled, true);
    assert.equal(config.wizardCompleted, false);
    assert.equal(config.autoConnect, true);
    assert.equal(config.minimizedStart, false);
    assert.equal(config.autostartWindows, false);
    assert.equal(config.trayMode, "minimize_to_tray");
    assert.equal(config.privacyMode, false);
    assert.equal(config.spotifyClientId, "");
    assert.equal(config.spotifyClientSecret, "");
    assert.equal(config.spotifyRedirectUri, "http://127.0.0.1:8742/callback");
    assert.equal(config.audioCommand, "");
    assert.equal(config.imageCommand, "");
    assert.equal(config.localHostRoot, "");
    assert.equal(config.autoStartHost, false);
  });
});

describe("parseConnectorClientConfig", () => {
  it("returns defaults for nullish input", () => {
    assert.deepEqual(parseConnectorClientConfig(null), defaultConnectorClientConfig());
    assert.deepEqual(parseConnectorClientConfig(undefined), defaultConnectorClientConfig());
  });

  it("merges partial persisted JSON and normalizes hostUrl", () => {
    const config = parseConnectorClientConfig({
      hostUrl: "https://uweanddragons.org/",
      token: "  uwec_secret  ",
      name: "RTX Laptop",
      queueEnabled: false,
    });

    assert.equal(config.hostUrl, "https://uweanddragons.org");
    assert.equal(config.token, "uwec_secret");
    assert.equal(config.name, "RTX Laptop");
    assert.equal(config.transportMode, "queue");
    assert.equal(config.queueEnabled, false);
    assert.equal(config.wizardCompleted, false);
    assert.equal(config.autoConnect, true);
    assert.equal(config.localHostRoot, "");
    assert.equal(config.autoStartHost, false);
  });

  it("normalizes all-in-one host settings", () => {
    const config = parseConnectorClientConfig({ localHostRoot: "  C:\\git\\UWE  ", autoStartHost: true });
    assert.equal(config.localHostRoot, "C:\\git\\UWE");
    assert.equal(config.autoStartHost, true);
  });


  it("parses transport modes and derives queueEnabled", () => {
    const direct = parseConnectorClientConfig({ transportMode: "DIRECT", queueEnabled: true });
    assert.equal(direct.transportMode, "direct");
    assert.equal(direct.queueEnabled, false);

    const hybrid = parseConnectorClientConfig({ transportMode: "hybrid", queueEnabled: false });
    assert.equal(hybrid.transportMode, "hybrid");
    assert.equal(hybrid.queueEnabled, true);
  });

  it("preserves legacy disabled queue settings without enabling Direct", () => {
    const config = parseConnectorClientConfig({ queueEnabled: false });
    assert.equal(config.transportMode, "queue");
    assert.equal(config.queueEnabled, false);
  });

  it("requires https for remote hosts in every transport mode", () => {
    for (const transportMode of ["queue", "direct", "hybrid"] as const) {
      assert.throws(
        () =>
          parseConnectorClientConfig({
            hostUrl: "http://192.168.1.20:3000",
            transportMode,
          }),
        (error: unknown) => {
          assert.ok(error instanceof ConnectorClientConfigError);
          assert.match(error.message, /https/);
          return true;
        },
      );
      assert.equal(
        parseConnectorClientConfig({
          hostUrl: "https://uweanddragons.org",
          transportMode,
        }).transportMode,
        transportMode,
      );
    }
  });

  it("allows Direct over explicit loopback http hosts", () => {
    for (const hostUrl of [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://[::1]:3000",
    ]) {
      assert.equal(
        parseConnectorClientConfig({ hostUrl, transportMode: "direct" }).transportMode,
        "direct",
      );
    }
  });

  it("rejects remote plaintext http for queue-only legacy settings", () => {
    assert.throws(() =>
      parseConnectorClientConfig({
        hostUrl: "http://192.168.1.20:3000",
        queueEnabled: false,
      }),
    );
  });


  it("rejects non-object JSON", () => {
    assert.throws(
      () => parseConnectorClientConfig("invalid"),
      (error: unknown) => {
        assert.ok(error instanceof ConnectorClientConfigError);
        assert.match(error.message, /JSON-Objekt/);
        return true;
      },
    );
  });

  it("rejects invalid host URLs", () => {
    assert.throws(
      () =>
        parseConnectorClientConfig({
          hostUrl: "ftp://example.com",
        }),
      (error: unknown) => {
        assert.ok(error instanceof ConnectorClientConfigError);
        assert.match(error.message, /http/);
        return true;
      },
    );
  });

  it("rejects empty name", () => {
    assert.throws(
      () =>
        parseConnectorClientConfig({
          name: "   ",
        }),
      (error: unknown) => {
        assert.ok(error instanceof ConnectorClientConfigError);
        assert.match(error.message, /Name/);
        return true;
      },
    );
  });

  it("falls back to default trayMode for unknown values", () => {
    const config = parseConnectorClientConfig({ trayMode: "unknown-mode" });
    assert.equal(config.trayMode, "minimize_to_tray");
  });

  it("parses privacyMode and defaults it to false", () => {
    assert.equal(parseConnectorClientConfig({}).privacyMode, false);
    assert.equal(parseConnectorClientConfig({ privacyMode: true }).privacyMode, true);
    // Non-boolean input falls back to the default.
    assert.equal(parseConnectorClientConfig({ privacyMode: "yes" }).privacyMode, false);
  });

  it("parses and trims Spotify and executor command fields", () => {
    const config = parseConnectorClientConfig({
      spotifyClientId: "  client-id  ",
      spotifyClientSecret: " secret ",
      spotifyRedirectUri: " http://127.0.0.1:9000/cb ",
      audioCommand: "  mpv --no-video  ",
      imageCommand: " python gen.py ",
    });

    assert.equal(config.spotifyClientId, "client-id");
    assert.equal(config.spotifyClientSecret, "secret");
    assert.equal(config.spotifyRedirectUri, "http://127.0.0.1:9000/cb");
    assert.equal(config.audioCommand, "mpv --no-video");
    assert.equal(config.imageCommand, "python gen.py");
  });

  it("falls back to the default redirect URI for blank values", () => {
    assert.equal(
      parseConnectorClientConfig({ spotifyRedirectUri: "   " }).spotifyRedirectUri,
      "http://127.0.0.1:8742/callback",
    );
    assert.equal(
      parseConnectorClientConfig({ spotifyRedirectUri: 42 }).spotifyRedirectUri,
      "http://127.0.0.1:8742/callback",
    );
  });
});

describe("maskToken", () => {
  it("masks long tokens with a visible prefix", () => {
    const token = "uwec_abcdefghijklmnopqrstuvwxyz";
    const masked = maskToken(token);

    assert.ok(masked.startsWith("uwec_abc"));
    assert.ok(masked.includes("•"));
    assert.doesNotMatch(masked, /uvwxyz$/);
  });

  it("returns empty string for empty input", () => {
    assert.equal(maskToken(""), "");
    assert.equal(maskToken("   "), "");
  });

  it("fully masks short tokens", () => {
    assert.equal(maskToken("uwec_x"), "••••••••");
  });
});

describe("validateHostUrl", () => {
  it("accepts https and loopback http while stripping trailing slashes", () => {
    assert.deepEqual(validateHostUrl("https://host.test/"), {
      ok: true,
      normalized: "https://host.test",
    });
    assert.deepEqual(validateHostUrl("http://127.0.0.2:3000"), {
      ok: true,
      normalized: "http://127.0.0.2:3000",
    });
    assert.deepEqual(validateHostUrl("http://[::1]:3000/"), {
      ok: true,
      normalized: "http://[::1]:3000",
    });
    assert.deepEqual(validateHostUrl("http://localhost:3000/"), {
      ok: true,
      normalized: "http://localhost:3000",
    });
  });

  it("rejects empty, malformed, non-http, and remote plaintext URLs", () => {
    assert.equal(validateHostUrl("").ok, false);
    assert.equal(validateHostUrl("not-a-url").ok, false);
    assert.equal(validateHostUrl("ftp://files.test").ok, false);
    assert.equal(validateHostUrl("http://192.168.1.10:3000").ok, false);
  });
});

describe("ConnectorConnectionStatus", () => {
  it("exposes stable string enum values", () => {
    assert.equal(ConnectorConnectionStatus.NotConfigured, "not_configured");
    assert.equal(ConnectorConnectionStatus.Ready, "ready");
    assert.equal(ConnectorConnectionStatus.Connecting, "connecting");
    assert.equal(ConnectorConnectionStatus.Connected, "connected");
    assert.equal(ConnectorConnectionStatus.Degraded, "degraded");
    assert.equal(ConnectorConnectionStatus.Disconnected, "disconnected");
    assert.equal(ConnectorConnectionStatus.Error, "error");
  });
});
