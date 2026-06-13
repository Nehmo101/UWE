import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getUweRuntimeConfig,
  isProductionEnv,
  SESSION_COOKIE_NAME,
} from "@uwe/auth";

function isGuestWikiPath(pathname: string): boolean {
  return pathname === "/worlds" || pathname.startsWith("/worlds/");
}

function requiresAuthenticatedPortalAccess(): boolean {
  const config = getUweRuntimeConfig();
  return config.isProduction && (config.authRequired || !config.playerPreviewPublic);
}

export function middleware(request: NextRequest) {
  if (!isProductionEnv()) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (!isGuestWikiPath(pathname)) {
    return NextResponse.next();
  }

  if (!requiresAuthenticatedPortalAccess()) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/worlds", "/worlds/:path*"],
};
