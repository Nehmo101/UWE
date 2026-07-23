import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applySecurityHeaders, evaluateBrainMiddleware, resolveBrainPublicBaseUrl } from "@uwe/auth";
import { isBrainEntryEnabled, resolveBrainExposure } from "@/src/lib/exposure";

// Brain binds to loopback (`next start --hostname 127.0.0.1`), so Next resolves
// `request.nextUrl` to `localhost:<port>` and ignores the forwarded Host header —
// a login redirect built from it would send a tunnel visitor to an unreachable
// `https://localhost:3102/login`. When a public Brain origin is configured
// (NEXT_PUBLIC_BRAIN_URL, e.g. https://brain.uweanddragons.org) rebase the login
// redirect onto it; local-only deployments (loopback origin) keep the raw URL,
// which a local browser can still reach.
function buildBrainLoginUrl(request: NextRequest, redirectPath: string, pathname: string): URL {
  const loginUrl = request.nextUrl.clone();
  const publicBase = resolveBrainPublicBaseUrl(process.env);
  try {
    const base = new URL(publicBase);
    const host = base.hostname.toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
      loginUrl.protocol = base.protocol;
      loginUrl.host = base.host;
    }
  } catch {
    // Malformed public URL — fall back to the request-derived origin.
  }
  loginUrl.pathname = redirectPath;
  loginUrl.search = "";
  loginUrl.searchParams.set("redirect", pathname);
  return loginUrl;
}

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
    const loginUrl = buildBrainLoginUrl(request, decision.redirectPath ?? "/login", pathname);
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
