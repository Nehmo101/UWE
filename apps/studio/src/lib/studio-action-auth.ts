import { headers } from "next/headers";
import {
  authorize,
  hasAnyRole,
  STUDIO_ACCESS_ROLES,
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
 *  2. **Role** — the session user must hold a Studio role
 *     (`STUDIO_ACCESS_ROLES`: owner/admin/dm).
 *
 * Layer 2 is not optional and must not be delegated to the middleware: the
 * Studio middleware only checks that *a* session cookie exists, and
 * `POST /api/auth/enter` (public, Studio origin) issues a valid `uwe_session`
 * to ANY active user when `target: "portal"` — including role `player`. Without
 * the role check here, such a session could invoke every Studio Server Action,
 * because pages (`enforceStudioPageAuth`) and API routes
 * (`guardStudioApiRequest`) are the only other places a role is verified and
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

  if (!hasAnyRole(user, STUDIO_ACCESS_ROLES)) {
    throw new StudioActionAuthError({
      status: 403,
      error: "Kein Studio-Zugriff für diese Rolle.",
    });
  }
}
