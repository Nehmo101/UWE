import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  authorize,
  classifyRoute,
  isCrossSiteBrowserRequest,
  SESSION_COOKIE_NAME,
} from "@uwe/auth";
import { getSystemSettings, isPortalGloballyEnabled } from "@uwe/database/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Server-side guard for Portal API routes. Public routes pass through;
 * unknown or protected routes are denied regardless of middleware.
 *
 * Der globale Portal-Schalter wird HIER geprüft, nicht pro Route: Als die
 * Prüfung den einzelnen Handlern gehörte, hatten Graph- und Asset-Route sie —
 * Offline-Snapshot und Notes-Sync nicht. Öffentliche Routen (health,
 * maintenance, login) bleiben ausgenommen, sonst käme niemand mehr hinein,
 * um das Portal wieder einzuschalten.
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

  if (classifyRoute(pathname, "portal").access !== "public") {
    const settings = await getSystemSettings();
    if (!isPortalGloballyEnabled(settings)) {
      return NextResponse.json({ error: "Portal disabled" }, { status: 403 });
    }
  }

  return null;
}
