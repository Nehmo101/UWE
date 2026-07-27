import { headers } from "next/headers";
import {
  authorize,
  canAccessStudio,
  type AuthorizeDenied,
} from "@uwe/auth";
import { getCurrentAuthUser, studioAuthRequired } from "./auth";

export class StudioActionAuthError extends Error {
  readonly status: number;

  constructor(denied: AuthorizeDenied) {
    super(denied.error);
    this.name = "StudioActionAuthError";
    this.status = denied.status;
  }
}

/**
 * Server-side guard for Studio Server Actions.
 * Must be called at the start of every mutating Studio action — middleware alone
 * is not sufficient. Enforced statically by `server-actions.test.ts`.
 *
 * Two layers, both required:
 *
 *  1. **Origin/CSRF** via `authorize({ scope: "studio-action" })` — rejects
 *     cross-site invocations and honours `STUDIO_API_TOKEN`.
 *  2. **Access** — the session user must hold the Studio checkbox.
 *
 * Layer 2 is not optional and must not be delegated to the middleware: the
 * Studio middleware only checks that *a* session cookie exists, and
 * `POST /api/auth/enter` on the landing origin issues a valid `uwe_session` to
 * ANY active user when `target: "portal"` — including Portal-only accounts. When the
 * session cookie is shared across origins, such a session reaches Studio.
 * Without the access check here it could invoke every Studio Server Action,
 * because pages (`enforceStudioPageAuth`) and API routes
 * (`guardStudioApiRequest`) are the only other places access is verified and
 * Server Actions pass through neither.
 *
 * Modules that need a narrower gate (owner-only, admin-only) additionally call
 * `requireOwner()` / `requireAdminAccess()` from `./auth` after this guard.
 */
export async function requireStudioActionAuth(): Promise<void> {
  const headerStore = await headers();
  const request = new Request("http://studio.local/", {
    headers: headerStore,
  });

  const denied = authorize({
    scope: "studio-action",
    request,
  });

  if (denied) {
    throw new StudioActionAuthError(denied);
  }

  await requireStudioActionRole();
}

/**
 * Role half of the Studio action guard. In trusted-network dev mode
 * (`AUTH_REQUIRED=false`) there is no session to check and the operator is
 * treated as owner — mirroring `requireUser()` in `./auth`, so local dev and
 * the seeded e2e run behave as before.
 */
async function requireStudioActionRole(): Promise<void> {
  if (!studioAuthRequired()) {
    return;
  }

  const user = await getCurrentAuthUser();

  if (!user) {
    throw new StudioActionAuthError({
      status: 401,
      error: "Anmeldung erforderlich.",
    });
  }

  if (!canAccessStudio(user)) {
    throw new StudioActionAuthError({
      status: 403,
      error: "Kein Zugang zum Bereich Studio.",
    });
  }
}
