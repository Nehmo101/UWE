/**
 * Shared 2FA route orchestration for the Studio and the Portal.
 *
 * Both apps exposed an identical set of 2FA status/setup/activate/disable HTTP
 * handlers whose *only* differences were the auth guard, the error-response
 * shape helper, and the rate-limit key prefix. The security-sensitive core —
 * code validation, rate limiting, TOTP secret activation, challenge handling,
 * and audit logging — was copy-pasted between the two surfaces, which is a
 * drift hazard for auth code.
 *
 * `@uwe/auth` is the low-level auth package: it must NOT depend on
 * `@uwe/security` (security depends on auth) nor on `@uwe/database` (database
 * depends on `@uwe/auth/server`). Either edge would create an import cycle.
 * Therefore every app/security/data concern — the guard, the user lookup, the
 * error helper, the rate limiter, and the 2FA service + audit sink — is
 * INJECTED via {@link TwoFactorRouteDeps}. This module owns only the
 * orchestration and stays free of new dependencies.
 */

/** Minimal user shape the handlers need. Structurally satisfied by `AuthUser`. */
export interface TwoFactorRouteUser {
  id: string;
  email: string | null;
  displayName: string;
}

/** Options forwarded to the injected rate limiter (matches `@uwe/security`). */
export interface TwoFactorRateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

/** Rate-limit decision. Structurally compatible with `@uwe/security`'s result. */
export interface TwoFactorRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Audit actions the 2FA flow emits. Each is a member of `@uwe/database`'s `AuditAction`. */
export type TwoFactorAuditAction = "mfa_enabled" | "mfa_disabled" | "mfa_challenge_failed";

/** Request context for an audit entry. Structurally matches `AuditRequestContext`. */
export interface TwoFactorAuditRequestContext {
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Audit event payload. Deliberately narrow (literal action, `"user"` target) so
 * the real `logAuditEvent(db, input: LogAuditEventInput)` is directly assignable
 * to {@link TwoFactorRouteDeps.logAuditEvent} without casts or importing the
 * database package.
 */
export interface TwoFactorAuditEvent {
  actorUserId: string;
  action: TwoFactorAuditAction;
  targetType: "user";
  targetId: string;
  request: TwoFactorAuditRequestContext;
}

/**
 * The subset of the 2FA domain service the handlers call. Structurally
 * satisfied by `@uwe/database`'s `TwoFactorService`, injected so `@uwe/auth`
 * never imports the database package (which would be a cycle).
 */
export interface TwoFactorServicePort {
  isEnabled(userId: string): Promise<boolean>;
  beginSetup(userId: string, accountName: string): Promise<unknown>;
  confirmSetup(userId: string, code: string): Promise<boolean>;
  disable(userId: string): Promise<void>;
  createLoginChallenge(userId: string): Promise<{ challengeToken: string }>;
  verifyLoginChallenge(
    challengeToken: string,
    code: string,
  ): Promise<{ userId: string } | null>;
}

/** A DB handle that can be released after a request's unit of work. */
export interface TwoFactorDbHandle {
  $disconnect(): Promise<void>;
}

/** Everything the shared 2FA flow needs, injected by each app. */
export interface TwoFactorRouteDeps<TDb extends TwoFactorDbHandle> {
  /** App auth guard. Returns an error `Response` when blocked, else `null`. */
  guard(request: Request): Response | null | Promise<Response | null>;
  /** Resolves the authenticated user for the request, or `null`. */
  requireAuthedUser(request: Request): Promise<TwoFactorRouteUser | null>;
  /** App error-response helper (`{ error }` body at the given status). */
  errorResponse(message: string, status: number): Response;
  /**
   * Rate-limit key prefix, e.g. `"2fa"` (Studio) or `"portal-2fa"` (Portal).
   * The activate handler keys on `` `${rateKeyPrefix}-activate:${ip}:${userId}` ``.
   */
  rateKeyPrefix: string;
  /** Extracts the client IP used to key the rate limiter. */
  clientIpFromHeaders(headers: Headers): string;
  /** Async rate limiter, injected from `@uwe/security` via the app. */
  checkRateLimitAsync(
    key: string,
    options: TwoFactorRateLimitOptions,
  ): Promise<TwoFactorRateLimitResult>;
  /** Opens a DB handle for a single request (released in `finally`). */
  createPrismaClient(): TDb;
  /** Builds the 2FA domain service over the DB handle. */
  createTwoFactorService(db: TDb): TwoFactorServicePort;
  /** Persists an audit event. */
  logAuditEvent(db: TDb, event: TwoFactorAuditEvent): Promise<void>;
  /** Derives the audit request context from the request headers. */
  auditRequestFromHeaders(headers: Headers): TwoFactorAuditRequestContext;
}

/** The 2FA HTTP handlers, one per route file. Names must stay stable. */
export interface TwoFactorRouteHandlers {
  handleTwoFactorStatus(request: Request): Promise<Response>;
  handleTwoFactorSetup(request: Request): Promise<Response>;
  handleTwoFactorActivate(request: Request): Promise<Response>;
  handleTwoFactorDisable(request: Request): Promise<Response>;
}

type SessionResult =
  | { user: TwoFactorRouteUser }
  | { error: Response };

/**
 * Builds the four 2FA route handlers from injected, app-specific dependencies.
 * The returned handlers preserve each app's exact behavior: same guard, same
 * error shapes, same rate-limit keys, same audit events, same responses.
 */
export function createTwoFactorRouteHandlers<TDb extends TwoFactorDbHandle>(
  deps: TwoFactorRouteDeps<TDb>,
): TwoFactorRouteHandlers {
  const {
    guard,
    requireAuthedUser,
    errorResponse,
    rateKeyPrefix,
    clientIpFromHeaders,
    checkRateLimitAsync,
    createPrismaClient,
    createTwoFactorService,
    logAuditEvent,
    auditRequestFromHeaders,
  } = deps;

  async function requireSessionUser(request: Request): Promise<SessionResult> {
    const authError = await guard(request);
    if (authError) return { error: authError };

    const user = await requireAuthedUser(request);
    if (!user) {
      return { error: errorResponse("Anmeldung erforderlich.", 401) };
    }

    return { user };
  }

  async function handleTwoFactorStatus(request: Request): Promise<Response> {
    const session = await requireSessionUser(request);
    if ("error" in session) return session.error;

    const db = createPrismaClient();
    const twoFactor = createTwoFactorService(db);
    try {
      return Response.json({ enabled: await twoFactor.isEnabled(session.user.id) });
    } finally {
      await db.$disconnect();
    }
  }

  async function handleTwoFactorSetup(request: Request): Promise<Response> {
    const session = await requireSessionUser(request);
    if ("error" in session) return session.error;

    const db = createPrismaClient();
    const twoFactor = createTwoFactorService(db);
    try {
      if (await twoFactor.isEnabled(session.user.id)) {
        return errorResponse("2FA ist bereits aktiv.", 400);
      }

      const setup = await twoFactor.beginSetup(
        session.user.id,
        session.user.email ?? session.user.displayName,
      );
      return Response.json(setup);
    } finally {
      await db.$disconnect();
    }
  }

  async function handleTwoFactorActivate(request: Request): Promise<Response> {
    const session = await requireSessionUser(request);
    if ("error" in session) return session.error;

    const body = (await request.json()) as { code?: string };
    const code = body.code?.trim() ?? "";
    if (!code) {
      return errorResponse("Code ist erforderlich.", 400);
    }

    const ip = clientIpFromHeaders(request.headers);
    const rateKey = `${rateKeyPrefix}-activate:${ip}:${session.user.id}`;
    const rate = await checkRateLimitAsync(rateKey, { maxAttempts: 8, windowMs: 5 * 60_000 });
    if (!rate.allowed) {
      return Response.json(
        { error: "Zu viele Versuche. Bitte warte einen Moment." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const db = createPrismaClient();
    const twoFactor = createTwoFactorService(db);
    try {
      const ok = await twoFactor.confirmSetup(session.user.id, code);
      if (!ok) {
        await logAuditEvent(db, {
          actorUserId: session.user.id,
          action: "mfa_challenge_failed",
          targetType: "user",
          targetId: session.user.id,
          request: auditRequestFromHeaders(request.headers),
        });
        return errorResponse("Ungültiger Code.", 400);
      }

      await logAuditEvent(db, {
        actorUserId: session.user.id,
        action: "mfa_enabled",
        targetType: "user",
        targetId: session.user.id,
        request: auditRequestFromHeaders(request.headers),
      });

      return Response.json({
        ok: true,
        message: "Zwei-Faktor-Authentifizierung wurde aktiviert.",
      });
    } finally {
      await db.$disconnect();
    }
  }

  async function handleTwoFactorDisable(request: Request): Promise<Response> {
    const session = await requireSessionUser(request);
    if ("error" in session) return session.error;

    const body = (await request.json()) as { code?: string };
    const code = body.code?.trim() ?? "";
    if (!code) {
      return errorResponse("Code ist erforderlich.", 400);
    }

    const db = createPrismaClient();
    const twoFactor = createTwoFactorService(db);
    try {
      if (!(await twoFactor.isEnabled(session.user.id))) {
        return errorResponse("2FA ist nicht aktiv.", 400);
      }

      const challenge = await twoFactor.createLoginChallenge(session.user.id);
      const verified = await twoFactor.verifyLoginChallenge(challenge.challengeToken, code);
      if (!verified || verified.userId !== session.user.id) {
        await logAuditEvent(db, {
          actorUserId: session.user.id,
          action: "mfa_challenge_failed",
          targetType: "user",
          targetId: session.user.id,
          request: auditRequestFromHeaders(request.headers),
        });
        return errorResponse("Ungültiger Code.", 400);
      }

      await twoFactor.disable(session.user.id);
      await logAuditEvent(db, {
        actorUserId: session.user.id,
        action: "mfa_disabled",
        targetType: "user",
        targetId: session.user.id,
        request: auditRequestFromHeaders(request.headers),
      });

      return Response.json({
        ok: true,
        message: "Zwei-Faktor-Authentifizierung wurde deaktiviert.",
      });
    } finally {
      await db.$disconnect();
    }
  }

  return {
    handleTwoFactorStatus,
    handleTwoFactorSetup,
    handleTwoFactorActivate,
    handleTwoFactorDisable,
  };
}
