import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LoginAttemptAuditInput } from "@uwe/auth";
import {
  createPasskeyRouteHandlers,
  type PasskeyAuditEvent,
  type PasskeyCredentialViewPort,
  type PasskeyLoginCredentialPort,
  type PasskeyRouteDeps,
  type PasskeyStorePort,
  type WebAuthnVerifierPort,
} from "./passkey-routes";

interface FakeDb {
  $disconnect(): Promise<void>;
}

const RP = { rpId: "uwe.test", rpName: "UWE", origins: ["https://studio.uwe.test"] };

function encodeClientData(challenge: string): string {
  return Buffer.from(JSON.stringify({ challenge, origin: RP.origins[0] })).toString("base64url");
}

function buildLoginBody(challenge: string, credentialId = "cred-1"): Record<string, unknown> {
  return {
    id: credentialId,
    rawId: credentialId,
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON: encodeClientData(challenge),
      authenticatorData: "authdata",
      signature: "sig",
    },
  };
}

class FakeStore implements PasskeyStorePort {
  challenges = new Map<string, { type: string; userId: string | null; consumed: boolean }>();
  credentials = new Map<string, PasskeyLoginCredentialPort>();
  inserted: Array<Record<string, unknown>> = [];
  counters = new Map<string, number>();
  deleted: Array<{ userId: string; id: string }> = [];

  async persistChallenge(input: {
    challenge: string;
    type: "registration" | "authentication";
    userId?: string | null;
  }): Promise<{ expiresAt: Date }> {
    this.challenges.set(input.challenge, {
      type: input.type,
      userId: input.userId ?? null,
      consumed: false,
    });
    return { expiresAt: new Date(Date.now() + 60_000) };
  }

  async consumeChallenge(
    challenge: string,
    type: "registration" | "authentication",
  ): Promise<{ userId: string | null } | null> {
    const record = this.challenges.get(challenge);
    if (!record || record.type !== type || record.consumed) {
      return null;
    }
    record.consumed = true;
    return { userId: record.userId };
  }

  async insertCredential(
    input: Parameters<PasskeyStorePort["insertCredential"]>[0],
  ): Promise<PasskeyCredentialViewPort> {
    this.inserted.push({ ...input });
    return {
      id: "new-cred-row",
      name: input.name,
      deviceType: input.deviceType ?? null,
      backedUp: input.backedUp ?? false,
      createdAt: new Date(0),
      lastUsedAt: null,
    };
  }

  async listForUser(): Promise<PasskeyCredentialViewPort[]> {
    return [];
  }

  async listCredentialIdsForUser(): Promise<string[]> {
    return [...this.credentials.keys()];
  }

  async findByCredentialIdForLogin(
    credentialId: string,
  ): Promise<PasskeyLoginCredentialPort | null> {
    return this.credentials.get(credentialId) ?? null;
  }

  async updateAfterLogin(id: string, counter: number): Promise<void> {
    this.counters.set(id, counter);
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    this.deleted.push({ userId, id });
    return id === "deletable";
  }
}

function activeCredential(
  overrides: Partial<PasskeyLoginCredentialPort> = {},
): PasskeyLoginCredentialPort {
  return {
    id: "row-1",
    userId: "user-1",
    credentialId: "cred-1",
    publicKey: Buffer.from("public-key").toString("base64url"),
    counter: 0,
    transports: ["internal"],
    rpId: RP.rpId,
    user: {
      id: "user-1",
      displayName: "Test-DM",
      email: "dm@uwe.local",
      role: "dm",
      status: "active",
      forcePasswordChange: false,
    },
    ...overrides,
  };
}

interface Harness {
  store: FakeStore;
  loginAudits: Array<LoginAttemptAuditInput<FakeDb>>;
  auditEvents: PasskeyAuditEvent[];
  cookies: string[];
  deps: PasskeyRouteDeps<FakeDb>;
}

function buildHarness(overrides: Partial<PasskeyRouteDeps<FakeDb>> = {}): Harness {
  const store = new FakeStore();
  const loginAudits: Array<LoginAttemptAuditInput<FakeDb>> = [];
  const auditEvents: PasskeyAuditEvent[] = [];
  const cookies: string[] = [];

  const verifier = {
    ...({} as WebAuthnVerifierPort),
    generateAuthenticationOptions: (async () => ({
      challenge: "generated-challenge",
      rpId: RP.rpId,
    })) as unknown as WebAuthnVerifierPort["generateAuthenticationOptions"],
    generateRegistrationOptions: (async () => ({
      challenge: "generated-reg-challenge",
    })) as unknown as WebAuthnVerifierPort["generateRegistrationOptions"],
    verifyAuthenticationResponse: (async () => ({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    })) as unknown as WebAuthnVerifierPort["verifyAuthenticationResponse"],
    verifyRegistrationResponse: (async () => ({
      verified: true,
      registrationInfo: {
        credential: {
          id: "new-cred",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ["internal"],
        },
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
      },
    })) as unknown as WebAuthnVerifierPort["verifyRegistrationResponse"],
  };

  const deps: PasskeyRouteDeps<FakeDb> = {
    surface: "studio",
    guard: () => null,
    requireAuthedUser: async () => ({
      id: "user-1",
      email: "dm@uwe.local",
      displayName: "Test-DM",
    }),
    errorResponse: (message, status) => Response.json({ error: message }, { status }),
    rateKeyPrefix: "passkey-test",
    clientIpFromHeaders: () => "203.0.113.7",
    checkRateLimitAsync: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    loginRateLimitOptions: { maxAttempts: 10, windowMs: 60_000 },
    createDb: () => ({ $disconnect: async () => {} }),
    createStore: () => store,
    createAuthService: () => ({
      toAuthUser: (user) => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      }),
      createSession: async () => ({ id: "session-1", token: "session-token" }),
      recordSuccessfulLogin: async () => {},
    }),
    isPasskeysEnabled: async () => true,
    setSessionCookie: async (token) => {
      cookies.push(token);
    },
    relyingPartyForRequest: () => RP,
    auditRequestFromHeaders: () => ({ ip: "203.0.113.7", userAgent: "test" }),
    logLoginAttempt: async (input) => {
      loginAudits.push(input);
    },
    logAuditEvent: async (_db, event) => {
      auditEvents.push(event);
    },
    verifier,
    ...overrides,
  };

  return { store, loginAudits, auditEvents, cookies, deps };
}

function postRequest(body: unknown): Request {
  return new Request("https://studio.uwe.test/api/auth/passkey/login/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("passkey login options", () => {
  it("returns 404 when the toggle is off", async () => {
    const harness = buildHarness({ isPasskeysEnabled: async () => false });
    const handlers = createPasskeyRouteHandlers(harness.deps);

    const response = await handlers.handlePasskeyLoginOptions(postRequest({}));
    assert.equal(response.status, 404);
  });

  it("persists the generated challenge for usernameless login", async () => {
    const harness = buildHarness();
    const handlers = createPasskeyRouteHandlers(harness.deps);

    const response = await handlers.handlePasskeyLoginOptions(postRequest({}));
    assert.equal(response.status, 200);
    assert.ok(harness.store.challenges.has("generated-challenge"));
    assert.equal(harness.store.challenges.get("generated-challenge")?.userId, null);
  });
});

describe("passkey login verify", () => {
  async function seedChallenge(store: FakeStore, challenge = "login-challenge"): Promise<string> {
    await store.persistChallenge({ challenge, type: "authentication" });
    return challenge;
  }

  it("logs in a known credential and issues a session", async () => {
    const harness = buildHarness();
    harness.store.credentials.set("cred-1", activeCredential());
    const handlers = createPasskeyRouteHandlers(harness.deps);
    const challenge = await seedChallenge(harness.store);

    const response = await handlers.handlePasskeyLoginVerify(postRequest(buildLoginBody(challenge)));
    assert.equal(response.status, 200);

    const body = (await response.json()) as { user?: { id?: string } };
    assert.equal(body.user?.id, "user-1");
    assert.deepEqual(harness.cookies, ["session-token"]);
    assert.equal(harness.store.counters.get("row-1"), 1);

    const success = harness.loginAudits.find((entry) => entry.sessionId === "session-1");
    assert.ok(success);
    assert.equal(success?.extraMetadata?.method, "passkey");
  });

  it("rejects a replayed challenge", async () => {
    const harness = buildHarness();
    harness.store.credentials.set("cred-1", activeCredential());
    const handlers = createPasskeyRouteHandlers(harness.deps);
    const challenge = await seedChallenge(harness.store);

    const first = await handlers.handlePasskeyLoginVerify(postRequest(buildLoginBody(challenge)));
    assert.equal(first.status, 200);

    const replay = await handlers.handlePasskeyLoginVerify(postRequest(buildLoginBody(challenge)));
    assert.equal(replay.status, 401);
    assert.ok(harness.loginAudits.some((entry) => entry.reason === "passkey_invalid"));
  });

  it("rejects an unknown credential", async () => {
    const harness = buildHarness();
    const handlers = createPasskeyRouteHandlers(harness.deps);
    const challenge = await seedChallenge(harness.store);

    const response = await handlers.handlePasskeyLoginVerify(
      postRequest(buildLoginBody(challenge, "unknown-cred")),
    );
    assert.equal(response.status, 401);
    assert.equal(harness.cookies.length, 0);
  });

  it("rejects a credential registered for another RP ID", async () => {
    const harness = buildHarness();
    harness.store.credentials.set("cred-1", activeCredential({ rpId: "old-domain.test" }));
    const handlers = createPasskeyRouteHandlers(harness.deps);
    const challenge = await seedChallenge(harness.store);

    const response = await handlers.handlePasskeyLoginVerify(postRequest(buildLoginBody(challenge)));
    assert.equal(response.status, 401);

    const audit = harness.loginAudits.find((entry) => entry.reason === "passkey_invalid");
    assert.equal(audit?.extraMetadata?.stage, "rp_mismatch");
  });

  it("rejects a non-increasing counter between two non-zero values", async () => {
    const harness = buildHarness();
    harness.store.credentials.set("cred-1", activeCredential({ counter: 5 }));
    harness.deps.verifier = {
      ...harness.deps.verifier!,
      verifyAuthenticationResponse: (async () => ({
        verified: true,
        authenticationInfo: { newCounter: 5 },
      })) as unknown as WebAuthnVerifierPort["verifyAuthenticationResponse"],
    };
    const handlers = createPasskeyRouteHandlers(harness.deps);
    const challenge = await seedChallenge(harness.store);

    const response = await handlers.handlePasskeyLoginVerify(postRequest(buildLoginBody(challenge)));
    assert.equal(response.status, 401);
    assert.equal(harness.cookies.length, 0);
  });

  it("denies users without surface access", async () => {
    const harness = buildHarness({ hasAccess: (user) => user.role === "owner" });
    harness.store.credentials.set("cred-1", activeCredential());
    const handlers = createPasskeyRouteHandlers(harness.deps);
    const challenge = await seedChallenge(harness.store);

    const response = await handlers.handlePasskeyLoginVerify(postRequest(buildLoginBody(challenge)));
    assert.equal(response.status, 401);
    assert.ok(harness.loginAudits.some((entry) => entry.reason === "studio_access_denied"));
    assert.equal(harness.cookies.length, 0);
  });

  it("audits login_method_disabled when the toggle is off", async () => {
    const harness = buildHarness({ isPasskeysEnabled: async () => false });
    const handlers = createPasskeyRouteHandlers(harness.deps);

    const response = await handlers.handlePasskeyLoginVerify(postRequest(buildLoginBody("x")));
    assert.equal(response.status, 404);
    assert.ok(harness.loginAudits.some((entry) => entry.reason === "login_method_disabled"));
  });
});

describe("passkey registration", () => {
  it("registers a verified credential bound to the session user", async () => {
    const harness = buildHarness();
    const handlers = createPasskeyRouteHandlers(harness.deps);

    const optionsResponse = await handlers.handlePasskeyRegisterOptions(postRequest({}));
    assert.equal(optionsResponse.status, 200);
    assert.equal(
      harness.store.challenges.get("generated-reg-challenge")?.userId,
      "user-1",
    );

    const response = await handlers.handlePasskeyRegisterVerify(
      postRequest({
        name: "iPhone von Test",
        response: {
          id: "new-cred",
          rawId: "new-cred",
          type: "public-key",
          clientExtensionResults: {},
          response: { clientDataJSON: encodeClientData("generated-reg-challenge") },
        },
      }),
    );
    assert.equal(response.status, 200);

    const inserted = harness.store.inserted[0];
    assert.equal(inserted?.userId, "user-1");
    assert.equal(inserted?.credentialId, "new-cred");
    assert.equal(inserted?.rpId, RP.rpId);
    assert.equal(inserted?.name, "iPhone von Test");
    assert.ok(harness.auditEvents.some((event) => event.action === "passkey_registered"));
  });

  it("rejects a registration challenge issued to a different user", async () => {
    const harness = buildHarness();
    await harness.store.persistChallenge({
      challenge: "foreign-challenge",
      type: "registration",
      userId: "someone-else",
    });
    const handlers = createPasskeyRouteHandlers(harness.deps);

    const response = await handlers.handlePasskeyRegisterVerify(
      postRequest({
        response: {
          id: "new-cred",
          rawId: "new-cred",
          type: "public-key",
          clientExtensionResults: {},
          response: { clientDataJSON: encodeClientData("foreign-challenge") },
        },
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(harness.store.inserted.length, 0);
  });
});

describe("passkey management", () => {
  it("deletes only own credentials and audits the removal", async () => {
    const harness = buildHarness();
    const handlers = createPasskeyRouteHandlers(harness.deps);

    const missing = await handlers.handlePasskeyDelete(postRequest({}), "not-mine");
    assert.equal(missing.status, 404);

    const removed = await handlers.handlePasskeyDelete(postRequest({}), "deletable");
    assert.equal(removed.status, 200);
    assert.deepEqual(harness.store.deleted.at(-1), { userId: "user-1", id: "deletable" });
    assert.ok(harness.auditEvents.some((event) => event.action === "passkey_removed"));
  });
});
