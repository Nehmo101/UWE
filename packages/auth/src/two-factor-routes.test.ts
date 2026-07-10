import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTwoFactorRouteHandlers,
  type TwoFactorAuditEvent,
  type TwoFactorRateLimitResult,
  type TwoFactorRouteDeps,
  type TwoFactorServicePort,
} from "./two-factor-routes";

interface FakeDb {
  disconnected: number;
  $disconnect(): Promise<void>;
}

function createFakeDb(): FakeDb {
  return {
    disconnected: 0,
    async $disconnect() {
      this.disconnected += 1;
    },
  };
}

function createFakeService(overrides: Partial<TwoFactorServicePort> = {}): TwoFactorServicePort {
  return {
    isEnabled: async () => false,
    beginSetup: async () => ({ secret: "SECRET", otpauthUri: "otpauth://totp/x" }),
    confirmSetup: async () => true,
    disable: async () => {},
    createLoginChallenge: async () => ({ challengeToken: "challenge-token" }),
    verifyLoginChallenge: async () => ({ userId: "user-1" }),
    ...overrides,
  };
}

interface Recorded {
  rateKeys: string[];
  audits: TwoFactorAuditEvent[];
  userLookups: number;
}

function buildDeps(
  rateKeyPrefix: string,
  overrides: Partial<TwoFactorRouteDeps<FakeDb>> = {},
): { deps: TwoFactorRouteDeps<FakeDb>; recorded: Recorded; db: FakeDb } {
  const db = createFakeDb();
  const recorded: Recorded = { rateKeys: [], audits: [], userLookups: 0 };
  const deps: TwoFactorRouteDeps<FakeDb> = {
    guard: () => null,
    requireAuthedUser: async () => {
      recorded.userLookups += 1;
      return { id: "user-1", email: "user@example.com", displayName: "User" };
    },
    errorResponse: (message, status) => Response.json({ error: message }, { status }),
    rateKeyPrefix,
    clientIpFromHeaders: () => "1.2.3.4",
    checkRateLimitAsync: async (key): Promise<TwoFactorRateLimitResult> => {
      recorded.rateKeys.push(key);
      return { allowed: true, retryAfterSeconds: 0 };
    },
    createPrismaClient: () => db,
    createTwoFactorService: () => createFakeService(),
    logAuditEvent: async (_db, event) => {
      recorded.audits.push(event);
    },
    auditRequestFromHeaders: () => ({ ip: "1.2.3.4", userAgent: null }),
    ...overrides,
  };
  return { deps, recorded, db };
}

function activateRequest(code: unknown): Request {
  return new Request("http://app.test/api/auth/two-factor/activate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

describe("createTwoFactorRouteHandlers", () => {
  const prefixCases: ReadonlyArray<readonly [string, string]> = [
    ["2fa", "2fa-activate:1.2.3.4:user-1"],
    ["portal-2fa", "portal-2fa-activate:1.2.3.4:user-1"],
  ];

  for (const [prefix, expectedKey] of prefixCases) {
    it(`activate keys the rate limiter with the "${prefix}" prefix`, async () => {
      const { deps, recorded } = buildDeps(prefix);
      const handlers = createTwoFactorRouteHandlers(deps);

      const res = await handlers.handleTwoFactorActivate(activateRequest("123456"));

      assert.equal(res.status, 200);
      assert.deepEqual(recorded.rateKeys, [expectedKey]);
    });
  }

  it("activate logs mfa_enabled, returns ok, and disconnects on success", async () => {
    const { deps, recorded, db } = buildDeps("2fa");

    const res = await createTwoFactorRouteHandlers(deps).handleTwoFactorActivate(
      activateRequest("123456"),
    );

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      ok: true,
      message: "Zwei-Faktor-Authentifizierung wurde aktiviert.",
    });
    assert.deepEqual(
      recorded.audits.map((event) => event.action),
      ["mfa_enabled"],
    );
    assert.equal(db.disconnected, 1);
  });

  it("activate with a wrong code logs mfa_challenge_failed and returns 400", async () => {
    const { deps, recorded } = buildDeps("2fa", {
      createTwoFactorService: () => createFakeService({ confirmSetup: async () => false }),
    });

    const res = await createTwoFactorRouteHandlers(deps).handleTwoFactorActivate(
      activateRequest("000000"),
    );

    assert.equal(res.status, 400);
    assert.deepEqual(
      recorded.audits.map((event) => event.action),
      ["mfa_challenge_failed"],
    );
  });

  it("activate rejects a missing code before touching the rate limiter", async () => {
    const { deps, recorded } = buildDeps("2fa");

    const res = await createTwoFactorRouteHandlers(deps).handleTwoFactorActivate(
      activateRequest(""),
    );

    assert.equal(res.status, 400);
    assert.deepEqual(recorded.rateKeys, []);
  });

  it("activate returns 429 with Retry-After when the limiter denies", async () => {
    const { deps } = buildDeps("2fa", {
      checkRateLimitAsync: async () => ({ allowed: false, retryAfterSeconds: 42 }),
    });

    const res = await createTwoFactorRouteHandlers(deps).handleTwoFactorActivate(
      activateRequest("123456"),
    );

    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "42");
  });

  it("a guard rejection short-circuits before the user lookup", async () => {
    const guardRes = Response.json({ error: "blocked" }, { status: 403 });
    const { deps, recorded } = buildDeps("2fa", { guard: () => guardRes });

    const res = await createTwoFactorRouteHandlers(deps).handleTwoFactorStatus(
      new Request("http://app.test/api/auth/two-factor"),
    );

    assert.equal(res, guardRes);
    assert.equal(recorded.userLookups, 0);
  });

  it("a missing user yields 401 via the injected errorResponse", async () => {
    const { deps } = buildDeps("2fa", { requireAuthedUser: async () => null });

    const res = await createTwoFactorRouteHandlers(deps).handleTwoFactorStatus(
      new Request("http://app.test/api/auth/two-factor"),
    );

    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Anmeldung erforderlich." });
  });

  it("status returns the enabled flag and disconnects the db", async () => {
    const { deps, db } = buildDeps("2fa", {
      createTwoFactorService: () => createFakeService({ isEnabled: async () => true }),
    });

    const res = await createTwoFactorRouteHandlers(deps).handleTwoFactorStatus(
      new Request("http://app.test/api/auth/two-factor"),
    );

    assert.deepEqual(await res.json(), { enabled: true });
    assert.equal(db.disconnected, 1);
  });
});
