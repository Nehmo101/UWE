import { headers } from "next/headers";
import {
  authorize,
  canAccessStudio,
  canUseRtxAi,
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

/**
 * Guard für Server Actions, die den RTX-Host beschäftigen (G-KI).
 *
 * Ersetzt `requireStudioActionAuth()` NICHT, es ruft es auf: eine KI-Action
 * braucht dieselbe CSRF-/Origin-Prüfung und dasselbe Studio-Häkchen wie jede
 * andere, und darüber hinaus das KI-Flag.
 *
 * Warum es diesen zweiten Guard überhaupt gibt und nicht wie bei den API-Routen
 * eine Pfadregel: eine Server Action kennt ihren eigenen Pfad zur Laufzeit
 * nicht. Sie muss sich selbst melden. Damit das keine Frage der Sorgfalt
 * bleibt, prüft `apps/studio/src/lib/server-actions.test.ts` statisch, dass
 * JEDES Action-Modul mit einem Weg zu `@uwe/ai-brain` diesen Guard nennt — ein
 * neues KI-Feature ohne Prüfung lässt sich damit nicht mehr einchecken.
 *
 * Der Ausfallmodus, gegen den das schützt, ist der unauffällige: eine
 * vergessene Prüfung fällt niemandem auf, weil die Funktion weiterhin läuft.
 * Sie läuft nur für zu viele Leute.
 *
 * Dev-Modus (`AUTH_REQUIRED=false`) verhält sich wie oben: kein Session-Zwang,
 * der Betreiber gilt als Owner.
 */
export async function requireStudioAiActionAuth(): Promise<void> {
  await requireStudioActionAuth();

  if (!studioAuthRequired()) {
    return;
  }

  const user = await getCurrentAuthUser();
  if (!user || !canUseRtxAi(user)) {
    throw new StudioActionAuthError({
      status: 403,
      error:
        "Für dieses Konto ist die RTX-KI nicht freigeschaltet. Der Owner richtet das im Command Center ein.",
    });
  }
}
