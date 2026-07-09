import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  applySecurityHeaders,
  evaluatePortalMiddleware,
  fetchMaintenanceMiddlewareDecision,
  isCrossSiteBrowserRequest,
  resolveLegacyPathRedirect,
} from "@uwe/auth";
import { isMaintenanceMiddlewareBypassPath } from "@uwe/database/maintenance-gate";
import { portalReturnPath } from "@/src/lib/portal-redirect";

function rejectCrossOriginApiRequest(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return null;
  }

  if (!isCrossSiteBrowserRequest(request)) {
    return null;
  }

  return applySecurityHeaders(
    NextResponse.json(
      { error: "Cross-Origin-Anfragen an die Portal-API sind nicht erlaubt." },
      { status: 403 },
    ),
    process.env,
    { allowYouTubeEmbeds: true },
    request,
  );
}

export async function middleware(request: NextRequest) {
  const legacyRedirect = resolveLegacyPathRedirect(request.nextUrl.pathname, "portal", process.env);
  if (legacyRedirect) {
    const target = legacyRedirect.external
      ? legacyRedirect.destination
      : (() => {
          const url = request.nextUrl.clone();
          url.pathname = legacyRedirect.destination;
          url.search = request.nextUrl.search;
          return url.toString();
        })();
    return applySecurityHeaders(
      NextResponse.redirect(target, 308),
      process.env,
      { allowYouTubeEmbeds: true },
      request,
    );
  }

  const crossOriginError = rejectCrossOriginApiRequest(request);
  if (crossOriginError) {
    return crossOriginError;
  }

  const pathname = request.nextUrl.pathname;

  if (!isMaintenanceMiddlewareBypassPath(pathname)) {
    const maintenance = await fetchMaintenanceMiddlewareDecision(
      request.nextUrl.origin,
      pathname,
      "portal",
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

  const decision = evaluatePortalMiddleware({
    pathname: request.nextUrl.pathname,
    url: request.url,
    headers: request.headers,
    cookies: request.cookies,
  });

  if (decision.action === "allow") {
    const response = NextResponse.next({
      request: {
        headers: (() => {
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set("x-uwe-pathname", request.nextUrl.pathname);
          return requestHeaders;
        })(),
      },
    });
    return applySecurityHeaders(
      response,
      process.env,
      { allowYouTubeEmbeds: true },
      request,
    );
  }

  if (decision.action === "redirect-login") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = decision.redirectPath ?? "/login";
    loginUrl.searchParams.set(
      "redirect",
      portalReturnPath(request.nextUrl.pathname, request.nextUrl.search),
    );
    return applySecurityHeaders(
      NextResponse.redirect(loginUrl),
      process.env,
      { allowYouTubeEmbeds: true },
      request,
    );
  }

  if (decision.status === 404) {
    return applySecurityHeaders(
      NextResponse.json({ error: decision.error ?? "Nicht gefunden." }, { status: 404 }),
      process.env,
      { allowYouTubeEmbeds: true },
      request,
    );
  }

  return applySecurityHeaders(
    NextResponse.json(
      { error: decision.error ?? "Zugriff verweigert." },
      { status: decision.status ?? 403 },
    ),
    process.env,
    { allowYouTubeEmbeds: true },
    request,
  );
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/maintenance",
    "/portal",
    "/worlds/:path*",
    "/players/:path*",
    "/auth/:path*",
    "/share/:path*",
    "/public-assets/:path*",
    "/api/:path*",
  ],
};
