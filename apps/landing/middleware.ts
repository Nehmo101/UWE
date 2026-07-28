import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applySecurityHeaders, resolveStudioPublicBaseUrl } from "@uwe/auth";

/**
 * Der Apex-Origin (uwe.example) trägt ausschließlich die Startseite.
 *
 * Studio, Portal und Brain haben eigene Subdomains und eigene Prozesse; dieser
 * Dienst kennt deren Routen gar nicht. Die Liste unten ist deshalb eine
 * vollständige Allowlist — alles andere ist hier kein „noch nicht gebaut",
 * sondern absichtlich nicht vorhanden.
 *
 * Damit alte Lesezeichen (uwe.example/today) nicht ins Leere laufen,
 * werden unbekannte Seitenpfade dauerhaft auf denselben Pfad im Studio
 * umgeleitet; unbekannte API-Pfade antworten mit 404.
 */
const ALLOWED_PATHS = new Set(["/", "/api/auth/enter", "/api/health"]);

function isAllowed(pathname: string): boolean {
  // Trailing Slash normalisieren, damit /api/health/ nicht durchs Raster fällt.
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return ALLOWED_PATHS.has(normalized || "/");
}

/**
 * Zielort für einen unbekannten Seitenpfad. `null`, wenn kein anderer Origin
 * konfiguriert ist oder er auf denselben Host zeigt — eine Umleitung auf sich
 * selbst wäre eine Endlosschleife.
 */
function studioRedirectUrl(request: NextRequest): URL | null {
  try {
    const base = new URL(resolveStudioPublicBaseUrl(process.env));
    if (base.host.toLowerCase() === request.nextUrl.host.toLowerCase()) {
      return null;
    }
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, base);
    return target;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isAllowed(pathname)) {
    return applySecurityHeaders(NextResponse.next(), process.env, {}, request);
  }

  if (pathname.startsWith("/api/")) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Nicht gefunden." }, { status: 404 }),
      process.env,
      {},
      request,
    );
  }

  const target = studioRedirectUrl(request);
  if (target) {
    return applySecurityHeaders(NextResponse.redirect(target, 308), process.env, {}, request);
  }

  return applySecurityHeaders(
    NextResponse.json({ error: "Nicht gefunden." }, { status: 404 }),
    process.env,
    {},
    request,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|scenes/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
