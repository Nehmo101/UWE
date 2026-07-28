import { createHash, randomBytes } from "node:crypto";

/**
 * Pure Google OIDC building blocks for "Mit Google anmelden" (server-only —
 * exported via `@uwe/auth/server`). Deliberately dependency-free:
 * authorization-code flow with a confidential client is one redirect URL, one
 * `fetch` POST to Google's token endpoint, and strict claim validation.
 *
 * On ID-token signatures: the token is received DIRECTLY from Google's token
 * endpoint over TLS, authenticated with the client secret. For exactly this
 * flow OIDC Core §3.1.3.7 permits using TLS server validation in place of
 * JWKS signature checking. We therefore validate `iss`, `aud`, `exp`/`iat`
 * and the `nonce` binding strictly — but skip JWKS, keeping this package
 * free of runtime dependencies. Never reuse `validateGoogleIdToken` for
 * tokens that arrive from a browser or any other untrusted channel.
 */

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_OAUTH_STATE_COOKIE = "uwe_google_oauth_state";
/** Provider key stored in `auth_identities.provider`. */
export const GOOGLE_IDENTITY_PROVIDER = "google";

export type GoogleLoginTarget = "studio" | "portal";
export type GoogleLoginIntent = "login" | "link";

export interface GoogleOAuthState {
  target: GoogleLoginTarget;
  intent: GoogleLoginIntent;
  nonce: string;
}

export function generateGoogleNonce(): string {
  return randomBytes(24).toString("base64url");
}

export function encodeGoogleState(state: GoogleOAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

export function decodeGoogleState(value: string): GoogleOAuthState | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      target?: unknown;
      intent?: unknown;
      nonce?: unknown;
    };
    if (
      (parsed.target !== "studio" && parsed.target !== "portal") ||
      (parsed.intent !== "login" && parsed.intent !== "link") ||
      typeof parsed.nonce !== "string" ||
      !parsed.nonce
    ) {
      return null;
    }
    return { target: parsed.target, intent: parsed.intent, nonce: parsed.nonce };
  } catch {
    return null;
  }
}

/** The state cookie stores only a hash of the nonce (spotify-oauth-state pattern). */
export function hashGoogleStateCookieValue(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

export function verifyGoogleOAuthState(
  stateParam: string | null,
  cookieValue: string | null | undefined,
): { ok: true; state: GoogleOAuthState } | { ok: false; reason: string } {
  if (!stateParam) {
    return { ok: false, reason: "OAuth-Status fehlt." };
  }
  const state = decodeGoogleState(stateParam);
  if (!state) {
    return { ok: false, reason: "Ungültiger OAuth-Status." };
  }
  if (!cookieValue || cookieValue !== hashGoogleStateCookieValue(state.nonce)) {
    return { ok: false, reason: "OAuth-Status konnte nicht verifiziert werden." };
  }
  return { ok: true, state };
}

export function buildGoogleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  loginHint?: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    nonce: input.nonce,
    prompt: "select_account",
  });
  if (input.loginHint) {
    params.set("login_hint", input.loginHint);
  }
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleTokenExchangeResult =
  | { ok: true; idToken: string }
  | { ok: false; error: string };

export async function exchangeGoogleCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleTokenExchangeResult> {
  const fetchImpl = input.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: input.redirectUri,
      }).toString(),
    });
  } catch {
    return { ok: false, error: "token_endpoint_unreachable" };
  }

  let payload: { id_token?: unknown; error?: unknown };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return { ok: false, error: "token_response_invalid" };
  }

  if (!response.ok || typeof payload.id_token !== "string" || !payload.id_token) {
    const error = typeof payload.error === "string" ? payload.error : "token_exchange_failed";
    return { ok: false, error };
  }

  return { ok: true, idToken: payload.id_token };
}

export interface GoogleIdentityClaims {
  /** Google's stable user id (`sub`) — the value an `AuthIdentity` binds to. */
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const CLOCK_SKEW_MS = 5 * 60_000;

export type GoogleIdTokenResult =
  | { ok: true; identity: GoogleIdentityClaims }
  | { ok: false; reason: string };

/**
 * Strictly validates the claims of an ID token obtained via
 * {@link exchangeGoogleCode} (see the module comment for why the signature
 * check is deliberately omitted for this channel).
 */
export function validateGoogleIdToken(
  idToken: string,
  options: { clientId: string; expectedNonce: string; now?: Date },
): GoogleIdTokenResult {
  const parts = idToken.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return { ok: false, reason: "malformed_token" };
  }

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return { ok: false, reason: "malformed_payload" };
  }

  if (typeof claims.iss !== "string" || !GOOGLE_ISSUERS.has(claims.iss)) {
    return { ok: false, reason: "issuer_mismatch" };
  }
  if (claims.aud !== options.clientId) {
    return { ok: false, reason: "audience_mismatch" };
  }

  const nowMs = (options.now ?? new Date()).getTime();
  if (typeof claims.exp !== "number" || nowMs > claims.exp * 1000 + CLOCK_SKEW_MS) {
    return { ok: false, reason: "token_expired" };
  }
  if (typeof claims.iat !== "number" || claims.iat * 1000 > nowMs + CLOCK_SKEW_MS) {
    return { ok: false, reason: "token_from_future" };
  }
  if (claims.nonce !== options.expectedNonce) {
    return { ok: false, reason: "nonce_mismatch" };
  }
  if (typeof claims.sub !== "string" || !claims.sub) {
    return { ok: false, reason: "missing_subject" };
  }

  return {
    ok: true,
    identity: {
      sub: claims.sub,
      email: typeof claims.email === "string" && claims.email ? claims.email : null,
      // Absent counts as unverified — never auto-link on an unverified e-mail.
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === "string" && claims.name ? claims.name : null,
    },
  };
}
