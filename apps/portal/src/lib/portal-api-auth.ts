import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorize, isCrossSiteBrowserRequest, SESSION_COOKIE_NAME } from "@uwe/auth";

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

  const denied = authorize({
    scope: "portal-api",
    request,
    pathname: new URL(request.url).pathname,
    hasSession,
  });

  if (!denied) {
    return null;
  }

  return NextResponse.json({ error: denied.error }, { status: denied.status });
}
