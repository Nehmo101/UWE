/**
 * Shared passkey (WebAuthn) route orchestration for the Studio and the Portal.
 *
 * Follows the established auth-method pattern (see
 * `@uwe/auth/src/two-factor-routes.ts` and `login-flow.ts`): the
 * security-sensitive core — challenge lifecycle, WebAuthn verification,
 * access checks, session issuing, audit logging — lives here once, while
 * every app/security/data concern (guard, store, auth service, rate limiter,
 * cookie writer, audit sinks) is INJECTED via {@link PasskeyRouteDeps}.
 *
 * Passkey login uses `userVerification: "required"`, i.e. possession of the
 * device plus biometrics/PIN. That is two factors in one ceremony, which is
 * why — following industry practice — a passkey login does NOT additionally
 * prompt for TOTP. Turnstile is likewise skipped: the ceremony already
 * requires a real user gesture on real hardware.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  buildAuthSuccessBody,
  issueLoginSession,
  type AuthUser,
  type LoginAttemptAuditInput,
  type LoginAuditRequestContext,
  type LoginFlowFailureReason,
  type LoginFlowSurface,
  type LoginRateLimitOptions,
  type LoginRateLimitResult,
  type SessionIssuingAuthPort,
  type UweRole,
} from "@uwe/auth";
import type { WebAuthnRelyingParty } from "./webauthn-config";

/** A DB handle that can be released after a request's unit of work. */
export interface PasskeyDbHandle {
  $disconnect(): Promise<void>;
}

/** Minimal user shape the session-gated handlers need (matches `AuthUser`). */
export interface PasskeyRouteUser {
  id: string;
  email: string | null;
  displayName: string;
}

/** Client-safe passkey view (matches `@uwe/database`'s `PasskeyCredentialView`). */
export interface PasskeyCredentialViewPort {
  id: string;
  name: string;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/** Credential + owner as returned for login (matches `PasskeyCredentialWithUser`). */
export interface PasskeyLoginCredentialPort {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  rpId: string;
  user: {
    id: string;
    displayName: string;
    email: string | null;
    role: UweRole;
    status: "invited" | "active" | "disabled";
    forcePasswordChange: boolean;
  };
}

/**
 * The persistence subset the handlers call. Structurally satisfied by
 * `@uwe/database`'s `PasskeyCredentialStore`, injected so this package never
 * imports the database package.
 */
export interface PasskeyStorePort {
  persistChallenge(input: {
    challenge: string;
    type: "registration" | "authentication";
    userId?: string | null;
  }): Promise<{ expiresAt: Date }>;
  consumeChallenge(
    challenge: string,
    type: "registration" | "authentication",
  ): Promise<{ userId: string | null } | null>;
  insertCredential(input: {
    userId: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports?: string[] | null;
    deviceType?: string | null;
    backedUp?: boolean;
    rpId: string;
    name: string;
  }): Promise<PasskeyCredentialViewPort>;
  listForUser(userId: string): Promise<PasskeyCredentialViewPort[]>;
  listCredentialIdsForUser(userId: string): Promise<string[]>;
  findByCredentialIdForLogin(credentialId: string): Promise<PasskeyLoginCredentialPort | null>;
  updateAfterLogin(id: string, counter: number): Promise<void>;
  deleteForUser(userId: string, id: string): Promise<boolean>;
}

/** Audit actions the passkey flow emits (members of `AuditAction`). */
export type PasskeyAuditAction = "passkey_registered" | "passkey_removed";

/** Audit event payload (assignable to `logAuditEvent`'s input, like 2FA). */
export interface PasskeyAuditEvent {
  actorUserId: string;
  action: PasskeyAuditAction;
  targetType: "user";
  targetId: string;
  request: LoginAuditRequestContext;
  metadata?: Record<string, unknown>;
}

/** The WebAuthn verifier functions, injectable so unit tests can stub them. */
export interface WebAuthnVerifierPort {
  generateRegistrationOptions: typeof generateRegistrationOptions;
  verifyRegistrationResponse: typeof verifyRegistrationResponse;
  generateAuthenticationOptions: typeof generateAuthenticationOptions;
  verifyAuthenticationResponse: typeof verifyAuthenticationResponse;
}

const defaultVerifier: WebAuthnVerifierPort = {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
};

/** Everything the shared passkey flow needs, injected by each app. */
export interface PasskeyRouteDeps<TDb extends PasskeyDbHandle> {
  /** Audit surface for logins (`"studio"` or `"portal"`). */
  surface: LoginFlowSurface;
  /** App auth guard for the session-gated handlers (register/list/delete). */
  guard(request: Request): Response | null | Promise<Response | null>;
  /** Resolves the authenticated user for session-gated handlers, or `null`. */
  requireAuthedUser(request: Request): Promise<PasskeyRouteUser | null>;
  /** App error-response helper (`{ error }` body at the given status). */
  errorResponse(message: string, status: number): Response;
  /** Rate-limit key prefix, e.g. `"passkey"` / `"portal-passkey"`. */
  rateKeyPrefix: string;
  clientIpFromHeaders(headers: Headers): string;
  checkRateLimitAsync(
    key: string,
    options: LoginRateLimitOptions,
  ): Promise<LoginRateLimitResult>;
  /** Rate-limit options for the public login endpoints (inject the login preset). */
  loginRateLimitOptions: LoginRateLimitOptions;
  /** Opens a DB handle for a single request (released in `finally`). */
  createDb(): TDb;
  /** Builds the passkey persistence over the DB handle. */
  createStore(db: TDb): PasskeyStorePort;
  /** Builds the session-issuing auth service over the DB handle. */
  createAuthService(db: TDb): SessionIssuingAuthPort;
  /** Reads the `auth.passkeysEnabled` system setting. */
  isPasskeysEnabled(db: TDb): Promise<boolean>;
  /** Per-surface access predicate (omit on the Portal: any active user). */
  hasAccess?(user: AuthUser): boolean;
  /** Writes the session cookie for the issued session (request-aware options). */
  setSessionCookie(token: string, request: Request): Promise<void>;
  /** Resolves RP ID + accepted origins for the incoming request. */
  relyingPartyForRequest(request: Request): WebAuthnRelyingParty;
  auditRequestFromHeaders(headers: Headers): LoginAuditRequestContext;
  /** Persists a login-attempt audit entry (success and failure). */
  logLoginAttempt(input: LoginAttemptAuditInput<TDb>): Promise<void>;
  /** Persists a passkey management audit event. */
  logAuditEvent(db: TDb, event: PasskeyAuditEvent): Promise<void>;
  /** Override for tests; defaults to `@simplewebauthn/server`. */
  verifier?: WebAuthnVerifierPort;
}

/** The passkey HTTP handlers, one per route file. Names must stay stable. */
export interface PasskeyRouteHandlers {
  handlePasskeyLoginOptions(request: Request): Promise<Response>;
  handlePasskeyLoginVerify(request: Request): Promise<Response>;
  handlePasskeyRegisterOptions(request: Request): Promise<Response>;
  handlePasskeyRegisterVerify(request: Request): Promise<Response>;
  handlePasskeyList(request: Request): Promise<Response>;
  handlePasskeyDelete(request: Request, credentialId: string): Promise<Response>;
}

const GENERIC_LOGIN_ERROR = "Ungültige Anmeldedaten.";
const DISABLED_ERROR = "Passkey-Login ist nicht aktiviert.";
const MAX_PASSKEY_NAME_LENGTH = 60;

/** Extracts the base64url challenge string from a client-data payload. */
function challengeFromClientData(clientDataJSON: unknown): string | null {
  if (typeof clientDataJSON !== "string" || !clientDataJSON) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(clientDataJSON, "base64url").toString("utf8")) as {
      challenge?: unknown;
    };
    return typeof parsed.challenge === "string" && parsed.challenge ? parsed.challenge : null;
  } catch {
    return null;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002"
  );
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

type SessionResult = { user: PasskeyRouteUser } | { error: Response };

/**
 * Builds the six passkey route handlers from injected, app-specific
 * dependencies (same construction as `createTwoFactorRouteHandlers`).
 */
export function createPasskeyRouteHandlers<TDb extends PasskeyDbHandle>(
  deps: PasskeyRouteDeps<TDb>,
): PasskeyRouteHandlers {
  const {
    surface,
    guard,
    requireAuthedUser,
    errorResponse,
    rateKeyPrefix,
    clientIpFromHeaders,
    checkRateLimitAsync,
    loginRateLimitOptions,
    createDb,
    createStore,
    createAuthService,
    isPasskeysEnabled,
    hasAccess,
    setSessionCookie,
    relyingPartyForRequest,
    auditRequestFromHeaders,
    logLoginAttempt,
    logAuditEvent,
  } = deps;
  const verifier = deps.verifier ?? defaultVerifier;

  function rateLimitedResponse(retryAfterSeconds: number): Response {
    return Response.json(
      { error: "Zu viele Versuche. Bitte warte einen Moment." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  async function requireSessionUser(request: Request): Promise<SessionResult> {
    const authError = await guard(request);
    if (authError) return { error: authError };

    const user = await requireAuthedUser(request);
    if (!user) {
      return { error: errorResponse("Anmeldung erforderlich.", 401) };
    }

    return { user };
  }

  async function handlePasskeyLoginOptions(request: Request): Promise<Response> {
    const db = createDb();
    try {
      if (!(await isPasskeysEnabled(db))) {
        return errorResponse(DISABLED_ERROR, 404);
      }

      const ip = clientIpFromHeaders(request.headers);
      const rate = await checkRateLimitAsync(
        `${rateKeyPrefix}-options:${ip}`,
        loginRateLimitOptions,
      );
      if (!rate.allowed) {
        return rateLimitedResponse(rate.retryAfterSeconds);
      }

      const rp = relyingPartyForRequest(request);
      const options = await verifier.generateAuthenticationOptions({
        rpID: rp.rpId,
        userVerification: "required",
        // Usernameless/discoverable flow: the authenticator picks the passkey.
        allowCredentials: [],
      });
      await createStore(db).persistChallenge({
        challenge: options.challenge,
        type: "authentication",
      });

      return Response.json(options);
    } finally {
      await db.$disconnect();
    }
  }

  async function handlePasskeyLoginVerify(request: Request): Promise<Response> {
    const auditRequest = auditRequestFromHeaders(request.headers);
    const ip = clientIpFromHeaders(request.headers);
    const db = createDb();

    try {
      const failLogin = async (
        reason: LoginFlowFailureReason,
        details: {
          email?: string | null;
          actorUserId?: string | null;
          extraMetadata?: Record<string, unknown>;
        } = {},
      ): Promise<Response> => {
        await logLoginAttempt({
          db,
          surface,
          request: auditRequest,
          email: details.email,
          actorUserId: details.actorUserId ?? null,
          reason,
          httpStatus: 401,
          errorMessage: GENERIC_LOGIN_ERROR,
          extraMetadata: { method: "passkey", ...(details.extraMetadata ?? {}) },
        });
        return errorResponse(GENERIC_LOGIN_ERROR, 401);
      };

      if (!(await isPasskeysEnabled(db))) {
        await logLoginAttempt({
          db,
          surface,
          request: auditRequest,
          reason: "login_method_disabled",
          httpStatus: 404,
          errorMessage: DISABLED_ERROR,
          extraMetadata: { method: "passkey" },
        });
        return errorResponse(DISABLED_ERROR, 404);
      }

      const rate = await checkRateLimitAsync(
        `${rateKeyPrefix}-verify:${ip}`,
        loginRateLimitOptions,
      );
      if (!rate.allowed) {
        await logLoginAttempt({
          db,
          surface,
          request: auditRequest,
          reason: "rate_limited",
          httpStatus: 429,
          errorMessage: "Zu viele Versuche. Bitte warte einen Moment.",
          extraMetadata: { method: "passkey", retryAfterSeconds: rate.retryAfterSeconds },
        });
        return rateLimitedResponse(rate.retryAfterSeconds);
      }

      const body = await readJsonBody<AuthenticationResponseJSON>(request);
      if (!body || typeof body.id !== "string" || !body.id) {
        return failLogin("passkey_invalid", { extraMetadata: { stage: "body" } });
      }

      const challenge = challengeFromClientData(body.response?.clientDataJSON);
      if (!challenge) {
        return failLogin("passkey_invalid", { extraMetadata: { stage: "client_data" } });
      }

      const store = createStore(db);
      const consumed = await store.consumeChallenge(challenge, "authentication");
      if (!consumed) {
        return failLogin("passkey_invalid", { extraMetadata: { stage: "challenge" } });
      }

      const credential = await store.findByCredentialIdForLogin(body.id);
      if (!credential) {
        return failLogin("passkey_invalid", { extraMetadata: { stage: "credential" } });
      }

      const auditActor = { email: credential.user.email, actorUserId: credential.user.id };
      const rp = relyingPartyForRequest(request);
      if (credential.rpId !== rp.rpId) {
        return failLogin("passkey_invalid", {
          ...auditActor,
          extraMetadata: { stage: "rp_mismatch", credentialRpId: credential.rpId },
        });
      }

      // The user handle we set at registration is the user id — cross-check it
      // when the authenticator sends one back.
      const userHandle = body.response?.userHandle;
      if (
        typeof userHandle === "string" &&
        userHandle &&
        Buffer.from(userHandle, "base64url").toString("utf8") !== credential.userId
      ) {
        return failLogin("passkey_invalid", {
          ...auditActor,
          extraMetadata: { stage: "user_handle" },
        });
      }

      let verified = false;
      let newCounter = credential.counter;
      try {
        const verification = await verifier.verifyAuthenticationResponse({
          response: body,
          expectedChallenge: challenge,
          expectedOrigin: rp.origins,
          expectedRPID: rp.rpId,
          credential: {
            id: credential.credentialId,
            publicKey: new Uint8Array(Buffer.from(credential.publicKey, "base64url")),
            counter: credential.counter,
          },
          requireUserVerification: true,
        });
        verified = verification.verified;
        newCounter = verification.authenticationInfo.newCounter;
      } catch {
        verified = false;
      }

      if (!verified) {
        return failLogin("passkey_invalid", {
          ...auditActor,
          extraMetadata: { stage: "verification" },
        });
      }

      // Clone detection: many platform authenticators always report counter 0,
      // so only a regression between two non-zero counters is suspicious.
      if (credential.counter > 0 && newCounter > 0 && newCounter <= credential.counter) {
        return failLogin("passkey_invalid", {
          ...auditActor,
          extraMetadata: { stage: "counter_regression", storedCounter: credential.counter, newCounter },
        });
      }

      const auth = createAuthService(db);
      const authUser = auth.toAuthUser(credential.user);
      if (hasAccess && !hasAccess(authUser)) {
        return failLogin("studio_access_denied", auditActor);
      }

      await store.updateAfterLogin(credential.id, newCounter);
      const session = await issueLoginSession({
        auth,
        userId: credential.user.id,
        ip,
        setSessionCookie: (token) => setSessionCookie(token, request),
      });

      await logLoginAttempt({
        db,
        surface,
        request: auditRequest,
        email: credential.user.email,
        actorUserId: credential.user.id,
        sessionId: session.id,
        httpStatus: 200,
        extraMetadata: { method: "passkey" },
      });

      return Response.json(
        buildAuthSuccessBody(authUser, credential.user.forcePasswordChange),
      );
    } catch (error) {
      await logLoginAttempt({
        db,
        surface,
        request: auditRequest,
        reason: "server_error",
        httpStatus: 500,
        errorMessage: "Anmeldung vorübergehend nicht möglich.",
        serverError: error,
        extraMetadata: { method: "passkey" },
      });
      console.error("[uwe] passkey login failed:", error);
      return errorResponse("Anmeldung vorübergehend nicht möglich.", 500);
    } finally {
      await db.$disconnect();
    }
  }

  async function handlePasskeyRegisterOptions(request: Request): Promise<Response> {
    const session = await requireSessionUser(request);
    if ("error" in session) return session.error;

    const db = createDb();
    try {
      if (!(await isPasskeysEnabled(db))) {
        return errorResponse(DISABLED_ERROR, 404);
      }

      const store = createStore(db);
      const rp = relyingPartyForRequest(request);
      const excludeIds = await store.listCredentialIdsForUser(session.user.id);

      const options = await verifier.generateRegistrationOptions({
        rpName: rp.rpName,
        rpID: rp.rpId,
        userName: session.user.email ?? session.user.displayName,
        userID: new TextEncoder().encode(session.user.id),
        userDisplayName: session.user.displayName,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
        excludeCredentials: excludeIds.map((id) => ({ id })),
      });

      await store.persistChallenge({
        challenge: options.challenge,
        type: "registration",
        userId: session.user.id,
      });

      return Response.json(options);
    } finally {
      await db.$disconnect();
    }
  }

  async function handlePasskeyRegisterVerify(request: Request): Promise<Response> {
    const session = await requireSessionUser(request);
    if ("error" in session) return session.error;

    const body = await readJsonBody<{ name?: unknown; response?: RegistrationResponseJSON }>(
      request,
    );
    const response = body?.response;
    if (!response?.response?.clientDataJSON) {
      return errorResponse("Ungültige Registrierungsdaten.", 400);
    }

    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    const name = (rawName || "Passkey").slice(0, MAX_PASSKEY_NAME_LENGTH);

    const db = createDb();
    try {
      if (!(await isPasskeysEnabled(db))) {
        return errorResponse(DISABLED_ERROR, 404);
      }

      const store = createStore(db);
      const challenge = challengeFromClientData(response.response.clientDataJSON);
      if (!challenge) {
        return errorResponse("Ungültige Registrierungsdaten.", 400);
      }

      const consumed = await store.consumeChallenge(challenge, "registration");
      if (!consumed || consumed.userId !== session.user.id) {
        return errorResponse(
          "Registrierung abgelaufen — bitte starte den Vorgang erneut.",
          400,
        );
      }

      const rp = relyingPartyForRequest(request);
      let registrationInfo;
      try {
        const verification = await verifier.verifyRegistrationResponse({
          response,
          expectedChallenge: challenge,
          expectedOrigin: rp.origins,
          expectedRPID: rp.rpId,
          requireUserVerification: true,
        });
        registrationInfo = verification.verified ? verification.registrationInfo : undefined;
      } catch {
        registrationInfo = undefined;
      }

      if (!registrationInfo) {
        return errorResponse("Der Passkey konnte nicht verifiziert werden.", 400);
      }

      let credential: PasskeyCredentialViewPort;
      try {
        credential = await store.insertCredential({
          userId: session.user.id,
          credentialId: registrationInfo.credential.id,
          publicKey: Buffer.from(registrationInfo.credential.publicKey).toString("base64url"),
          counter: registrationInfo.credential.counter,
          transports: registrationInfo.credential.transports ?? null,
          deviceType: registrationInfo.credentialDeviceType,
          backedUp: registrationInfo.credentialBackedUp,
          rpId: rp.rpId,
          name,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return errorResponse("Dieser Passkey ist bereits registriert.", 400);
        }
        throw error;
      }

      await logAuditEvent(db, {
        actorUserId: session.user.id,
        action: "passkey_registered",
        targetType: "user",
        targetId: session.user.id,
        request: auditRequestFromHeaders(request.headers),
        metadata: { credentialName: name },
      });

      return Response.json({ ok: true, credential });
    } finally {
      await db.$disconnect();
    }
  }

  async function handlePasskeyList(request: Request): Promise<Response> {
    const session = await requireSessionUser(request);
    if ("error" in session) return session.error;

    const db = createDb();
    try {
      const credentials = await createStore(db).listForUser(session.user.id);
      return Response.json({ credentials });
    } finally {
      await db.$disconnect();
    }
  }

  async function handlePasskeyDelete(request: Request, credentialId: string): Promise<Response> {
    const session = await requireSessionUser(request);
    if ("error" in session) return session.error;

    if (!credentialId) {
      return errorResponse("Passkey nicht gefunden.", 404);
    }

    const db = createDb();
    try {
      const removed = await createStore(db).deleteForUser(session.user.id, credentialId);
      if (!removed) {
        return errorResponse("Passkey nicht gefunden.", 404);
      }

      await logAuditEvent(db, {
        actorUserId: session.user.id,
        action: "passkey_removed",
        targetType: "user",
        targetId: session.user.id,
        request: auditRequestFromHeaders(request.headers),
        metadata: { credentialId },
      });

      return Response.json({ ok: true });
    } finally {
      await db.$disconnect();
    }
  }

  return {
    handlePasskeyLoginOptions,
    handlePasskeyLoginVerify,
    handlePasskeyRegisterOptions,
    handlePasskeyRegisterVerify,
    handlePasskeyList,
    handlePasskeyDelete,
  };
}
