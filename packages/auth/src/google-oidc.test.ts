import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGoogleAuthUrl,
  decodeGoogleState,
  encodeGoogleState,
  exchangeGoogleCode,
  hashGoogleStateCookieValue,
  validateGoogleIdToken,
  verifyGoogleOAuthState,
} from "./google-oidc";

const CLIENT_ID = "client-123.apps.googleusercontent.com";

function buildIdToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256" })}.${encode(claims)}.signature`;
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-sub-1",
    email: "dm@uwe.local",
    email_verified: true,
    name: "Test-DM",
    iat: nowSeconds - 10,
    exp: nowSeconds + 3600,
    nonce: "nonce-1",
    ...overrides,
  };
}

describe("google oauth state", () => {
  it("round-trips and verifies against the hashed cookie", () => {
    const state = { target: "portal", intent: "login", nonce: "abc" } as const;
    const encoded = encodeGoogleState(state);
    assert.deepEqual(decodeGoogleState(encoded), state);

    const verified = verifyGoogleOAuthState(encoded, hashGoogleStateCookieValue("abc"));
    assert.equal(verified.ok, true);

    const wrongCookie = verifyGoogleOAuthState(encoded, hashGoogleStateCookieValue("other"));
    assert.equal(wrongCookie.ok, false);

    assert.equal(verifyGoogleOAuthState(null, "x").ok, false);
    assert.equal(decodeGoogleState("not-base64-json"), null);
    assert.equal(
      decodeGoogleState(Buffer.from(JSON.stringify({ target: "evil" })).toString("base64url")),
      null,
    );
  });
});

describe("buildGoogleAuthUrl", () => {
  it("targets Google's auth endpoint with code flow and account picker", () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: CLIENT_ID,
        redirectUri: "https://studio.uwe.example/api/auth/google/callback",
        state: "state-1",
        nonce: "nonce-1",
      }),
    );
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
    assert.equal(url.searchParams.get("scope"), "openid email profile");
    assert.equal(url.searchParams.get("nonce"), "nonce-1");
    assert.equal(url.searchParams.get("prompt"), "select_account");
  });
});

describe("validateGoogleIdToken", () => {
  const options = { clientId: CLIENT_ID, expectedNonce: "nonce-1" };

  it("accepts a valid token and extracts the identity", () => {
    const result = validateGoogleIdToken(buildIdToken(validClaims()), options);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.identity.sub, "google-sub-1");
    assert.equal(result.identity.email, "dm@uwe.local");
    assert.equal(result.identity.emailVerified, true);
  });

  it("rejects tampered issuer, audience, expiry and nonce", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [validClaims({ iss: "https://evil.example" }), "issuer_mismatch"],
      [validClaims({ aud: "other-client" }), "audience_mismatch"],
      [validClaims({ exp: Math.floor(Date.now() / 1000) - 3600 }), "token_expired"],
      [validClaims({ iat: Math.floor(Date.now() / 1000) + 3600 }), "token_from_future"],
      [validClaims({ nonce: "different" }), "nonce_mismatch"],
      [validClaims({ sub: "" }), "missing_subject"],
    ];
    for (const [claims, reason] of cases) {
      const result = validateGoogleIdToken(buildIdToken(claims), options);
      assert.equal(result.ok, false, reason);
      if (result.ok) continue;
      assert.equal(result.reason, reason);
    }
    assert.equal(validateGoogleIdToken("garbage", options).ok, false);
  });

  it("treats a missing email_verified claim as unverified", () => {
    const claims = validClaims();
    delete claims.email_verified;
    const result = validateGoogleIdToken(buildIdToken(claims), options);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.identity.emailVerified, false);
  });
});

describe("exchangeGoogleCode", () => {
  const input = {
    code: "auth-code",
    clientId: CLIENT_ID,
    clientSecret: "secret",
    redirectUri: "https://studio.uwe.example/api/auth/google/callback",
  };

  it("posts the code and returns the id token", async () => {
    let requestedBody = "";
    const result = await exchangeGoogleCode({
      ...input,
      fetchImpl: (async (_url: unknown, init?: RequestInit) => {
        requestedBody = String(init?.body ?? "");
        return Response.json({ id_token: "the-token" });
      }) as typeof fetch,
    });
    assert.deepEqual(result, { ok: true, idToken: "the-token" });
    assert.ok(requestedBody.includes("grant_type=authorization_code"));
    assert.ok(requestedBody.includes("code=auth-code"));
  });

  it("propagates provider errors and network failures as failures", async () => {
    const providerError = await exchangeGoogleCode({
      ...input,
      fetchImpl: (async () =>
        Response.json({ error: "invalid_grant" }, { status: 400 })) as typeof fetch,
    });
    assert.deepEqual(providerError, { ok: false, error: "invalid_grant" });

    const network = await exchangeGoogleCode({
      ...input,
      fetchImpl: (async () => {
        throw new Error("offline");
      }) as typeof fetch,
    });
    assert.equal(network.ok, false);
  });
});
