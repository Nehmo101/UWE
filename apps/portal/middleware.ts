import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  applySecurityHeaders,
  evaluatePortalMiddleware,
  isCrossSiteBrowserRequest,
} from "@uwe/auth";

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

export function middleware(request: NextRequest) {
  const crossOriginError = rejectCrossOriginApiRequest(request);
  if (crossOriginError) {
    return crossOriginError;
  }

  const decision = evaluatePortalMiddleware({
    pathname: request.nextUrl.pathname,
    url: request.url,
    headers: request.headers,
    cookies: request.cookies,
  });

  if (decision.action === "allow") {
    return applySecurityHeaders(
      NextResponse.next(),
      process.env,
      { allowYouTubeEmbeds: true },
      request,
    );
  }

  if (decision.action === "redirect-login") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = decision.redirectPath ?? "/login";
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
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
    "/portal",
    "/worlds/:path*",
    "/players/:path*",
    "/auth/:path*",
    "/share/:path*",
    "/public-assets/:path*",
    "/api/:path*",
  ],
};
