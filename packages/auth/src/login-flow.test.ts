import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeTwoFactorLogin,
  performLoginFlow,
  type CompleteTwoFactorLoginDeps,
  type LoginAttemptAuditInput,
  type LoginFlowUser,
  type PerformLoginFlowDeps,
} from "./login-flow";

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

interface FakeUser extends LoginFlowUser {
  forcePasswordChange?: boolean | null;
}

const USER: FakeUser = {
  id: "user-1",
  displayName: "Ada",
  email: "ada@example.com",
  isOwner: false,
  access: { portal: true, studio: true, brain: false, family: false },
  forcePasswordChange: false,
};

interface Recorded {
  sessions: Array<{ userId: string; options: { ipAddress?: string | null } }>;
  cookies: string[];
  audits: Array<LoginAttemptAuditInput<FakeDb>>;
  successAudits: number;
  challenges: number;
  resets: string[];
  rateKeys: string[];
}

function newRecorded(): Recorded {
  return {
    sessions: [],
    cookies: [],
    audits: [],
    successAudits: 0,
    challenges: 0,
    resets: [],
    rateKeys: [],
  };
}

function buildLoginDeps(
  recorded: Recorded,
  overrides: {
    authenticate?: () => Promise<FakeUser | null>;
    isEnabled?: () => Promise<boolean>;
    hasAccess?: (user: FakeUser) => boolean;
    allowed?: boolean;
    turnstileOk?: boolean;
    email?: string | undefined;
    password?: string | undefined;
  } = {},
): PerformLoginFlowDeps<FakeDb, FakeUser> {
  const db = createFakeDb();
  return {
    request: new Request("http://app.test/api/auth/login", { method: "POST" }),
    email: overrides.email ?? "ada@example.com",
    password: overrides.password ?? "secret",
    turnstileToken: "tok",
    surface: "studio",
    serverErrorLogLabel: "test login",
    createDb: () => db,
    createAuthService: () => ({
      authenticate: overrides.authenticate ?? (async () => USER),
      toAuthUser: (user) => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        isOwner: false,
        access: { portal: true, studio: true, brain: false, family: false },
      }),
      createSession: async (userId, options) => {
        recorded.sessions.push({ userId, options });
        return { id: "sess-1", token: "cookie-token" };
      },
      recordSuccessfulLogin: async () => {},
    }),
    createTwoFactorService: () => ({
      isEnabled: overrides.isEnabled ?? (async () => false),
      createLoginChallenge: async () => {
        recorded.challenges += 1;
        return { challengeToken: "chal-1", expiresAt: new Date("2030-01-01T00:00:00.000Z") };
      },
      verifyLoginChallenge: async () => ({ userId: USER.id }),
    }),
    findExistingUser: async () => ({ id: USER.id, status: "active" }),
    hasAccess: (user) => (overrides.hasAccess ? overrides.hasAccess(user as FakeUser) : true),
    clientIpFromHeaders: () => "1.2.3.4",
    loginRateKey: (ip, email) => `studio-login:${ip}:${email}`,
    rateLimitOptions: { maxAttempts: 8, windowMs: 300000 },
    checkRateLimitAsync: async (key) => {
      recorded.rateKeys.push(key);
      return { allowed: overrides.allowed ?? true, retryAfterSeconds: 30 };
    },
    resetRateLimitAsync: async (key) => {
      recorded.resets.push(key);
    },
    verifyTurnstile: async () => ({ success: overrides.turnstileOk ?? true, errorCodes: [] }),
    setSessionCookie: async (token) => {
      recorded.cookies.push(token);
    },
    auditRequestFromHeaders: () => ({ ip: "1.2.3.4", userAgent: null }),
    logLoginAttempt: async (input) => {
      recorded.audits.push(input);
    },
    resolveLoginFailureReason: () => "invalid_credentials",
  };
}

describe("performLoginFlow", () => {
  it("failed auth → audit login attempt, no session, 401", async () => {
    const recorded = newRecorded();
    const res = await performLoginFlow(
      buildLoginDeps(recorded, { authenticate: async () => null }),
    );

    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Ungültige Anmeldedaten." });
    assert.equal(recorded.sessions.length, 0, "no session issued on failure");
    assert.equal(recorded.cookies.length, 0);
    const reasons = recorded.audits.map((a) => ({ reason: a.reason, status: a.httpStatus }));
    assert.deepEqual(reasons, [{ reason: "invalid_credentials", status: 401 }]);
  });

  it("success → session WITH ipAddress, cookie, success audit, 200", async () => {
    const recorded = newRecorded();
    const res = await performLoginFlow(buildLoginDeps(recorded));

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      user: {
        id: "user-1",
        displayName: "Ada",
        email: "ada@example.com",
        isOwner: false,
        access: { portal: true, studio: true, brain: false, family: false },
      },
      forcePasswordChange: false,
    });
    assert.deepEqual(recorded.sessions, [
      { userId: "user-1", options: { ipAddress: "1.2.3.4" } },
    ]);
    assert.deepEqual(recorded.cookies, ["cookie-token"]);
    assert.deepEqual(recorded.resets, ["studio-login:1.2.3.4:ada@example.com"]);
    const success = recorded.audits.at(-1);
    assert.equal(success?.sessionId, "sess-1");
    assert.equal(success?.httpStatus, 200);
    assert.equal(success?.reason, undefined);
  });

  it("2FA required → challenge issued, no session, requiresTwoFactor", async () => {
    const recorded = newRecorded();
    const res = await performLoginFlow(
      buildLoginDeps(recorded, { isEnabled: async () => true }),
    );

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      requiresTwoFactor: true,
      challengeToken: "chal-1",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
    assert.equal(recorded.challenges, 1);
    assert.equal(recorded.sessions.length, 0, "no session before 2FA is completed");
    assert.equal(recorded.cookies.length, 0);
    assert.equal(recorded.audits.at(-1)?.reason, "two_factor_required");
  });

  it("access denied → 401, no session, studioAccessGranted feeds failure reason", async () => {
    const recorded = newRecorded();
    const res = await performLoginFlow(
      buildLoginDeps(recorded, { hasAccess: () => false }),
    );

    assert.equal(res.status, 401);
    assert.equal(recorded.sessions.length, 0);
    assert.equal(recorded.audits.at(-1)?.httpStatus, 401);
  });

  it("missing credentials → 400 before rate limiting", async () => {
    const recorded = newRecorded();
    const res = await performLoginFlow(
      buildLoginDeps(recorded, { email: "", password: "" }),
    );

    assert.equal(res.status, 400);
    assert.equal(recorded.rateKeys.length, 0);
    assert.equal(recorded.audits.at(-1)?.reason, "missing_credentials");
  });

  it("rate limited → 429 with Retry-After, no auth attempt", async () => {
    const recorded = newRecorded();
    const res = await performLoginFlow(buildLoginDeps(recorded, { allowed: false }));

    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "30");
    assert.equal(recorded.sessions.length, 0);
    assert.equal(recorded.audits.at(-1)?.reason, "rate_limited");
  });

  it("turnstile failure → 403, no session", async () => {
    const recorded = newRecorded();
    const res = await performLoginFlow(buildLoginDeps(recorded, { turnstileOk: false }));

    assert.equal(res.status, 403);
    assert.equal(recorded.sessions.length, 0);
    assert.equal(recorded.audits.at(-1)?.reason, "human_verification_failed");
  });
});

function buildCompleteDeps(
  recorded: Recorded,
  overrides: {
    verify?: () => Promise<{ userId: string } | null>;
    findUser?: () => Promise<FakeUser | null>;
    hasAccess?: (user: FakeUser) => boolean;
    allowed?: boolean;
    withSuccessAudit?: boolean;
    responseTarget?: string;
  } = {},
): CompleteTwoFactorLoginDeps<FakeDb, FakeUser> {
  const db = createFakeDb();
  return {
    request: new Request("http://app.test/api/auth/two-factor/verify", { method: "POST" }),
    challengeToken: "challenge-token-value",
    code: "123456",
    responseTarget: overrides.responseTarget,
    rateKeyPrefix: "studio-2fa",
    createDb: () => db,
    createAuthService: () => ({
      toAuthUser: (user) => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        isOwner: false,
        access: { portal: true, studio: true, brain: false, family: false },
      }),
      createSession: async (userId, options) => {
        recorded.sessions.push({ userId, options });
        return { id: "sess-2fa", token: "cookie-2fa" };
      },
      recordSuccessfulLogin: async () => {},
    }),
    createTwoFactorService: () => ({
      isEnabled: async () => true,
      createLoginChallenge: async () => ({
        challengeToken: "x",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      }),
      verifyLoginChallenge: overrides.verify ?? (async () => ({ userId: USER.id })),
    }),
    findUserById: overrides.findUser ?? (async () => USER),
    hasAccess: overrides.hasAccess,
    clientIpFromHeaders: () => "9.9.9.9",
    rateLimitOptions: { maxAttempts: 8, windowMs: 300000 },
    checkRateLimitAsync: async (key) => {
      recorded.rateKeys.push(key);
      return { allowed: overrides.allowed ?? true, retryAfterSeconds: 12 };
    },
    setSessionCookie: async (token) => {
      recorded.cookies.push(token);
    },
    onSuccessAudit: overrides.withSuccessAudit
      ? async () => {
          recorded.successAudits += 1;
        }
      : undefined,
  };
}

describe("completeTwoFactorLogin", () => {
  it("success → session WITH ipAddress, cookie, success audit, 200", async () => {
    const recorded = newRecorded();
    const res = await completeTwoFactorLogin(
      buildCompleteDeps(recorded, { withSuccessAudit: true, responseTarget: "portal" }),
    );

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      user: {
        id: "user-1",
        displayName: "Ada",
        email: "ada@example.com",
        isOwner: false,
        access: { portal: true, studio: true, brain: false, family: false },
      },
      forcePasswordChange: false,
      target: "portal",
    });
    assert.deepEqual(recorded.sessions, [
      { userId: "user-1", options: { ipAddress: "9.9.9.9" } },
    ]);
    assert.deepEqual(recorded.cookies, ["cookie-2fa"]);
    assert.equal(recorded.successAudits, 1);
    assert.deepEqual(recorded.rateKeys, ["studio-2fa:9.9.9.9:challeng"]);
  });

  it("invalid challenge → 401, no session", async () => {
    const recorded = newRecorded();
    const res = await completeTwoFactorLogin(
      buildCompleteDeps(recorded, { verify: async () => null }),
    );

    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Ungültiger oder abgelaufener 2FA-Code." });
    assert.equal(recorded.sessions.length, 0);
    assert.equal(recorded.cookies.length, 0);
  });

  it("access predicate denies → 401, no session", async () => {
    const recorded = newRecorded();
    const res = await completeTwoFactorLogin(
      buildCompleteDeps(recorded, { hasAccess: () => false }),
    );

    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Ungültige Anmeldedaten." });
    assert.equal(recorded.sessions.length, 0);
  });

  it("rate limited → 429 with Retry-After, challenge never verified", async () => {
    const recorded = newRecorded();
    const res = await completeTwoFactorLogin(
      buildCompleteDeps(recorded, { allowed: false }),
    );

    assert.equal(res.status, 429);
    assert.equal(res.headers.get("Retry-After"), "12");
    assert.equal(recorded.sessions.length, 0);
  });
});
