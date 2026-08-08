import { cookies, headers } from "next/headers";
import { authorize, SESSION_COOKIE_NAME, type AuthorizeDenied } from "@uwe/auth";
import { getCurrentUser } from "./auth";

export class PortalActionAuthError extends Error {
  readonly status: number;

  constructor(denied: AuthorizeDenied) {
    super(denied.error);
    this.name = "PortalActionAuthError";
    this.status = denied.status;
  }
}

/**
 * Server-side guard for Portal Server Actions.
 * Must be called at the start of every mutating Portal action — middleware alone
 * is not sufficient.
 */
export async function requirePortalActionAuth(): Promise<void> {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  const request = new Request("http://portal.local/", {
    headers: headerStore,
  });

  const denied = authorize({
    scope: "portal-action",
    request,
    hasSession,
  });

  if (denied) {
    throw new PortalActionAuthError(denied);
  }

  if (!(await getCurrentUser())) {
    throw new PortalActionAuthError({
      status: 403,
      error: "Dieses Konto ist nicht für das Portal freigeschaltet.",
    });
  }
}
