import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  applySecurityHeaders,
  evaluateStudioMiddleware,
  getUweRuntimeConfig,
  isCrossSiteBrowserRequest,
  SESSION_COOKIE_NAME,
} from "@uwe/auth";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/logout",
  "/setup",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/health",
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

  if (!isCrossSiteBrowserRequest(request)) {
    return null;
  }

  return applySecurityHeaders(
    NextResponse.json(
      { error: "Cross-Origin-Anfragen an die Studio-API sind nicht erlaubt." },
      { status: 403 },
    ),
  );
}

export function middleware(request: NextRequest) {
  const crossOriginError = rejectCrossOriginApiRequest(request);
  if (crossOriginError) {
    return crossOriginError;
  }

  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-uwe-pathname", pathname);

  const config = getUweRuntimeConfig();
  if (config.authRequired && !isPublicPath(pathname)) {
    const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!hasSession) {
      if (pathname.startsWith("/api/")) {
        return applySecurityHeaders(
          NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }),
        );
      }

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  const decision = evaluateStudioMiddleware({
    pathname,
    url: request.url,
    headers: request.headers,
    cookies: request.cookies,
  });

  if (decision.action === "allow") {
    return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  if (decision.status === 404) {
    return applySecurityHeaders(
      NextResponse.json({ error: decision.error ?? "Nicht gefunden." }, { status: 404 }),
    );
  }

  return applySecurityHeaders(
    NextResponse.json(
      { error: decision.error ?? "Zugriff verweigert." },
      { status: decision.status ?? 401 },
    ),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
