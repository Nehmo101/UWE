import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createGoogleLoginRouteHandlers,
  type GoogleIdentityUserPort,
  type GoogleLoginRouteDeps,
  type GoogleRedirectCookie,
  type OAuthAuditEvent,
} from "./google-login-routes";
import { encodeGoogleState, hashGoogleStateCookieValue } from "./google-oidc";
import type { LoginAttemptAuditInput } from "./login-flow";

interface FakeDb {
  $disconnect(): Promise<void>;
}

const CLIENT_ID = "client-123.apps.googleusercontent.com";
const STATE_COOKIE = "uwe_google_oauth_state_test";

function buildIdToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256" })}.${encode(claims)}.sig`;
}

function googleClaims(nonce: string, overrides: Record<string, unknown> = {}) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-sub-1",
    email: "dm@uwe.local",
    email_verified: true,
    iat: nowSeconds - 10,
    exp: nowSeconds + 3600,
    nonce,
    ...overrides,
  };
}

function activeUser(overrides: Partial<GoogleIdentityUserPort> = {}): GoogleIdentityUserPort {
  return {
    id: "user-1",
    displayName: "Test-DM",
    email: "dm@uwe.local",
    isOwner: false,
    access: { portal: true, studio: true, brain: false, family: false },
    status: "active",
    forcePasswordChange: false,
    ...overrides,
  };
}

interface Harness {
  deps: GoogleLoginRouteDeps<FakeDb>;
  loginAudits: Array<LoginAttemptAuditInput<FakeDb>>;
  auditEvents: OAuthAuditEvent[];
  linked: Array<{ userId: string; providerUserId: string }>;
  cookies: string[];
  identityByProvider: Map<string, { userId: string; user: GoogleIdentityUserPort }>;
  usersByEmail: Map<string, GoogleIdentityUserPort>;
  linkConflict: boolean;
  twoFactorEnabled: boolean;
  sessionUserId: string | null;
}

function buildHarness(overrides: Partial<GoogleLoginRouteDeps<FakeDb>> = {}): Harness {
  const harness: Harness = {
    deps: undefined as unknown as GoogleLoginRouteDeps<FakeDb>,
    loginAudits: [],
    auditEvents: [],
    linked: [],
    cookies: [],
    identityByProvider: new Map(),
    usersByEmail: new Map(),
    linkConflict: false,
    twoFactorEnabled: false,
    sessionUserId: null,
  };

  harness.deps = {
    createDb: () => ({ $disconnect: async () => {} }),
    getGoogleConfig: async () => ({ clientId: CLIENT_ID, clientSecret: "secret" }),
    resolveRedirectUri: () => "https://studio.uwe.example/api/auth/google/callback",
    resolveLoginUrl: (target) =>
      target === "portal" ? "https://portal.uwe.example/login" : "/login",
    resolveSessionUrl: (target) =>
      target === "portal" ? "https://portal.uwe.example/auth/worlds" : "/today",
    resolveSecurityUrl: () => "/account/security",
    identityService: () => ({
      findByProvider: async (_provider, providerUserId) =>
        harness.identityByProvider.get(providerUserId) ?? null,
      findActiveUserByVerifiedEmail: async (email) =>
        harness.usersByEmail.get(email.toLowerCase()) ?? null,
      linkIdentity: async (input) => {
        if (harness.linkConflict) {
          return { conflict: true };
        }
        harness.linked.push({ userId: input.userId, providerUserId: input.providerUserId });
        return { conflict: false };
      },
    }),
    createAuthService: () => ({
      toAuthUser: (user) => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        isOwner: user.isOwner,
        access: user.access ?? { portal: false, studio: false, brain: false, family: false },
      }),
      createSession: async () => ({ id: "session-1", token: "session-token" }),
      recordSuccessfulLogin: async () => {},
    }),
    createTwoFactorService: () => ({
      isEnabled: async () => harness.twoFactorEnabled,
      createLoginChallenge: async () => ({
        challengeToken: "challenge-token",
        expiresAt: new Date(Date.now() + 60_000),
      }),
      verifyLoginChallenge: async () => null,
    }),
    getSessionUserId: async () => harness.sessionUserId,
    hasTargetAccess: (target, user) =>
      target === "portal" ? true : user.access?.studio === true,
    clientIpFromHeaders: () => "203.0.113.9",
    checkRateLimitAsync: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    rateLimitOptions: { maxAttempts: 10, windowMs: 60_000 },
    setSessionCookie: async (token) => {
      harness.cookies.push(token);
    },
    buildRedirect: (url: string, cookies?: GoogleRedirectCookie[]) => {
      const response = new Response(null, { status: 302, headers: { location: url } });
      for (const cookie of cookies ?? []) {
        response.headers.append(
          "x-test-cookie",
          `${cookie.name}=${cookie.clear ? "" : cookie.value}`,
        );
      }
      return response;
    },
    readStateCookie: async (request) => request.headers.get("x-state-cookie"),
    auditRequestFromHeaders: () => ({ ip: "203.0.113.9", userAgent: "test" }),
    logLoginAttempt: async (input) => {
      harness.loginAudits.push(input);
    },
    logAuditEvent: async (_db, event) => {
      harness.auditEvents.push(event);
    },
    fetchImpl: (async () =>
      Response.json({ id_token: buildIdToken(googleClaims("nonce-1")) })) as typeof fetch,
    stateCookieName: STATE_COOKIE,
    ...overrides,
  };

  return harness;
}

function callbackRequest(
  options: {
    target?: "studio" | "portal";
    intent?: "login" | "link";
    nonce?: string;
    code?: string | null;
    error?: string;
    stateCookie?: string | null;
  } = {},
): Request {
  const nonce = options.nonce ?? "nonce-1";
  const state = encodeGoogleState({
    target: options.target ?? "studio",
    intent: options.intent ?? "login",
    nonce,
  });
  const url = new URL("https://studio.uwe.example/api/auth/google/callback");
  url.searchParams.set("state", state);
  if (options.code !== null) {
    url.searchParams.set("code", options.code ?? "auth-code");
  }
  if (options.error) {
    url.searchParams.set("error", options.error);
  }
  const headers = new Headers();
  const cookie =
    options.stateCookie === undefined ? hashGoogleStateCookieValue(nonce) : options.stateCookie;
  if (cookie) {
    headers.set("x-state-cookie", cookie);
  }
  return new Request(url, { headers });
}

describe("google start", () => {
  it("redirects to Google with a state cookie when enabled", async () => {
    const harness = buildHarness();
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleStart(
      new Request("https://studio.uwe.example/api/auth/google/start?target=portal"),
    );
    assert.equal(response.status, 302);
    const location = response.headers.get("location") ?? "";
    assert.ok(location.startsWith("https://accounts.google.com/"));
    assert.ok(response.headers.get("x-test-cookie")?.startsWith(`${STATE_COOKIE}=`));
  });

  it("redirects to the login page when the method is disabled", async () => {
    const harness = buildHarness({ getGoogleConfig: async () => null });
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleStart(
      new Request("https://studio.uwe.example/api/auth/google/start"),
    );
    assert.equal(response.headers.get("location"), "/login?error=google_disabled");
  });
});

describe("google callback login", () => {
  it("signs in a user with an existing identity", async () => {
    const harness = buildHarness();
    harness.identityByProvider.set("google-sub-1", { userId: "user-1", user: activeUser() });
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest());
    assert.equal(response.headers.get("location"), "/today");
    assert.deepEqual(harness.cookies, ["session-token"]);
    assert.ok(harness.loginAudits.some((entry) => entry.sessionId === "session-1"));
  });

  it("auto-links a verified e-mail to an existing active user", async () => {
    const harness = buildHarness();
    harness.usersByEmail.set("dm@uwe.local", activeUser());
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest());
    assert.equal(response.headers.get("location"), "/today");
    assert.deepEqual(harness.linked, [{ userId: "user-1", providerUserId: "google-sub-1" }]);
    assert.ok(
      harness.auditEvents.some(
        (event) => event.action === "oauth_linked" && event.metadata?.auto === true,
      ),
    );
  });

  it("rejects unknown e-mails without creating an account", async () => {
    const harness = buildHarness();
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest());
    assert.equal(response.headers.get("location"), "/login?error=google_unknown");
    assert.equal(harness.linked.length, 0);
    assert.equal(harness.cookies.length, 0);
    assert.ok(harness.loginAudits.some((entry) => entry.reason === "google_email_unknown"));
  });

  it("rejects unverified e-mails with the same generic error", async () => {
    const harness = buildHarness({
      fetchImpl: (async () =>
        Response.json({
          id_token: buildIdToken(googleClaims("nonce-1", { email_verified: false })),
        })) as typeof fetch,
    });
    harness.usersByEmail.set("dm@uwe.local", activeUser());
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest());
    assert.equal(response.headers.get("location"), "/login?error=google_unknown");
    assert.ok(harness.loginAudits.some((entry) => entry.reason === "google_email_unverified"));
  });

  it("hides disabled accounts behind the generic error", async () => {
    const harness = buildHarness();
    harness.identityByProvider.set("google-sub-1", {
      userId: "user-1",
      user: activeUser({ status: "disabled" }),
    });
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest());
    assert.equal(response.headers.get("location"), "/login?error=google_unknown");
    assert.ok(harness.loginAudits.some((entry) => entry.reason === "account_inactive"));
    assert.equal(harness.cookies.length, 0);
  });

  it("denies studio targets to users without studio access", async () => {
    const harness = buildHarness();
    harness.identityByProvider.set("google-sub-1", {
      userId: "user-1",
      user: activeUser({ access: { portal: true, studio: false, brain: false, family: false } }),
    });
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest());
    assert.equal(response.headers.get("location"), "/login?error=google_no_access");
    assert.ok(harness.loginAudits.some((entry) => entry.reason === "studio_access_denied"));
  });

  it("rejects a state/cookie mismatch before touching Google", async () => {
    const harness = buildHarness();
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(
      callbackRequest({ stateCookie: "wrong-hash" }),
    );
    assert.equal(response.headers.get("location"), "/login?error=google_failed");
    assert.ok(harness.loginAudits.some((entry) => entry.reason === "google_oauth_failed"));
  });

  it("hands off to 2FA via the URL fragment instead of issuing a session", async () => {
    const harness = buildHarness();
    harness.twoFactorEnabled = true;
    harness.identityByProvider.set("google-sub-1", { userId: "user-1", user: activeUser() });
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest());
    assert.equal(response.headers.get("location"), "/login#googleChallenge=challenge-token");
    assert.equal(harness.cookies.length, 0);
    assert.ok(harness.loginAudits.some((entry) => entry.reason === "two_factor_required"));
  });

  it("routes portal targets to the portal session URL", async () => {
    const harness = buildHarness();
    harness.identityByProvider.set("google-sub-1", {
      userId: "user-1",
      user: activeUser({ access: { portal: true, studio: false, brain: false, family: false } }),
    });
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest({ target: "portal" }));
    assert.equal(response.headers.get("location"), "https://portal.uwe.example/auth/worlds");
  });
});

describe("google callback link intent", () => {
  it("links the google identity to the session user", async () => {
    const harness = buildHarness();
    harness.sessionUserId = "user-9";
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest({ intent: "link" }));
    assert.equal(response.headers.get("location"), "/account/security?linked=google");
    assert.deepEqual(harness.linked, [{ userId: "user-9", providerUserId: "google-sub-1" }]);
    assert.ok(harness.auditEvents.some((event) => event.action === "oauth_linked"));
  });

  it("reports a conflict when the identity belongs to another user", async () => {
    const harness = buildHarness();
    harness.sessionUserId = "user-9";
    harness.linkConflict = true;
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest({ intent: "link" }));
    assert.equal(
      response.headers.get("location"),
      "/account/security?error=google_link_conflict",
    );
  });

  it("rejects link callbacks without a session", async () => {
    const harness = buildHarness();
    const handlers = createGoogleLoginRouteHandlers(harness.deps);

    const response = await handlers.handleGoogleCallback(callbackRequest({ intent: "link" }));
    assert.equal(response.headers.get("location"), "/login?error=google_failed");
    assert.equal(harness.linked.length, 0);
  });
});
