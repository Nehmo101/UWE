import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applySecurityHeaders, evaluateBrainMiddleware } from "@uwe/auth";
import { isBrainEntryEnabled, resolveBrainExposure } from "@/src/lib/exposure";

// Loopback is enforced at the bind level (`next start --hostname 127.0.0.1`).
// The owner/session gate is the shared, path-based, deny-by-default Brain policy
// (`evaluateBrainMiddleware`); every page and API additionally re-checks the
// owner role server-side (requireBrainOwnerAuth).
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

  const decision = evaluateBrainMiddleware({
    pathname,
    url: request.url,
    headers: request.headers,
    cookies: request.cookies,
  });

  if (decision.action === "redirect-login") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = decision.redirectPath ?? "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl), process.env, {}, request);
  }

  if (decision.action === "block") {
    return applySecurityHeaders(
      NextResponse.json({ error: decision.error ?? "Zugriff verweigert." }, { status: decision.status ?? 403 }),
      process.env,
      {},
      request,
    );
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
