import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { setRuntimeEnvOverrides } from "@uwe/auth";
import {
  DEFAULT_DEPLOYMENT_SETTINGS,
  applyDeploymentRuntimeOverrides,
  buildDeploymentEnvOverrides,
  buildDeploymentSettingsUpdate,
  normalizeDeploymentSettings,
  resolveCloudflareEdgeCredentials,
  sanitizeDeploymentSettingsForClient,
} from "./deployment-settings";
import { getTurnstileConfig, resolveFamilyPublicBaseUrl } from "@uwe/auth";

describe("deployment settings", () => {
  afterEach(() => setRuntimeEnvOverrides(null));

  it("defaults produce no env overrides (pure env fallback)", () => {
    assert.deepEqual(buildDeploymentEnvOverrides(DEFAULT_DEPLOYMENT_SETTINGS), {});
  });

  it("maps strings and tri-state flags to env keys", () => {
    const overrides = buildDeploymentEnvOverrides(
      normalizeDeploymentSettings({
        publicAppUrl: "https://uwe.example",
        studioUrl: "https://studio.uwe.example",
        portalUrl: "https://portal.uwe.example",
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

    assert.equal(overrides.PUBLIC_BASE_URL, "https://uwe.example");
    assert.equal(overrides.NEXT_PUBLIC_STUDIO_URL, "https://studio.uwe.example");
    assert.equal(overrides.NEXT_PUBLIC_PORTAL_URL, "https://portal.uwe.example");
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

  it("Brain exposure defaults to loopback and accepts the documented values", () => {
    assert.equal(DEFAULT_DEPLOYMENT_SETTINGS.brainExposure, "loopback");
    // Anything unrecognised — e.g. a stray "on" — collapses to loopback.
    assert.equal(normalizeDeploymentSettings({ brainExposure: "on" }).brainExposure, "loopback");
    assert.equal(normalizeDeploymentSettings({ brainExposure: "lan" }).brainExposure, "lan");
    assert.equal(normalizeDeploymentSettings({ brainExposure: "public" }).brainExposure, "public");
    assert.equal(normalizeDeploymentSettings({ brainExposure: "off" }).brainExposure, "off");
  });

  it("Brain env overrides carry the origin/path and the exposure value", () => {
    const overrides = buildDeploymentEnvOverrides(
      normalizeDeploymentSettings({
        brainUrl: "http://127.0.0.1:3002",
        brainPath: "/life-brain",
        brainExposure: "lan",
      }),
    );
    assert.equal(overrides.NEXT_PUBLIC_BRAIN_URL, "http://127.0.0.1:3002");
    assert.equal(overrides.BRAIN_PATH, "/life-brain");
    assert.equal(overrides.BRAIN_EXPOSURE, "lan");
    // Publishing Brain is a deliberate tunnel/proxy decision — the Brain
    // settings never flip the tunnel on as a side effect.
    assert.equal(overrides.CLOUDFLARE_TUNNEL, undefined);
    assert.ok(!("BRAIN_TUNNEL" in overrides));
    assert.ok(!("BRAIN_PUBLIC" in overrides));
  });

  it("Family origin becomes NEXT_PUBLIC_FAMILY_URL and reaches the link resolver", () => {
    assert.equal(DEFAULT_DEPLOYMENT_SETTINGS.familyUrl, "");
    // Unset = pure env fallback (the loopback default of resolveFamilyPublicBaseUrl).
    assert.equal(resolveFamilyPublicBaseUrl({}), "http://localhost:3004");

    const settings = normalizeDeploymentSettings({ familyUrl: " https://family.uwe.example " });
    assert.equal(
      buildDeploymentEnvOverrides(settings).NEXT_PUBLIC_FAMILY_URL,
      "https://family.uwe.example",
    );

    applyDeploymentRuntimeOverrides(settings);
    assert.equal(resolveFamilyPublicBaseUrl({}), "https://family.uwe.example");
  });

  it("public Brain exposure is carried through as an env override", () => {
    const overrides = buildDeploymentEnvOverrides(
      normalizeDeploymentSettings({ brainExposure: "public" }),
    );
    assert.equal(overrides.BRAIN_EXPOSURE, "public");
  });

  it("loopback Brain exposure falls through to env (no override emitted)", () => {
    const overrides = buildDeploymentEnvOverrides(
      normalizeDeploymentSettings({ brainExposure: "loopback" }),
    );
    assert.equal(overrides.BRAIN_EXPOSURE, undefined);
  });
});

describe("Cloudflare Managed Challenge settings", () => {
  afterEach(() => setRuntimeEnvOverrides(null));

  it("is off by default with no hostnames", () => {
    assert.equal(DEFAULT_DEPLOYMENT_SETTINGS.managedChallengeEnabled, false);
    assert.deepEqual(DEFAULT_DEPLOYMENT_SETTINGS.managedChallengeHostnames, []);
    assert.equal(DEFAULT_DEPLOYMENT_SETTINGS.managedChallengeAction, "managed_challenge");
  });

  it("normalises lists and collapses an unknown challenge level", () => {
    const settings = normalizeDeploymentSettings({
      managedChallengeEnabled: true,
      managedChallengeHostnames: [" studio.uwe.example ", "studio.uwe.example", ""],
      managedChallengeSkipPaths: "not-a-list",
      managedChallengeAction: "block",
    });

    assert.deepEqual(settings.managedChallengeHostnames, ["studio.uwe.example"]);
    assert.deepEqual(settings.managedChallengeSkipPaths, []);
    assert.equal(settings.managedChallengeAction, "managed_challenge");
  });

  it("keeps the stored API token when the field is left blank", () => {
    const first = buildDeploymentSettingsUpdate({ cloudflareApiToken: "cf-token" });
    assert.equal(first.cloudflareApiTokenConfigured, true);

    const second = buildDeploymentSettingsUpdate({ cloudflareZoneId: "zone-1" }, first);
    assert.equal(second.cloudflareApiTokenConfigured, true);
    assert.equal(second.cloudflareApiTokenEnc, first.cloudflareApiTokenEnc);
    assert.equal(second.cloudflareZoneId, "zone-1");
  });

  it("clears the API token on request so env takes over again", () => {
    const stored = buildDeploymentSettingsUpdate({ cloudflareApiToken: "cf-token" });
    const cleared = buildDeploymentSettingsUpdate({ clearCloudflareApiToken: true }, stored);

    assert.equal(cleared.cloudflareApiTokenConfigured, false);
    assert.equal(cleared.cloudflareApiTokenEnc, null);
  });

  it("never ships the encrypted API token to a browser client", () => {
    const built = buildDeploymentSettingsUpdate({ cloudflareApiToken: "cf-token" });
    const client = sanitizeDeploymentSettingsForClient(built);

    assert.equal(client.cloudflareApiTokenConfigured, true);
    assert.equal(client.cloudflareApiTokenEnc, undefined);
    assert.ok(!JSON.stringify(client).includes("cf-token"));
  });

  it("keeps the Cloudflare API token out of the process-wide env overlay", () => {
    const built = buildDeploymentSettingsUpdate({
      cloudflareApiToken: "cf-token",
      cloudflareZoneId: "zone-1",
      managedChallengeEnabled: true,
    });
    const overrides = buildDeploymentEnvOverrides(built);

    assert.equal(overrides.CLOUDFLARE_API_TOKEN, undefined);
    assert.equal(overrides.CLOUDFLARE_ZONE_ID, undefined);
    assert.ok(!JSON.stringify(overrides).includes("cf-token"));
  });

  it("resolves credentials from the database first, env as fallback", () => {
    const stored = buildDeploymentSettingsUpdate({
      cloudflareApiToken: "db-token",
      cloudflareZoneId: "db-zone",
    });
    const env = { CLOUDFLARE_API_TOKEN: "env-token", CLOUDFLARE_ZONE_ID: "env-zone" };

    assert.deepEqual(resolveCloudflareEdgeCredentials(stored, env), {
      apiToken: "db-token",
      zoneId: "db-zone",
    });
    assert.deepEqual(resolveCloudflareEdgeCredentials(DEFAULT_DEPLOYMENT_SETTINGS, env), {
      apiToken: "env-token",
      zoneId: "env-zone",
    });
    assert.deepEqual(resolveCloudflareEdgeCredentials(DEFAULT_DEPLOYMENT_SETTINGS, {}), {
      apiToken: null,
      zoneId: null,
    });
  });
});
