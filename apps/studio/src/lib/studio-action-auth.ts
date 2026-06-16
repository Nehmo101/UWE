import { headers } from "next/headers";
import { authorize, type AuthorizeDenied } from "@uwe/auth";

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
 * is not sufficient.
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
}
