import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applySecurityHeaders, getUweRuntimeConfig, SESSION_COOKIE_NAME } from "@uwe/auth";
import { isBrainEntryEnabled, resolveBrainExposure } from "@/src/lib/exposure";

// Loopback is enforced at the bind level (`next start --hostname 127.0.0.1`);
// this middleware adds the app-level owner/session gate. Every page and API
// additionally re-checks the owner role server-side (requireBrainOwnerAuth).
const PUBLIC_PATH_PREFIXES = ["/login", "/api/health"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // BRAIN_EXPOSURE=off disables the Brain entry entirely.
  if (!isBrainEntryEnabled(resolveBrainExposure(process.env))) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Der Brain-Bereich ist deaktiviert." }, { status: 503 }),
      process.env,
      {},
      request,
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-uwe-pathname", pathname);

  const config = getUweRuntimeConfig();
  if (config.authRequired && !isPublicPath(pathname)) {
    const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!hasSession) {
      if (pathname.startsWith("/api/")) {
        return applySecurityHeaders(
          NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }),
          process.env,
          {},
          request,
        );
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl), process.env, {}, request);
    }
  }

  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    process.env,
    {},
    request,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
