"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

/**
 * Browser-side passkey (WebAuthn) helpers shared by the Studio and Portal
 * login forms and account-security panels. Server counterpart: the
 * `/api/auth/passkey/*` routes (see `@uwe/passkeys`).
 */

export interface PasskeyLoginSuccessUser {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
}

export interface PasskeyLoginResult {
  ok: boolean;
  /** True when the user dismissed the platform dialog — not an error state. */
  cancelled?: boolean;
  error?: string;
  user?: PasskeyLoginSuccessUser;
  forcePasswordChange?: boolean;
}

export interface PasskeyRegisterResult {
  ok: boolean;
  cancelled?: boolean;
  error?: string;
}

/**
 * Whether this browser can do passkeys at all: requires a secure context
 * (HTTPS or localhost — plain-HTTP LAN setups get `false`) and the WebAuthn
 * API. Call from an effect/event handler only — always `false` during SSR.
 */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.get === "function"
  );
}

function isAbortLikeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "NotAllowedError" || error.name === "AbortError")
  );
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

const CONNECTION_ERROR = "Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.";

/**
 * Runs the full usernameless passkey login ceremony. On success the session
 * cookie is already set by the verify endpoint — the caller only needs to
 * redirect (respecting `forcePasswordChange`).
 */
export async function loginWithPasskey(
  options: { optionsUrl?: string; verifyUrl?: string } = {},
): Promise<PasskeyLoginResult> {
  const optionsUrl = options.optionsUrl ?? "/api/auth/passkey/login/options";
  const verifyUrl = options.verifyUrl ?? "/api/auth/passkey/login/verify";

  let optionsResponse: Response;
  try {
    optionsResponse = await fetch(optionsUrl, {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, error: CONNECTION_ERROR };
  }

  const optionsPayload = await readJson<{ error?: string; challenge?: string }>(optionsResponse);
  if (!optionsResponse.ok || !optionsPayload?.challenge) {
    return {
      ok: false,
      error: optionsPayload?.error ?? "Passkey-Login ist derzeit nicht verfügbar.",
    };
  }

  let assertion;
  try {
    assertion = await startAuthentication({
      optionsJSON: optionsPayload as Parameters<
        typeof startAuthentication
      >[0]["optionsJSON"],
    });
  } catch (error) {
    if (isAbortLikeError(error)) {
      return { ok: false, cancelled: true };
    }
    return { ok: false, error: "Der Passkey konnte nicht verwendet werden." };
  }

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assertion),
    });
  } catch {
    return { ok: false, error: CONNECTION_ERROR };
  }

  const verifyPayload = await readJson<{
    error?: string;
    user?: PasskeyLoginSuccessUser;
    forcePasswordChange?: boolean;
  }>(verifyResponse);

  if (!verifyResponse.ok || !verifyPayload?.user) {
    return { ok: false, error: verifyPayload?.error ?? "Ungültige Anmeldedaten." };
  }

  return {
    ok: true,
    user: verifyPayload.user,
    forcePasswordChange: verifyPayload.forcePasswordChange ?? false,
  };
}

/**
 * Registers a new passkey for the logged-in user (account security page).
 * `name` is the user-visible label ("iPhone", "YubiKey", …).
 */
export async function registerPasskey(
  options: { name: string; optionsUrl?: string; verifyUrl?: string },
): Promise<PasskeyRegisterResult> {
  const optionsUrl = options.optionsUrl ?? "/api/auth/passkey/register/options";
  const verifyUrl = options.verifyUrl ?? "/api/auth/passkey/register/verify";

  let optionsResponse: Response;
  try {
    optionsResponse = await fetch(optionsUrl, {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, error: CONNECTION_ERROR };
  }

  const optionsPayload = await readJson<{ error?: string; challenge?: string }>(optionsResponse);
  if (!optionsResponse.ok || !optionsPayload?.challenge) {
    return {
      ok: false,
      error: optionsPayload?.error ?? "Passkey-Registrierung ist derzeit nicht verfügbar.",
    };
  }

  let attestation;
  try {
    attestation = await startRegistration({
      optionsJSON: optionsPayload as Parameters<
        typeof startRegistration
      >[0]["optionsJSON"],
    });
  } catch (error) {
    if (isAbortLikeError(error)) {
      return { ok: false, cancelled: true };
    }
    if (error instanceof Error && error.name === "InvalidStateError") {
      return { ok: false, error: "Dieses Gerät hat bereits einen Passkey für dein Konto." };
    }
    return {
      ok: false,
      error: "Der Passkey konnte nicht erstellt werden. Unterstützt dieses Gerät Face ID, Touch ID oder Windows Hello?",
    };
  }

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: options.name, response: attestation }),
    });
  } catch {
    return { ok: false, error: CONNECTION_ERROR };
  }

  if (!verifyResponse.ok) {
    const payload = await readJson<{ error?: string }>(verifyResponse);
    return { ok: false, error: payload?.error ?? "Der Passkey konnte nicht gespeichert werden." };
  }

  return { ok: true };
}
