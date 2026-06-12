import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Request guard for sensitive Studio API routes (backup, restore, import,
 * settings, AI, export, uploads).
 *
 * Studio intentionally has no user login — the SECURITY.md trust model is
 * "restrict Studio to trusted networks". This guard adds two protections on
 * top of that model:
 *
 * 1. CSRF protection (always on): browser requests from foreign origins are
 *    rejected. Without this, any website opened in the DM's browser could
 *    silently trigger backup restores, imports, or settings changes against
 *    a LAN-hosted Studio.
 *
 * 2. Optional API token: when STUDIO_API_TOKEN is set, non-browser clients
 *    (scripts, curl, remote tools) must send `Authorization: Bearer <token>`.
 *    Same-origin requests from the Studio UI itself stay token-free, since UI
 *    access is already governed by network-level trust.
 */
export function requireStudioApiAuth(request: Request): NextResponse | null {
  if (isCrossSiteBrowserRequest(request)) {
    return NextResponse.json(
      { error: "Cross-Origin-Anfragen an die Studio-API sind nicht erlaubt." },
      { status: 403 },
    );
  }

  const requiredToken = process.env.STUDIO_API_TOKEN;
  if (!requiredToken) {
    return null;
  }

  if (isSameOriginBrowserRequest(request) || hasValidBearerToken(request, requiredToken)) {
    return null;
  }

  return NextResponse.json(
    { error: "Studio-API-Token erforderlich (Authorization: Bearer …)." },
    { status: 401 },
  );
}

function isCrossSiteBrowserRequest(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    // Non-browser clients (curl, scripts) send no Origin header.
    return false;
  }

  return !originMatchesHost(origin, request.headers.get("host"));
}

function isSameOriginBrowserRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "same-origin") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    return originMatchesHost(origin, request.headers.get("host"));
  }

  return false;
}

function originMatchesHost(origin: string, host: string | null): boolean {
  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function hasValidBearerToken(request: Request, requiredToken: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(requiredToken);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
