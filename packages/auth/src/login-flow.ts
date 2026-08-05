/**
 * Shared login state machine for the Studio and the Portal.
 *
 * The password-login sequence (rate-limit → Turnstile → authenticate →
 * failure-reason resolution → optional 2FA challenge → createSession + cookie →
 * audit) and the 2FA login-challenge completion (rate-limit → verify challenge →
 * access check → createSession + cookie → audit) were copy-pasted across five
 * HTTP handlers:
 *   - `apps/studio/app/api/auth/login/route.ts`
 *   - `apps/portal/app/api/auth/login/route.ts`
 *   - `apps/landing/app/api/auth/enter/route.ts` (both the password and 2FA steps)
 *   - `apps/{studio,portal}/app/api/auth/two-factor/verify/route.ts`
 * and had DRIFTED (session IP recorded on Portal only; Portal used an inline
 * rate-limit config instead of the shared preset).
 *
 * `@uwe/auth` is the low-level auth package: it must NOT depend on
 * `@uwe/security` (security depends on auth) nor on an app or `@uwe/database`
 * (database depends on `@uwe/auth/server`). Either edge would create an import
 * cycle. Therefore every app/security/data concern — the auth service, the 2FA
 * service, the rate limiter, the Turnstile verifier, the access predicate, the
 * session-cookie writer, the DB handle, and the audit sinks — is INJECTED via
 * the deps objects below. This module owns only the orchestration and stays free
 * of new dependencies.
 */
import type { AuthUser, AuthUserSource } from "./types";

/** A DB handle that can be released after a request's unit of work. */
export interface LoginDbHandle {
  $disconnect(): Promise<void>;
}

/** Audit surfaces (structurally matches `@uwe/database`'s `LoginAuditSurface`). */
export type LoginFlowSurface = "studio" | "portal" | "family";

/**
 * Failure reasons for a login attempt. Each is a member of `@uwe/database`'s
 * `LoginAuditReason`, so its `resolveLoginFailureReason` is directly assignable
 * to {@link PerformLoginFlowDeps.resolveLoginFailureReason} without a cast.
 */
export type LoginFlowFailureReason =
  | "missing_credentials"
  | "rate_limited"
  | "human_verification_failed"
  | "invalid_credentials"
  | "account_inactive"
  | "account_locked"
  | "studio_access_denied"
  | "two_factor_required"
  | "passkey_invalid"
  | "login_method_disabled"
  | "google_oauth_failed"
  | "google_email_unverified"
  | "google_email_unknown"
  | "server_error";

/** Request context for an audit entry (structurally matches `AuditRequestContext`). */
export interface LoginAuditRequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Input for the injected `logLoginAttempt`. Deliberately mirrors
 * `@uwe/database`'s `LogLoginAttemptInput` field-for-field so the real function
 * is directly assignable without importing the database package.
 */
export interface LoginAttemptAuditInput<TDb> {
  db: TDb;
  surface: LoginFlowSurface;
  request: LoginAuditRequestContext;
  email?: string | null;
  actorUserId?: string | null;
  sessionId?: string | null;
  reason?: LoginFlowFailureReason;
  httpStatus?: number;
  errorMessage?: string | null;
  serverError?: unknown;
  extraMetadata?: Record<string, unknown>;
}

/** Input for the injected `resolveLoginFailureReason` (matches the database service). */
export interface ResolveLoginFailureInput {
  surface: LoginFlowSurface;
  email: string;
  userFound: boolean;
  userActive: boolean;
  passwordValid: boolean;
  studioAccessGranted?: boolean;
}

/** Rate-limit options (structurally matches `@uwe/security`'s `RateLimitOptions`). */
export interface LoginRateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

/** Rate-limit decision (structurally matches `@uwe/security`'s `RateLimitResult`). */
export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Turnstile verification result (subset of `@uwe/auth`'s `TurnstileVerifyResult`). */
export interface LoginTurnstileResult {
  success: boolean;
  errorCodes?: string[];
}

/**
 * User shape the flow needs from `authenticate` / `findUserById`. Structurally
 * satisfied by `SafeUser` and by the raw Prisma user record.
 */
export type LoginFlowUser = AuthUserSource & { forcePasswordChange?: boolean | null };

/**
 * The session-issuing subset of the auth domain service, used by both flows.
 * `toAuthUser` is deliberately non-generic (accepts the base {@link LoginFlowUser})
 * so a caller's concrete user type is inferred solely from `authenticate` /
 * `findUserById`. Structurally satisfied by `@uwe/database`'s `AuthService`,
 * injected so `@uwe/auth` never imports the database package (which would cycle).
 */
export interface SessionIssuingAuthPort {
  toAuthUser(user: LoginFlowUser): AuthUser;
  createSession(
    userId: string,
    options: { ipAddress?: string | null },
  ): Promise<{ id: string; token: string }>;
  recordSuccessfulLogin(userId: string): Promise<void>;
}

/** The auth-service subset the password flow calls (adds `authenticate`). */
export interface LoginAuthServicePort<TUser extends LoginFlowUser>
  extends SessionIssuingAuthPort {
  authenticate(email: string, password: string): Promise<TUser | null>;
  /** Count a failed password attempt and lock the account past the threshold. */
  recordFailedLogin(userId: string): Promise<void>;
  /** Clear the failed-attempt counter and any lock after a successful login. */
  resetFailedLogins(userId: string): Promise<void>;
}

/** The subset of the 2FA domain service the flow calls. */
export interface LoginTwoFactorServicePort {
  isEnabled(userId: string): Promise<boolean>;
  createLoginChallenge(userId: string): Promise<{ challengeToken: string; expiresAt: Date }>;
  verifyLoginChallenge(
    challengeToken: string,
    code: string,
  ): Promise<{ userId: string } | null>;
}

/** Minimal existing-user record for failure-reason resolution and lock check. */
export interface ExistingLoginUser {
  id: string;
  status: string;
  /** Account lock expiry (from a previous burst of failed logins), if any. */
  lockedUntil?: Date | null;
}

/** True while the account is under an active lockout window. */
export function isAccountLocked(user: ExistingLoginUser, now: number = Date.now()): boolean {
  return user.lockedUntil != null && user.lockedUntil.getTime() > now;
}

function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
  return Response.json(body, headers ? { status, headers } : { status });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function rateLimitedResponse(message: string, retryAfterSeconds: number): Response {
  return jsonResponse({ error: message }, 429, { "Retry-After": String(retryAfterSeconds) });
}

/** Success body shared by every login method (password, 2FA, passkey, OAuth). */
export function buildAuthSuccessBody(
  authUser: AuthUser,
  forcePasswordChange: boolean | null | undefined,
  responseTarget?: string | undefined,
): Record<string, unknown> {
  return {
    user: authUser,
    forcePasswordChange: forcePasswordChange ?? false,
    ...(responseTarget !== undefined ? { target: responseTarget } : {}),
  };
}

/** Everything needed to issue a session for an already-authenticated user. */
export interface IssueLoginSessionDeps {
  auth: SessionIssuingAuthPort;
  userId: string;
  ip: string;
  setSessionCookie(token: string): Promise<void>;
}

/**
 * The shared tail of every login method (password, 2FA completion, passkey,
 * OAuth): `createSession` → `recordSuccessfulLogin` → session cookie. New
 * login methods call this instead of minting sessions themselves so session-IP
 * recording and cookie writing stay consistent across methods.
 */
export async function issueLoginSession(
  deps: IssueLoginSessionDeps,
): Promise<{ id: string; token: string }> {
  const session = await deps.auth.createSession(deps.userId, { ipAddress: deps.ip });
  await deps.auth.recordSuccessfulLogin(deps.userId);
  await deps.setSessionCookie(session.token);
  return session;
}

/** Everything the password-login flow needs, injected by each route adapter. */
export interface PerformLoginFlowDeps<TDb extends LoginDbHandle, TUser extends LoginFlowUser> {
  /** The incoming request (used for header-derived IP + audit context). */
  request: Request;
  /** Already-trimmed email from the request body (may be empty/undefined). */
  email: string | undefined;
  /** Raw password from the request body. */
  password: string | undefined;
  /** Turnstile token from the request body. */
  turnstileToken: string | null | undefined;
  /** Audit surface for this login (`"studio"`, `"portal"` or `"family"`). */
  surface: LoginFlowSurface;
  /** Optional target echoed back in the success body (the unified enter endpoint). */
  responseTarget?: string;
  /** Label used in the server-error console log: `[uwe] ${label} failed:`. */
  serverErrorLogLabel: string;

  /** Opens a DB handle for a single request (released in `finally`). */
  createDb(): TDb;
  /** Builds the auth domain service over the DB handle. */
  createAuthService(db: TDb): LoginAuthServicePort<TUser>;
  /** Builds the 2FA domain service over the DB handle. */
  createTwoFactorService(db: TDb): LoginTwoFactorServicePort;
  /** Looks up the existing user (id + status) for failure-reason resolution. */
  findExistingUser(db: TDb, normalizedEmail: string): Promise<ExistingLoginUser | null>;

  /** Per-surface access predicate applied to the authenticated user. */
  hasAccess(user: AuthUser): boolean;

  /** Extracts the client IP used to key the rate limiter and record the session. */
  clientIpFromHeaders(headers: Headers): string;
  /** Builds the per-surface rate-limit key from the client IP + normalized email. */
  loginRateKey(ip: string, normalizedEmail: string): string;
  /** Rate-limit options (inject `RATE_LIMIT_PRESETS.login`). */
  rateLimitOptions: LoginRateLimitOptions;
  checkRateLimitAsync(key: string, options: LoginRateLimitOptions): Promise<LoginRateLimitResult>;
  resetRateLimitAsync(key: string): Promise<void>;
  verifyTurnstile(
    token: string | null | undefined,
    options: { remoteIp: string },
  ): Promise<LoginTurnstileResult>;

  /** Writes the session cookie (via `next/headers`) for the issued session. */
  setSessionCookie(token: string): Promise<void>;

  /** Derives the audit request context from the request headers. */
  auditRequestFromHeaders(headers: Headers): LoginAuditRequestContext;
  /** Persists a login-attempt audit entry. */
  logLoginAttempt(input: LoginAttemptAuditInput<TDb>): Promise<void>;
  /** Resolves the audit failure reason for a rejected login. */
  resolveLoginFailureReason(input: ResolveLoginFailureInput): LoginFlowFailureReason;
}

/**
 * Runs the shared password-login state machine and returns the HTTP response.
 * Owns the DB lifecycle (open → `try/catch/finally` → disconnect); the route is
 * a thin adapter that only injects the surface-specific dependencies.
 */
export async function performLoginFlow<
  TDb extends LoginDbHandle,
  TUser extends LoginFlowUser,
>(deps: PerformLoginFlowDeps<TDb, TUser>): Promise<Response> {
  const {
    request,
    email,
    password,
    turnstileToken,
    surface,
    responseTarget,
    serverErrorLogLabel,
    createDb,
    createAuthService,
    createTwoFactorService,
    findExistingUser,
    hasAccess,
    clientIpFromHeaders,
    loginRateKey,
    rateLimitOptions,
    checkRateLimitAsync,
    resetRateLimitAsync,
    verifyTurnstile,
    setSessionCookie,
    auditRequestFromHeaders,
    logLoginAttempt,
    resolveLoginFailureReason,
  } = deps;

  const auditRequest = auditRequestFromHeaders(request.headers);
  const ip = clientIpFromHeaders(request.headers);
  const db = createDb();

  try {
    if (!email || !password) {
      await logLoginAttempt({
        db,
        surface,
        request: auditRequest,
        email,
        reason: "missing_credentials",
        httpStatus: 400,
        errorMessage: "E-Mail und Passwort sind erforderlich.",
      });
      return errorResponse("E-Mail und Passwort sind erforderlich.", 400);
    }

    const normalizedEmail = email.toLowerCase();
    const rateKey = loginRateKey(ip, normalizedEmail);
    const rate = await checkRateLimitAsync(rateKey, rateLimitOptions);
    if (!rate.allowed) {
      await logLoginAttempt({
        db,
        surface,
        request: auditRequest,
        email,
        reason: "rate_limited",
        httpStatus: 429,
        errorMessage: "Zu viele Anmeldeversuche. Bitte warte einen Moment.",
        extraMetadata: { retryAfterSeconds: rate.retryAfterSeconds },
      });
      return rateLimitedResponse(
        "Zu viele Anmeldeversuche. Bitte warte einen Moment.",
        rate.retryAfterSeconds,
      );
    }

    const turnstile = await verifyTurnstile(turnstileToken, { remoteIp: ip });
    if (!turnstile.success) {
      await logLoginAttempt({
        db,
        surface,
        request: auditRequest,
        email,
        reason: "human_verification_failed",
        httpStatus: 403,
        errorMessage: "Bitte bestätige, dass du ein Mensch bist.",
        extraMetadata: { turnstileErrorCodes: turnstile.errorCodes },
      });
      return errorResponse("Bitte bestätige, dass du ein Mensch bist.", 403);
    }

    const auth = createAuthService(db);
    const twoFactor = createTwoFactorService(db);

    const existingUser = await findExistingUser(db, normalizedEmail);

    // Account-level lockout survives IP rotation (unlike the IP rate limit).
    // Neutral 401 so a locked account is not distinguishable from a wrong
    // password, and skip the scrypt work entirely while locked.
    if (existingUser && isAccountLocked(existingUser)) {
      await logLoginAttempt({
        db,
        surface,
        request: auditRequest,
        email: normalizedEmail,
        actorUserId: existingUser.id,
        reason: "account_locked",
        httpStatus: 401,
        errorMessage: "Ungültige Anmeldedaten.",
      });
      return errorResponse("Ungültige Anmeldedaten.", 401);
    }

    const user = await auth.authenticate(email, password);
    const authUser = user ? auth.toAuthUser(user) : null;

    if (!user || !authUser || !hasAccess(authUser)) {
      const reason = resolveLoginFailureReason({
        surface,
        email: normalizedEmail,
        userFound: Boolean(existingUser),
        userActive: existingUser?.status === "active",
        passwordValid: Boolean(user),
        studioAccessGranted:
          surface === "studio" ? (authUser ? hasAccess(authUser) : false) : undefined,
      });

      await logLoginAttempt({
        db,
        surface,
        request: auditRequest,
        email: normalizedEmail,
        actorUserId: existingUser?.id ?? null,
        reason,
        httpStatus: 401,
        errorMessage: "Ungültige Anmeldedaten.",
      });

      // Count only genuine password failures (existing account, wrong secret) —
      // a valid password on the wrong surface must not lock the account out.
      if (existingUser && !user) {
        await auth.recordFailedLogin(existingUser.id);
      }

      return errorResponse("Ungültige Anmeldedaten.", 401);
    }

    await resetRateLimitAsync(rateKey);
    await auth.resetFailedLogins(user.id);

    if (await twoFactor.isEnabled(user.id)) {
      const challenge = await twoFactor.createLoginChallenge(user.id);
      await logLoginAttempt({
        db,
        surface,
        request: auditRequest,
        email: user.email,
        actorUserId: user.id,
        reason: "two_factor_required",
        httpStatus: 200,
        extraMetadata: { challengeExpiresAt: challenge.expiresAt.toISOString() },
      });

      return jsonResponse(
        {
          requiresTwoFactor: true,
          challengeToken: challenge.challengeToken,
          expiresAt: challenge.expiresAt.toISOString(),
        },
        200,
      );
    }

    const session = await issueLoginSession({ auth, userId: user.id, ip, setSessionCookie });

    await logLoginAttempt({
      db,
      surface,
      request: auditRequest,
      email: user.email,
      actorUserId: user.id,
      sessionId: session.id,
      httpStatus: 200,
    });

    return jsonResponse(
      buildAuthSuccessBody(authUser, user.forcePasswordChange, responseTarget),
      200,
    );
  } catch (error) {
    await logLoginAttempt({
      db,
      surface,
      request: auditRequest,
      email,
      reason: "server_error",
      httpStatus: 500,
      errorMessage: "Anmeldung vorübergehend nicht möglich.",
      serverError: error,
    });

    console.error(`[uwe] ${serverErrorLogLabel} failed:`, error);
    return errorResponse("Anmeldung vorübergehend nicht möglich.", 500);
  } finally {
    await db.$disconnect();
  }
}

/** Context passed to the optional success-audit sink of the 2FA completion. */
export interface TwoFactorSuccessContext<TDb, TUser> {
  db: TDb;
  user: TUser;
  session: { id: string; token: string };
  ip: string;
}

/** Everything the 2FA login-challenge completion needs, injected by each route. */
export interface CompleteTwoFactorLoginDeps<
  TDb extends LoginDbHandle,
  TUser extends LoginFlowUser,
> {
  /** The incoming request (used for header-derived IP). */
  request: Request;
  /** Already-trimmed challenge token from the request body. */
  challengeToken: string;
  /** Already-trimmed 2FA code from the request body. */
  code: string;
  /** Optional target echoed back in the success body (the unified enter endpoint). */
  responseTarget?: string;
  /** Rate-limit key prefix, e.g. `"studio-2fa"`, `"portal-2fa"`, `"enter-2fa"`. */
  rateKeyPrefix: string;

  /** Opens a DB handle for a single request (released in `finally`). */
  createDb(): TDb;
  /** Builds the auth domain service over the DB handle. */
  createAuthService(db: TDb): SessionIssuingAuthPort;
  /** Builds the 2FA domain service over the DB handle. */
  createTwoFactorService(db: TDb): LoginTwoFactorServicePort;
  /** Resolves the user for the verified challenge, or `null`. */
  findUserById(db: TDb, userId: string): Promise<TUser | null>;

  /**
   * Per-surface access predicate. Omit for surfaces that accept any active user
   * (the Portal), pass `canAccessStudio` / `hasTargetAccess` otherwise.
   */
  hasAccess?(user: AuthUser): boolean;

  /** Extracts the client IP used to key the rate limiter and record the session. */
  clientIpFromHeaders(headers: Headers): string;
  /** Rate-limit options (inject `RATE_LIMIT_PRESETS.login`). */
  rateLimitOptions: LoginRateLimitOptions;
  checkRateLimitAsync(key: string, options: LoginRateLimitOptions): Promise<LoginRateLimitResult>;

  /** Writes the session cookie (via `next/headers`) for the issued session. */
  setSessionCookie(token: string): Promise<void>;

  /** Optional success-audit sink (login-attempt on enter, login_success on Portal). */
  onSuccessAudit?(ctx: TwoFactorSuccessContext<TDb, TUser>): Promise<void>;
  /**
   * Optional server-error handler. When provided, thrown errors are caught,
   * passed here, and its response returned (the unified enter endpoint). When
   * omitted, errors propagate after the DB is disconnected (the verify routes).
   */
  handleServerError?(db: TDb, error: unknown): Promise<Response>;
}

/**
 * Runs the shared 2FA login-challenge completion (rate-limit → verify challenge
 * → access check → createSession + cookie → audit) and returns the HTTP
 * response. Owns the DB lifecycle. The missing-field 400 check stays in the
 * route adapters (it precedes rate-limiting and varies by caller).
 */
export async function completeTwoFactorLogin<
  TDb extends LoginDbHandle,
  TUser extends LoginFlowUser,
>(deps: CompleteTwoFactorLoginDeps<TDb, TUser>): Promise<Response> {
  const {
    request,
    challengeToken,
    code,
    responseTarget,
    rateKeyPrefix,
    createDb,
    createAuthService,
    createTwoFactorService,
    findUserById,
    hasAccess,
    clientIpFromHeaders,
    rateLimitOptions,
    checkRateLimitAsync,
    setSessionCookie,
    onSuccessAudit,
    handleServerError,
  } = deps;

  const ip = clientIpFromHeaders(request.headers);
  // Key on the IP, not the challenge token. Keying on the token gave every fresh
  // challenge a new attempt budget, so an attacker who knew the password could
  // loop "password login → new challenge → 8 TOTP guesses" without ever
  // saturating the limiter. The per-challenge attemptCount burn (5) bounds a
  // single challenge; this IP bucket bounds the total across challenges.
  const rateKey = `${rateKeyPrefix}:${ip}`;
  const rate = await checkRateLimitAsync(rateKey, rateLimitOptions);
  if (!rate.allowed) {
    return rateLimitedResponse(
      "Zu viele Versuche. Bitte warte einen Moment.",
      rate.retryAfterSeconds,
    );
  }

  const db = createDb();

  const runCore = async (): Promise<Response> => {
    const twoFactor = createTwoFactorService(db);
    const verified = await twoFactor.verifyLoginChallenge(challengeToken, code);
    if (!verified) {
      return errorResponse("Ungültiger oder abgelaufener 2FA-Code.", 401);
    }

    const user = await findUserById(db, verified.userId);
    const auth = createAuthService(db);
    if (!user || (hasAccess ? !hasAccess(auth.toAuthUser(user)) : false)) {
      return errorResponse("Ungültige Anmeldedaten.", 401);
    }

    const session = await issueLoginSession({ auth, userId: user.id, ip, setSessionCookie });

    if (onSuccessAudit) {
      await onSuccessAudit({ db, user, session, ip });
    }

    return jsonResponse(
      buildAuthSuccessBody(auth.toAuthUser(user), user.forcePasswordChange, responseTarget),
      200,
    );
  };

  try {
    return await runCore();
  } catch (error) {
    if (handleServerError) {
      return await handleServerError(db, error);
    }
    throw error;
  } finally {
    await db.$disconnect();
  }
}
