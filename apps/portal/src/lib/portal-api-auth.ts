import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorize, SESSION_COOKIE_NAME } from "@uwe/auth";

/**
 * Server-side guard for Portal API routes. Public routes pass through;
 * unknown or protected routes are denied regardless of middleware.
 */
export async function requirePortalApiAuth(request: Request): Promise<NextResponse | null> {
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
