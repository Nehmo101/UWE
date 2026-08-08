import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  authorize,
  isCrossSiteBrowserRequest,
  requiresPortalSession,
  SESSION_COOKIE_NAME,
} from "@uwe/auth";
import { getCurrentUser } from "./auth";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Server-side guard for Portal API routes. Public routes pass through;
 * unknown or protected routes are denied regardless of middleware.
 */
export async function requirePortalApiAuth(request: Request): Promise<NextResponse | null> {
  if (MUTATING_METHODS.has(request.method.toUpperCase()) && isCrossSiteBrowserRequest(request)) {
    return NextResponse.json(
      { error: "Cross-Origin-Anfragen an die Portal-API sind nicht erlaubt." },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  const pathname = new URL(request.url).pathname;
  const denied = authorize({
    scope: "portal-api",
    request,
    pathname,
    hasSession,
  });

  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status });
  }

  if (requiresPortalSession(pathname) && !(await getCurrentUser())) {
    return NextResponse.json(
      { error: "Dieses Konto ist nicht für das Portal freigeschaltet." },
      { status: 403 },
    );
  }

  return null;
}
