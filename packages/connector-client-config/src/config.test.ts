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
    assert.equal(config.queueEnabled, true);
    assert.equal(config.wizardCompleted, false);
    assert.equal(config.autoConnect, true);
    assert.equal(config.minimizedStart, false);
    assert.equal(config.autostartWindows, false);
    assert.equal(config.trayMode, "minimize_to_tray");
    assert.equal(config.privacyMode, false);
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
    assert.equal(config.queueEnabled, false);
    assert.equal(config.wizardCompleted, false);
    assert.equal(config.autoConnect, true);
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
  it("accepts http/https and strips trailing slashes", () => {
    assert.deepEqual(validateHostUrl("https://host.test/"), {
      ok: true,
      normalized: "https://host.test",
    });
    assert.deepEqual(validateHostUrl("http://192.168.1.10:3000"), {
      ok: true,
      normalized: "http://192.168.1.10:3000",
    });
  });

  it("rejects empty, malformed, and non-http URLs", () => {
    assert.equal(validateHostUrl("").ok, false);
    assert.equal(validateHostUrl("not-a-url").ok, false);
    assert.equal(validateHostUrl("ftp://files.test").ok, false);
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
