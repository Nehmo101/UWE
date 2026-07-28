import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  buildGoogleOAuthSettingsUpdate,
  resolveGoogleOAuthConfig,
  resolveLoginMethodsPublicConfig,
} from "./login-methods-settings";
import { DEFAULT_SYSTEM_SETTINGS, sanitizeSettingsForClient } from "./settings-service";
import type { AuthSettings } from "./settings-service";

function baseAuth(overrides: Partial<AuthSettings> = {}): AuthSettings {
  return { ...DEFAULT_SYSTEM_SETTINGS.auth, ...overrides };
}

describe("google oauth settings", () => {
  before(() => {
    process.env.SESSION_SECRET = "login-methods-test-secret";
  });

  after(() => {
    delete process.env.SESSION_SECRET;
  });

  it("encrypts a new secret and resolves the effective config", () => {
    const updated = buildGoogleOAuthSettingsUpdate(
      {
        googleLoginEnabled: true,
        googleClientId: "client-123.apps.googleusercontent.com",
        googleClientSecret: "top-secret-value",
      },
      baseAuth(),
    );

    assert.equal(updated.googleClientSecretConfigured, true);
    assert.ok(updated.googleClientSecretEnc);
    assert.ok(!updated.googleClientSecretEnc?.includes("top-secret-value"));

    const config = resolveGoogleOAuthConfig(baseAuth(updated));
    assert.equal(config?.clientId, "client-123.apps.googleusercontent.com");
    assert.equal(config?.clientSecret, "top-secret-value");
  });

  it("keeps the stored secret on blank input and clears it explicitly", () => {
    const existing = baseAuth(
      buildGoogleOAuthSettingsUpdate(
        { googleLoginEnabled: true, googleClientId: "id", googleClientSecret: "keep-me" },
        baseAuth(),
      ),
    );

    const blank = buildGoogleOAuthSettingsUpdate(
      { googleLoginEnabled: true, googleClientId: "id", googleClientSecret: "" },
      existing,
    );
    assert.equal(blank.googleClientSecretEnc, existing.googleClientSecretEnc);

    const cleared = buildGoogleOAuthSettingsUpdate(
      { googleLoginEnabled: true, googleClientId: "id", clearGoogleClientSecret: true },
      existing,
    );
    assert.equal(cleared.googleClientSecretEnc, null);
    assert.equal(cleared.googleClientSecretConfigured, false);
  });

  it("treats missing id/secret or disabled toggle as method-off", () => {
    const withSecret = buildGoogleOAuthSettingsUpdate(
      { googleLoginEnabled: true, googleClientId: "id", googleClientSecret: "s" },
      baseAuth(),
    );

    assert.equal(resolveGoogleOAuthConfig(baseAuth()), null);
    assert.equal(
      resolveGoogleOAuthConfig(baseAuth({ ...withSecret, googleLoginEnabled: false })),
      null,
    );
    assert.equal(
      resolveGoogleOAuthConfig(baseAuth({ ...withSecret, googleClientId: "" })),
      null,
    );

    const publicConfig = resolveLoginMethodsPublicConfig(baseAuth(withSecret));
    assert.equal(publicConfig.googleLoginEnabled, true);
    assert.equal(publicConfig.passkeysEnabled, false);
  });

  it("strips the encrypted secret from client-facing settings", () => {
    const withSecret = buildGoogleOAuthSettingsUpdate(
      {
        googleLoginEnabled: true,
        googleClientId: "id",
        googleClientSecret: "google-secret-do-not-leak",
      },
      baseAuth(),
    );
    const sanitized = sanitizeSettingsForClient({
      ...DEFAULT_SYSTEM_SETTINGS,
      auth: baseAuth(withSecret),
    });

    assert.equal(sanitized.auth.googleClientSecretEnc, undefined);
    assert.equal(sanitized.auth.googleClientSecretConfigured, true);
    assert.ok(!JSON.stringify(sanitized).includes("google-secret-do-not-leak"));
  });
});
