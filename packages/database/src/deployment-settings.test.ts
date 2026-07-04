import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { setRuntimeEnvOverrides } from "@uwe/auth";
import {
  DEFAULT_DEPLOYMENT_SETTINGS,
  applyDeploymentRuntimeOverrides,
  buildDeploymentEnvOverrides,
  buildDeploymentSettingsUpdate,
  normalizeDeploymentSettings,
  sanitizeDeploymentSettingsForClient,
} from "./deployment-settings";
import { getTurnstileConfig } from "@uwe/auth";

describe("deployment settings", () => {
  afterEach(() => setRuntimeEnvOverrides(null));

  it("defaults produce no env overrides (pure env fallback)", () => {
    assert.deepEqual(buildDeploymentEnvOverrides(DEFAULT_DEPLOYMENT_SETTINGS), {});
  });

  it("maps strings and tri-state flags to env keys", () => {
    const overrides = buildDeploymentEnvOverrides(
      normalizeDeploymentSettings({
        publicAppUrl: "https://uweanddragons.org",
        studioUrl: "https://studio.uweanddragons.org",
        portalUrl: "https://portal.uweanddragons.org",
        studioPath: "/",
        portalPath: "/",
        trustProxy: "on",
        cloudflareTunnel: "on",
        authRequired: "off",
        sessionCookieSecure: "on",
        playerPreviewPublic: "off",
        turnstileEnabled: "on",
        turnstileSiteKey: "site-key",
      }),
    );

    assert.equal(overrides.PUBLIC_BASE_URL, "https://uweanddragons.org");
    assert.equal(overrides.NEXT_PUBLIC_STUDIO_URL, "https://studio.uweanddragons.org");
    assert.equal(overrides.NEXT_PUBLIC_PORTAL_URL, "https://portal.uweanddragons.org");
    assert.equal(overrides.STUDIO_PATH, "/");
    assert.equal(overrides.PORTAL_PATH, "/");
    assert.equal(overrides.TRUST_PROXY, "true");
    assert.equal(overrides.CLOUDFLARE_TUNNEL, "true");
    assert.equal(overrides.AUTH_REQUIRED, "false");
    assert.equal(overrides.SESSION_COOKIE_SECURE, "true");
    assert.equal(overrides.PLAYER_PREVIEW_PUBLIC, "false");
    assert.equal(overrides.TURNSTILE_ENABLED, "true");
    assert.equal(overrides.TURNSTILE_SITE_KEY, "site-key");
  });

  it("normalizes unknown values to safe defaults", () => {
    const normalized = normalizeDeploymentSettings({
      trustProxy: "maybe",
      publicAppUrl: 42,
      turnstileSecretEnc: "",
    });
    assert.equal(normalized.trustProxy, "env");
    assert.equal(normalized.publicAppUrl, "");
    assert.equal(normalized.turnstileSecretConfigured, false);
    assert.equal(normalized.turnstileSecretEnc, null);
  });

  it("encrypts a new Turnstile secret and round-trips it back to the env key", () => {
    const built = buildDeploymentSettingsUpdate({ turnstileSecret: "super-secret" });
    assert.equal(built.turnstileSecretConfigured, true);
    assert.ok(built.turnstileSecretEnc);
    assert.notEqual(built.turnstileSecretEnc, "super-secret");

    const overrides = buildDeploymentEnvOverrides(built);
    assert.equal(overrides.TURNSTILE_SECRET_KEY, "super-secret");
  });

  it("preserves the stored secret when the field is left blank, clears on request", () => {
    const first = buildDeploymentSettingsUpdate({ turnstileSecret: "keep-me" });
    const unchanged = buildDeploymentSettingsUpdate({ turnstileSecret: "" }, first);
    assert.equal(unchanged.turnstileSecretEnc, first.turnstileSecretEnc);

    const cleared = buildDeploymentSettingsUpdate({ clearTurnstileSecret: true }, first);
    assert.equal(cleared.turnstileSecretConfigured, false);
    assert.equal(cleared.turnstileSecretEnc, null);
  });

  it("strips the encrypted secret for client consumers", () => {
    const built = buildDeploymentSettingsUpdate({ turnstileSecret: "hidden" });
    const client = sanitizeDeploymentSettingsForClient(built);
    assert.equal(client.turnstileSecretConfigured, true);
    assert.equal(client.turnstileSecretEnc, undefined);
  });

  it("applyDeploymentRuntimeOverrides installs the resolved secret into the auth layer", () => {
    const built = buildDeploymentSettingsUpdate({
      turnstileSecret: "1x0000000000000000000000000000000AA",
      turnstileSiteKey: "1x00000000000000000000AA",
    });
    applyDeploymentRuntimeOverrides(built);
    const cfg = getTurnstileConfig({});
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.secretConfigured, true);
  });
});
