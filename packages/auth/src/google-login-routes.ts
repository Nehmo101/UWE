/**
 * Shared "Mit Google anmelden" route orchestration (start + callback), in the
 * established DI style of `login-flow.ts` / `two-factor-routes.ts`: this
 * module owns the flow — state/nonce handling, code exchange, claim
 * validation, the invite-only account policy, 2FA handoff, session issuing,
 * audit — while every app/data concern is injected via
 * {@link GoogleLoginRouteDeps}. Server-only (exported via `@uwe/auth/server`).
 *
 * Account policy (deliberate, UWE stays invite-only):
 *   1. A stored `AuthIdentity` for the Google `sub` wins.
 *   2. Otherwise a VERIFIED Google e-mail matching an existing ACTIVE user
 *      auto-links on first login.
 *   3. Anything else fails with a generic error — Google login never creates
 *      accounts, and unknown vs. disabled is not disclosed to the browser.
 *
 * Google login does NOT bypass TOTP: when 2FA is enabled the callback creates
 * a login challenge and hands its token to the target login page via the URL
 * FRAGMENT (`#googleChallenge=…`) — fragments never reach server logs and
 * work across origins in every deployment model; the token is single-use,
 * short-lived, and useless without the TOTP code.
 */
import type { AuthUser } from "./types";
import {
  buildGoogleAuthUrl,
  encodeGoogleState,
  exchangeGoogleCode,
  generateGoogleNonce,
  GOOGLE_IDENTITY_PROVIDER,
  hashGoogleStateCookieValue,
  validateGoogleIdToken,
  verifyGoogleOAuthState,
  type GoogleLoginIntent,
  type GoogleLoginTarget,
} from "./google-oidc";
import {
  issueLoginSession,
  type LoginAttemptAuditInput,
  type LoginAuditRequestContext,
  type LoginDbHandle,
  type LoginFlowFailureReason,
  type LoginRateLimitOptions,
  type LoginRateLimitResult,
  type LoginTwoFactorServicePort,
  type SessionIssuingAuthPort,
} from "./login-flow";

/** Effective Google OAuth client config (from DB settings; null = disabled). */
export interface GoogleOAuthConfigPort {
  clientId: string;
  clientSecret: string;
}

/** User shape the flow needs from the identity lookups. */
export interface GoogleIdentityUserPort {
  id: string;
  displayName: string;
  email: string | null;
  role: AuthUser["role"];
  status: "invited" | "active" | "disabled";
  forcePasswordChange: boolean;
}

/** Identity persistence subset (satisfied by `AuthIdentityService`). */
export interface GoogleIdentityPort {
  findByProvider(
    provider: string,
    providerUserId: string,
  ): Promise<{ userId: string; user: GoogleIdentityUserPort } | null>;
  findActiveUserByVerifiedEmail(email: string): Promise<GoogleIdentityUserPort | null>;
  linkIdentity(input: {
    userId: string;
    provider: string;
    providerUserId: string;
    email?: string | null;
  }): Promise<{ conflict: boolean }>;
}

/** OAuth audit event (assignable to `logAuditEvent`'s input). */
export interface OAuthAuditEvent {
  actorUserId: string;
  action: "oauth_linked" | "oauth_unlinked";
  targetType: "user";
  targetId: string;
  request: LoginAuditRequestContext;
  metadata?: Record<string, unknown>;
}

/** A cookie instruction attached to a redirect response. */
export interface GoogleRedirectCookie {
  name: string;
  value: string;
  /** True clears the cookie (maxAge 0). */
  clear?: boolean;
}

/** Error codes surfaced to the login page as `?error=` (mapped to copy there). */
export type GoogleLoginErrorCode =
  | "google_disabled"
  | "google_cancelled"
  | "google_failed"
  | "google_unknown"
  | "google_no_access"
  | "google_link_conflict";

export interface GoogleLoginRouteDeps<TDb extends LoginDbHandle> {
  createDb(): TDb;
  /** Effective config from the DB settings — `null` means the method is off. */
  getGoogleConfig(db: TDb): Promise<GoogleOAuthConfigPort | null>;
  /** Absolute redirect URI registered in the Google console (Studio origin). */
  resolveRedirectUri(request: Request): string;
  /** Absolute/relative URL of a target's login page (for error redirects). */
  resolveLoginUrl(target: GoogleLoginTarget): string;
  /** Post-login destination for a target (session entry). */
  resolveSessionUrl(target: GoogleLoginTarget): string;
  /** Account-security page URL (link-intent return). */
  resolveSecurityUrl(target: GoogleLoginTarget): string;
  identityService(db: TDb): GoogleIdentityPort;
  createAuthService(db: TDb): SessionIssuingAuthPort;
  createTwoFactorService(db: TDb): LoginTwoFactorServicePort;
  /** Session user id from the request cookie (link intent), or `null`. */
  getSessionUserId(request: Request): Promise<string | null>;
  /** Per-target access predicate (Portal accepts any active user). */
  hasTargetAccess(target: GoogleLoginTarget, user: AuthUser): boolean;
  clientIpFromHeaders(headers: Headers): string;
  checkRateLimitAsync(
    key: string,
    options: LoginRateLimitOptions,
  ): Promise<LoginRateLimitResult>;
  rateLimitOptions: LoginRateLimitOptions;
  setSessionCookie(token: string, request: Request): Promise<void>;
  /** Builds a redirect response, attaching/clearing the given cookies. */
  buildRedirect(url: string, cookies?: GoogleRedirectCookie[]): Response;
  /** Reads the OAuth state cookie value from the request, or `null`. */
  readStateCookie(request: Request): Promise<string | null>;
  auditRequestFromHeaders(headers: Headers): LoginAuditRequestContext;
  logLoginAttempt(input: LoginAttemptAuditInput<TDb>): Promise<void>;
  logAuditEvent(db: TDb, event: OAuthAuditEvent): Promise<void>;
  /** Override for tests; defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Cookie name override for tests. */
  stateCookieName: string;
}

export interface GoogleLoginRouteHandlers {
  handleGoogleStart(request: Request): Promise<Response>;
  handleGoogleCallback(request: Request): Promise<Response>;
}

function parseTarget(value: string | null): GoogleLoginTarget {
  return value === "portal" ? "portal" : "studio";
}

function withQueryParam(url: string, key: string, value: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export function createGoogleLoginRouteHandlers<TDb extends LoginDbHandle>(
  deps: GoogleLoginRouteDeps<TDb>,
): GoogleLoginRouteHandlers {
  const {
    createDb,
    getGoogleConfig,
    resolveRedirectUri,
    resolveLoginUrl,
    resolveSessionUrl,
    resolveSecurityUrl,
    identityService,
    createAuthService,
    createTwoFactorService,
    getSessionUserId,
    hasTargetAccess,
    clientIpFromHeaders,
    checkRateLimitAsync,
    rateLimitOptions,
    setSessionCookie,
    buildRedirect,
    readStateCookie,
    auditRequestFromHeaders,
    logLoginAttempt,
    logAuditEvent,
    stateCookieName,
  } = deps;

  const clearStateCookie: GoogleRedirectCookie = { name: stateCookieName, value: "", clear: true };

  function loginErrorRedirect(target: GoogleLoginTarget, code: GoogleLoginErrorCode): Response {
    return buildRedirect(withQueryParam(resolveLoginUrl(target), "error", code), [
      clearStateCookie,
    ]);
  }

  async function handleGoogleStart(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const target = parseTarget(url.searchParams.get("target"));
    const intent: GoogleLoginIntent = url.searchParams.get("intent") === "link" ? "link" : "login";

    const db = createDb();
    try {
      const config = await getGoogleConfig(db);
      if (!config) {
        return loginErrorRedirect(target, "google_disabled");
      }

      if (intent === "link" && !(await getSessionUserId(request))) {
        return loginErrorRedirect(target, "google_failed");
      }

      const nonce = generateGoogleNonce();
      const authUrl = buildGoogleAuthUrl({
        clientId: config.clientId,
        redirectUri: resolveRedirectUri(request),
        state: encodeGoogleState({ target, intent, nonce }),
        nonce,
      });

      return buildRedirect(authUrl, [
        { name: stateCookieName, value: hashGoogleStateCookieValue(nonce) },
      ]);
    } finally {
      await db.$disconnect();
    }
  }

  async function handleGoogleCallback(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const auditRequest = auditRequestFromHeaders(request.headers);
    const ip = clientIpFromHeaders(request.headers);
    const db = createDb();

    // Target for error redirects; refined once the state is verified.
    let target: GoogleLoginTarget = "studio";

    try {
      const failLogin = async (
        reason: LoginFlowFailureReason,
        code: GoogleLoginErrorCode,
        details: {
          email?: string | null;
          actorUserId?: string | null;
          extraMetadata?: Record<string, unknown>;
        } = {},
      ): Promise<Response> => {
        await logLoginAttempt({
          db,
          surface: target,
          request: auditRequest,
          email: details.email,
          actorUserId: details.actorUserId ?? null,
          reason,
          httpStatus: 302,
          errorMessage: `Google-Anmeldung abgelehnt (${code}).`,
          extraMetadata: { method: "google", ...(details.extraMetadata ?? {}) },
        });
        return loginErrorRedirect(target, code);
      };

      const rate = await checkRateLimitAsync(`google-callback:${ip}`, rateLimitOptions);
      if (!rate.allowed) {
        return failLogin("rate_limited", "google_failed", {
          extraMetadata: { retryAfterSeconds: rate.retryAfterSeconds },
        });
      }

      const stateResult = verifyGoogleOAuthState(
        url.searchParams.get("state"),
        await readStateCookie(request),
      );
      if (!stateResult.ok) {
        return failLogin("google_oauth_failed", "google_failed", {
          extraMetadata: { stage: "state", detail: stateResult.reason },
        });
      }
      target = stateResult.state.target;
      const intent = stateResult.state.intent;

      const config = await getGoogleConfig(db);
      if (!config) {
        return failLogin("login_method_disabled", "google_disabled");
      }

      const oauthError = url.searchParams.get("error");
      if (oauthError) {
        return failLogin(
          "google_oauth_failed",
          oauthError === "access_denied" ? "google_cancelled" : "google_failed",
          { extraMetadata: { stage: "provider_error", detail: oauthError } },
        );
      }

      const code = url.searchParams.get("code");
      if (!code) {
        return failLogin("google_oauth_failed", "google_failed", {
          extraMetadata: { stage: "missing_code" },
        });
      }

      const exchange = await exchangeGoogleCode({
        code,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: resolveRedirectUri(request),
        fetchImpl: deps.fetchImpl,
      });
      if (!exchange.ok) {
        return failLogin("google_oauth_failed", "google_failed", {
          extraMetadata: { stage: "token_exchange", detail: exchange.error },
        });
      }

      const validated = validateGoogleIdToken(exchange.idToken, {
        clientId: config.clientId,
        expectedNonce: stateResult.state.nonce,
      });
      if (!validated.ok) {
        return failLogin("google_oauth_failed", "google_failed", {
          extraMetadata: { stage: "id_token", detail: validated.reason },
        });
      }
      const identity = validated.identity;
      const identities = identityService(db);

      // ── Explicit account linking from the security page ──
      if (intent === "link") {
        const sessionUserId = await getSessionUserId(request);
        if (!sessionUserId) {
          return failLogin("google_oauth_failed", "google_failed", {
            extraMetadata: { stage: "link_without_session" },
          });
        }

        const linked = await identities.linkIdentity({
          userId: sessionUserId,
          provider: GOOGLE_IDENTITY_PROVIDER,
          providerUserId: identity.sub,
          email: identity.email,
        });
        if (linked.conflict) {
          return buildRedirect(
            withQueryParam(resolveSecurityUrl(target), "error", "google_link_conflict"),
            [clearStateCookie],
          );
        }

        await logAuditEvent(db, {
          actorUserId: sessionUserId,
          action: "oauth_linked",
          targetType: "user",
          targetId: sessionUserId,
          request: auditRequest,
          metadata: { provider: GOOGLE_IDENTITY_PROVIDER },
        });

        return buildRedirect(
          withQueryParam(resolveSecurityUrl(target), "linked", "google"),
          [clearStateCookie],
        );
      }

      // ── Login: existing identity, else verified-e-mail auto-link ──
      let user: GoogleIdentityUserPort | null = null;
      const existingIdentity = await identities.findByProvider(
        GOOGLE_IDENTITY_PROVIDER,
        identity.sub,
      );
      if (existingIdentity) {
        user = existingIdentity.user;
      } else if (!identity.email) {
        return failLogin("google_email_unknown", "google_unknown", {
          extraMetadata: { stage: "no_email" },
        });
      } else if (!identity.emailVerified) {
        return failLogin("google_email_unverified", "google_unknown", {
          email: identity.email,
        });
      } else {
        const matched = await identities.findActiveUserByVerifiedEmail(identity.email);
        if (!matched) {
          // Unknown and disabled accounts get the same generic error — the
          // browser must not learn which accounts exist.
          return failLogin("google_email_unknown", "google_unknown", {
            email: identity.email,
          });
        }
        const autoLinked = await identities.linkIdentity({
          userId: matched.id,
          provider: GOOGLE_IDENTITY_PROVIDER,
          providerUserId: identity.sub,
          email: identity.email,
        });
        if (autoLinked.conflict) {
          return failLogin("google_oauth_failed", "google_failed", {
            email: identity.email,
            extraMetadata: { stage: "auto_link_conflict" },
          });
        }
        await logAuditEvent(db, {
          actorUserId: matched.id,
          action: "oauth_linked",
          targetType: "user",
          targetId: matched.id,
          request: auditRequest,
          metadata: { provider: GOOGLE_IDENTITY_PROVIDER, auto: true },
        });
        user = matched;
      }

      if (user.status !== "active") {
        return failLogin("account_inactive", "google_unknown", {
          email: user.email,
          actorUserId: user.id,
        });
      }

      const auth = createAuthService(db);
      const authUser = auth.toAuthUser(user);
      if (!hasTargetAccess(target, authUser)) {
        return failLogin("studio_access_denied", "google_no_access", {
          email: user.email,
          actorUserId: user.id,
        });
      }

      // ── 2FA stays in force for Google logins ──
      const twoFactor = createTwoFactorService(db);
      if (await twoFactor.isEnabled(user.id)) {
        const challenge = await twoFactor.createLoginChallenge(user.id);
        await logLoginAttempt({
          db,
          surface: target,
          request: auditRequest,
          email: user.email,
          actorUserId: user.id,
          reason: "two_factor_required",
          httpStatus: 302,
          extraMetadata: { method: "google" },
        });
        return buildRedirect(
          `${resolveLoginUrl(target)}#googleChallenge=${encodeURIComponent(challenge.challengeToken)}`,
          [clearStateCookie],
        );
      }

      const session = await issueLoginSession({
        auth,
        userId: user.id,
        ip,
        setSessionCookie: (token) => setSessionCookie(token, request),
      });

      await logLoginAttempt({
        db,
        surface: target,
        request: auditRequest,
        email: user.email,
        actorUserId: user.id,
        sessionId: session.id,
        httpStatus: 302,
        extraMetadata: { method: "google" },
      });

      return buildRedirect(resolveSessionUrl(target), [clearStateCookie]);
    } catch (error) {
      await logLoginAttempt({
        db,
        surface: target,
        request: auditRequest,
        reason: "server_error",
        httpStatus: 302,
        errorMessage: "Google-Anmeldung vorübergehend nicht möglich.",
        serverError: error,
        extraMetadata: { method: "google" },
      });
      console.error("[uwe] google login failed:", error);
      return loginErrorRedirect(target, "google_failed");
    } finally {
      await db.$disconnect();
    }
  }

  return { handleGoogleStart, handleGoogleCallback };
}
