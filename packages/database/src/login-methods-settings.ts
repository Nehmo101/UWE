import type { AuthSettings } from "./settings-service";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";

/**
 * Self-service configuration for the alternative login methods (settings tab
 * "Anmeldung"). Follows the established secret pattern (`deployment-settings.ts`
 * Turnstile secret): the Google client secret is stored AES-GCM encrypted, a
 * blank input preserves the stored value, an explicit clear checkbox removes
 * it, and clients only ever see the derived `googleClientSecretConfigured`.
 */

export interface GoogleOAuthSettingsInput {
  googleLoginEnabled: boolean;
  googleClientId: string;
  /** New secret to store; blank keeps the existing one. */
  googleClientSecret?: string;
  clearGoogleClientSecret?: boolean;
}

/** Merges a settings-form input over the existing auth settings. */
export function buildGoogleOAuthSettingsUpdate(
  input: GoogleOAuthSettingsInput,
  existing: AuthSettings,
): Pick<
  AuthSettings,
  "googleLoginEnabled" | "googleClientId" | "googleClientSecretEnc" | "googleClientSecretConfigured"
> {
  let googleClientSecretEnc = existing.googleClientSecretEnc ?? null;
  if (input.clearGoogleClientSecret) {
    googleClientSecretEnc = null;
  } else {
    const secret = input.googleClientSecret?.trim();
    if (secret) {
      googleClientSecretEnc = encryptSecret(secret, resolveTokenEncryptionSecret());
    }
  }

  return {
    googleLoginEnabled: input.googleLoginEnabled,
    googleClientId: input.googleClientId.trim(),
    googleClientSecretEnc,
    googleClientSecretConfigured: Boolean(googleClientSecretEnc),
  };
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Decrypts the effective Google OAuth config. Returns `null` unless the toggle
 * is on AND client id AND secret are present/decryptable — the login routes
 * treat `null` as "method disabled".
 */
export function resolveGoogleOAuthConfig(auth: AuthSettings): GoogleOAuthConfig | null {
  if (!auth.googleLoginEnabled || !auth.googleClientId.trim() || !auth.googleClientSecretEnc) {
    return null;
  }
  try {
    const clientSecret = decryptSecret(auth.googleClientSecretEnc, resolveTokenEncryptionSecret());
    if (!clientSecret) {
      return null;
    }
    return { clientId: auth.googleClientId.trim(), clientSecret };
  } catch {
    // Secret encrypted under a rotated key — surfaced by the secrets status page.
    return null;
  }
}

/** What the login pages may know about the enabled methods (no secret material). */
export interface LoginMethodsPublicConfig {
  passkeysEnabled: boolean;
  googleLoginEnabled: boolean;
}

export function resolveLoginMethodsPublicConfig(auth: AuthSettings): LoginMethodsPublicConfig {
  return {
    passkeysEnabled: auth.passkeysEnabled,
    googleLoginEnabled: resolveGoogleOAuthConfig(auth) !== null,
  };
}
