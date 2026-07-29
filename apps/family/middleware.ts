import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  applySecurityHeaders,
  evaluateFamilyMiddleware,
  rebaseUrlOnPublicOrigin,
  resolveFamilyPublicBaseUrl,
} from "@uwe/auth";

/**
 * Family ist häkchen-gegated wie Brain, nur mit einem anderen Häkchen. Das
 * Middleware kennt keinen Benutzer und entscheidet deshalb nur, ob überhaupt
 * eine Sitzung da ist; ob sie das Häkchen `Family` trägt, prüft jede Seite und
 * jede Route server-seitig (`requireFamilyAccess`).
 *
 * Die Anmeldung selbst passiert auf der UWE-Hauptorigin — Family hat kein
 * eigenes Anmeldeformular, sondern teilt sich das Sitzungs-Cookie.
 *
 * Family bindet auf Loopback, deshalb wird der Redirect auf die konfigurierte
 * öffentliche Family-Origin (NEXT_PUBLIC_FAMILY_URL) umgesetzt — sonst landet
 * ein Besucher von family.uwe.example ohne Sitzung auf `localhost:3004/login`.
 */
function buildFamilyLoginUrl(request: NextRequest, pathname: string): URL {
  const loginUrl = rebaseUrlOnPublicOrigin(
    request.nextUrl.clone(),
    resolveFamilyPublicBaseUrl(process.env),
  );
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("redirect", pathname);
  return loginUrl;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-uwe-pathname", pathname);

  const decision = evaluateFamilyMiddleware({
    pathname,
    url: request.url,
    headers: request.headers,
    cookies: request.cookies,
  });

  if (decision.action === "redirect-login") {
    return applySecurityHeaders(
      NextResponse.redirect(buildFamilyLoginUrl(request, pathname)),
      process.env,
      undefined,
      request,
    );
  }

  if (decision.action === "block") {
    return applySecurityHeaders(
      NextResponse.json(
        { error: decision.error ?? "Zugriff verweigert." },
        { status: decision.status ?? 403 },
      ),
      process.env,
      undefined,
      request,
    );
  }

  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    process.env,
    undefined,
    request,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
