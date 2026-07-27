import { jsonError } from "./src/lib/api-response";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  applySecurityHeaders,
  evaluateStudioMiddleware,
  fetchMaintenanceMiddlewareDecision,
  getUweDeploymentModel,
  getUweRuntimeConfig,
  isCrossSiteBrowserRequest,
  resolveLegacyPathRedirect,
  SESSION_COOKIE_NAME,
} from "@uwe/auth";
import { isMaintenanceMiddlewareBypassPath } from "@uwe/database/maintenance-gate";

const PUBLIC_PATH_PREFIXES = [
  "/",
  "/login",
  "/logout",
  "/setup",
  "/maintenance",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/health",
  "/api/maintenance",
  "/api/agent-jobs/callback",
  // RTX Host Connector authenticates with its own token in the route handler.
  "/api/connectors",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function rejectCrossOriginApiRequest(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) {
    return null;
  }

  if (
    pathname === "/api/health" ||
    pathname.startsWith("/api/health/") ||
    pathname.startsWith("/api/auth/")
  ) {
    return null;
  }

  if (!isCrossSiteBrowserRequest(request, process.env)) {
    return null;
  }

  return applySecurityHeaders(
    NextResponse.json(
      { error: "Cross-Origin-Anfragen an die Studio-API sind nicht erlaubt." },
      { status: 403 },
    ),
    process.env,
    { allowYouTubeEmbeds: true },
    request,
  );
}

export async function middleware(request: NextRequest) {
  const legacyRedirect = resolveLegacyPathRedirect(request.nextUrl.pathname, "studio", process.env);
  if (legacyRedirect) {
    const url = request.nextUrl.clone();
    url.pathname = legacyRedirect.destination;
    return applySecurityHeaders(
      NextResponse.redirect(url, 308),
      process.env,
      { allowYouTubeEmbeds: true },
      request,
    );
  }

  const crossOriginError = rejectCrossOriginApiRequest(request);
  if (crossOriginError) {
    return crossOriginError;
  }

  // Bei getrennten Hostnamen liegt die öffentliche Startseite in ihrer eigenen
  // App auf dem Apex — der Studio-Origin hat auf „/" nichts Öffentliches mehr.
  // Anonyme Besucher hier schon in der Middleware zum Login schicken: `redirect()`
  // in der Seite käme erst, wenn das Layout bereits streamt, und fiele dann auf
  // einen Meta-Refresh mit sichtbarer Verzögerung zurück.
  if (
    request.nextUrl.pathname === "/" &&
    getUweDeploymentModel() === "split-hostname" &&
    !request.cookies.get(SESSION_COOKIE_NAME)?.value
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return applySecurityHeaders(
      NextResponse.redirect(loginUrl, 307),
      process.env,
      { allowYouTubeEmbeds: true },
      request,
    );
  }

  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-uwe-pathname", pathname);

  // Pass portal proxy paths through without Studio auth or route classification.
  // When PORTAL_PATH is set to a sub-path, Studio rewrites those requests to the
  // portal container — middleware must not intercept them.
  const rawPortalPath = process.env.PORTAL_PATH?.trim();
  if (rawPortalPath && rawPortalPath !== "/" && (pathname === rawPortalPath || pathname.startsWith(`${rawPortalPath}/`))) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      process.env,
      { allowYouTubeEmbeds: true },
      request,
    );
  }

  if (!isMaintenanceMiddlewareBypassPath(pathname)) {
    const maintenance = await fetchMaintenanceMiddlewareDecision(
      request.nextUrl.origin,
      pathname,
      "studio",
      request.headers.get("cookie"),
    );
    if (maintenance) {
      if (pathname.startsWith("/api/")) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: maintenance.message, maintenance: true },
            { status: 503 },
          ),
          process.env,
          { allowYouTubeEmbeds: true },
          request,
        );
      }

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = maintenance.redirectPath ?? "/maintenance";
      redirectUrl.search = "";
      return applySecurityHeaders(
        NextResponse.redirect(redirectUrl),
        process.env,
        { allowYouTubeEmbeds: true },
        request,
      );
    }
  }

  const config = getUweRuntimeConfig();
  if (config.authRequired && !isPublicPath(pathname)) {
    const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!hasSession) {
      if (pathname.startsWith("/api/")) {
        return applySecurityHeaders(
          jsonError("Anmeldung erforderlich.", 401),
          process.env,
          { allowYouTubeEmbeds: true },
          request,
        );
      }

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", pathname);
      return applySecurityHeaders(
        NextResponse.redirect(loginUrl),
        process.env,
        { allowYouTubeEmbeds: true },
        request,
      );
    }
  }

  const decision = evaluateStudioMiddleware({
    pathname,
    url: request.url,
    headers: request.headers,
    cookies: request.cookies,
  });

  if (decision.action === "allow") {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      process.env,
      { allowYouTubeEmbeds: true },
      request,
    );
  }

  if (decision.status === 404) {
    return applySecurityHeaders(
      jsonError(decision.error ?? "Nicht gefunden.", 404),
      process.env,
      { allowYouTubeEmbeds: true },
      request,
    );
  }

  return applySecurityHeaders(
    NextResponse.json(
      { error: decision.error ?? "Zugriff verweigert." },
      { status: decision.status ?? 401 },
    ),
    process.env,
    { allowYouTubeEmbeds: true },
    request,
  );
}

/**
 * `terra/` steht im Negativ-Lookahead, weil `apps/studio/public/terra/` rund
 * 90 statische Dateien hat (Editor + mitgeliefertes three.js). Ohne den
 * Eintrag liefe die Middleware bei jedem Laden des Karteneditors 90-mal.
 *
 * Der Ordner trägt AUSSCHLIESSLICH Programmcode — kein Weltinhalt. Die Karte
 * reist über die postMessage-Brücke von der geschützten Elternseite herein
 * (siehe terra/src/editor/bruecke.js); der Frame hat weder Route noch Sitzung.
 * Öffentlich erreichbar ist damit dasselbe, was jedes JS-Bundle ohnehin ist.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|terra/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
