/**
 * Central route policy for UWE public vs protected surfaces.
 *
 * Deny-by-default: unknown API routes are protected. App routes that read or
 * mutate private data require authentication unless explicitly listed as public.
 *
 * Supports both split deployments (Studio + Portal on separate origins/ports)
 * and unified reverse-proxy layouts (/studio/*, /players/*, /public-assets/*).
 */

export type UweAppSurface = "portal" | "studio" | "brain" | "family";

/**
 * Public routes on the owner-only Brain surface. Everything else is protected
 * (deny-by-default); the owner role itself is enforced server-side by the route
 * handlers (`requireBrainOwnerAuth`), never in the middleware.
 */
export const BRAIN_PUBLIC_ROUTES = ["/login", "/api/health", "/api/health/*"] as const;

/**
 * Public routes on the Family surface. Same shape as Brain — the difference is
 * which checkbox the handlers require (`family` instead of `brain`), and that
 * is enforced server-side, never in the middleware.
 *
 * Plus the ICS calendar subscription: a calendar app on a phone fetches the
 * feed without an `Authorization` header, so the secret sits in the path. It is
 * a dedicated read-only token type (`uwecal_…`), separately revocable and
 * stored only as a hash — the route handler resolves it, the middleware just
 * lets the request through.
 */
export const FAMILY_PUBLIC_ROUTES = [
  ...BRAIN_PUBLIC_ROUTES,
  "/api/calendar/feed/*",
] as const;

export type RouteAccess = "public" | "protected" | "protected-session";

export interface RouteClassification {
  access: RouteAccess;
  /** True when the route is not on any explicit allow/deny list (API only). */
  unknownApi: boolean;
  /** Normalized pathname used for matching. */
  pathname: string;
}

/** Portal app routes reachable without a player session (auth entry + anonymous share links). */
export const PUBLIC_PLAYER_APP_ROUTES = [
  "/login",
  "/logout",
  "/setup",
  "/forgot-password",
  "/reset-password",
  "/share",
  "/share/*",
] as const;

/** Public asset delivery (Portal serves via /api/assets; alias /public-assets for proxies). */
export const PUBLIC_ASSET_ROUTES = [
  "/public-assets",
  "/public-assets/*",
  "/api/assets/*/file",
] as const;

/** Portal API routes reachable without a player session. */
export const PUBLIC_PORTAL_API_ROUTES = [
  "/api/health",
  "/api/health/public",
  "/api/maintenance/status",
  "/api/maintenance/evaluate",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/two-factor/verify",
  "/api/auth/passkey/login/options",
  "/api/auth/passkey/login/verify",
  "/api/share",
  "/api/share/*",
] as const;

/** Portal app routes that require a logged-in player session. */
export const PORTAL_SESSION_APP_ROUTES = [
  "/",
  "/portal",
  "/worlds",
  "/worlds/*",
  "/players",
  "/players/*",
  "/auth",
  "/auth/*",
] as const;

/** Portal API routes that require a logged-in player session. */
export const PORTAL_SESSION_API_ROUTES = [
  "/api/auth/change-password",
  "/api/auth/preview",
  "/api/auth/session/touch",
  "/api/auth/two-factor",
  "/api/auth/two-factor/setup",
  "/api/auth/two-factor/activate",
  "/api/auth/two-factor/disable",
  "/api/auth/passkey/register/options",
  "/api/auth/passkey/register/verify",
  "/api/auth/passkey/credentials",
  "/api/auth/passkey/credentials/*",
  "/api/auth/google/unlink",
  "/api/assets/*/file",
  "/api/worlds",
  "/api/worlds/*/graph",
  "/api/worlds/*/characters/print",
] as const;

/** Studio API routes that require a logged-in session (not Bearer token). */
export const STUDIO_SESSION_API_ROUTES = [
  "/api/auth/change-password",
  "/api/auth/session/touch",
  "/api/auth/two-factor",
  "/api/auth/two-factor/setup",
  "/api/auth/two-factor/activate",
  "/api/auth/two-factor/disable",
  "/api/auth/passkey/register/options",
  "/api/auth/passkey/register/verify",
  "/api/auth/passkey/credentials",
  "/api/auth/passkey/credentials/*",
  "/api/auth/google/unlink",
  "/api/worlds",
] as const;

/** Studio/Admin prefixes in unified proxy layouts. */
export const STUDIO_APP_PREFIXES = ["/studio", "/studio/*"] as const;

/** Explicit protected route prefixes (deny without auth). */
export const PROTECTED_ROUTE_PREFIXES = [
  ...STUDIO_APP_PREFIXES,
  "/admin",
  "/admin/*",
  "/api/admin",
  "/api/admin/*",
  "/api/system",
  "/api/system/*",
  "/api/import",
  "/api/import/*",
  "/api/media/upload",
  "/api/media/upload/*",
  "/api/worlds/*/assets/upload",
  "/api/brain",
  "/api/brain/*",
  "/api/ai",
  "/api/ai/*",
  "/api/search",
  "/api/search/*",
  "/api/command/search",
  "/api/debug",
  "/api/debug/*",
  "/api/backup",
  "/api/backup/*",
  "/api/settings",
  "/api/export",
  "/api/export/*",
  "/api/mail",
  "/api/mail/*",
  "/api/jobs",
  "/api/jobs/*",
  "/api/ideas",
  "/api/ideas/*",
  "/api/projects",
  "/api/projects/*",
  "/api/calendar",
  "/api/calendar/*",
  "/api/dnd-api",
  "/api/dnd-generator",
  "/api/research",
  "/api/research/*",
  "/api/image-studio",
  "/api/inference",
  "/api/inference/*",
  "/api/health/private",
  "/api/worlds/*/brain",
  "/api/worlds/*/brain/*",
  "/api/worlds/*/graph",
  // Leseansicht einer Seite für den Session-Runner (Studio, nur lesend).
  //
  // `[pageSlug]` statt `*` am Ende ist kein Stilfrage: `matchesRoutePattern`
  // behandelt ein Muster, das auf `/*` endet, als reinen Präfixvergleich —
  // ein `*` weiter vorne wird dann nicht mehr ersetzt und das Muster trifft nie.
  "/api/worlds/*/reader/[pageSlug]",
  "/api/worlds/*/labels/*/export",
  "/api/worlds/*/print-lists/*/export",
  "/api/worlds/*/spotify/*",
] as const;

/** API routes that stay public even on Studio (health probes, OAuth callbacks). */
export const PUBLIC_STUDIO_API_ROUTES = [
  "/api/health",
  "/api/health/public",
  "/api/maintenance/status",
  "/api/maintenance/evaluate",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/setup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/two-factor/verify",
  "/api/auth/passkey/login/options",
  "/api/auth/passkey/login/verify",
  // "Mit Google anmelden" — start redirects to Google, callback returns from it
  // (the only registered redirect URI; the target app travels in the state).
  "/api/auth/google/start",
  "/api/auth/google/callback",
  "/api/spotify/callback",
  // Maschinenraum endpoints authenticate with their own connector token in
  // the route handler (authenticateConnector), not a user session — so they
  // stay public at the middleware layer.
  "/api/connectors/*",
] as const;

/** All Studio app routes are protected in production exposure scenarios. */
export const STUDIO_PROTECTED_APP_PREFIXES = ["/*"] as const;

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  const normalized = withoutQuery.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  return normalized.toLowerCase();
}

/**
 * Match a pathname against a pattern.
 * Segments: literal text or `[param]` wildcard for one segment; trailing `/*` matches rest.
 */
export function matchesRoutePattern(pathname: string, pattern: string): boolean {
  const normalizedPath = normalizePathname(pathname);
  const normalizedPattern = normalizePathname(pattern);

  if (normalizedPattern === "/*") {
    return true;
  }

  if (normalizedPattern.endsWith("/*")) {
    const prefix = normalizedPattern.slice(0, -2);
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  }

  const pathParts = normalizedPath.split("/").filter(Boolean);
  const patternParts = normalizedPattern.split("/").filter(Boolean);

  if (pathParts.length !== patternParts.length) {
    return false;
  }

  return patternParts.every((part, index) => {
    if (part.startsWith("[") && part.endsWith("]")) {
      return Boolean(pathParts[index]);
    }
    if (part === "*") {
      return Boolean(pathParts[index]);
    }
    return part === pathParts[index];
  });
}

function matchesAny(pathname: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesRoutePattern(pathname, pattern));
}

function stripUnifiedPrefix(pathname: string, prefix: "/studio" | "/players"): string {
  const normalized = normalizePathname(pathname);
  if (normalized === prefix) {
    return "/";
  }
  if (normalized.startsWith(`${prefix}/`)) {
    return normalizePathname(normalized.slice(prefix.length));
  }
  return normalized;
}

function resolvePathForSurface(pathname: string, surface: UweAppSurface): string {
  const normalized = normalizePathname(pathname);

  if (surface === "portal") {
    if (normalized === "/players") {
      return "/worlds";
    }
    if (normalized.startsWith("/players/")) {
      return normalizePathname(`/worlds/${normalized.slice("/players/".length)}`);
    }
  }

  if (surface === "studio") {
    const asStudio = stripUnifiedPrefix(normalized, "/studio");
    if (asStudio !== normalized) {
      return asStudio;
    }
  }

  if (normalized.startsWith("/public-assets/")) {
    const assetId = normalized.slice("/public-assets/".length).split("/")[0];
    if (assetId) {
      return `/api/assets/${assetId}/file`;
    }
  }

  return normalized;
}

export function isApiRoute(pathname: string): boolean {
  return normalizePathname(pathname).startsWith("/api/");
}

export function classifyRoute(pathname: string, surface: UweAppSurface): RouteClassification {
  const resolved = resolvePathForSurface(pathname, surface);

  if (isApiRoute(resolved)) {
    return classifyApiRoute(resolved, surface);
  }

  return classifyAppRoute(resolved, surface);
}

function classifyApiRoute(resolved: string, surface: UweAppSurface): RouteClassification {
  if (surface === "portal") {
    if (matchesAny(resolved, PUBLIC_PORTAL_API_ROUTES)) {
      return { access: "public", unknownApi: false, pathname: resolved };
    }
    if (matchesAny(resolved, PORTAL_SESSION_API_ROUTES)) {
      return { access: "protected-session", unknownApi: false, pathname: resolved };
    }
    if (matchesAny(resolved, PROTECTED_ROUTE_PREFIXES)) {
      return { access: "protected", unknownApi: false, pathname: resolved };
    }
    return { access: "protected", unknownApi: true, pathname: resolved };
  }

  if (surface === "brain" || surface === "family") {
    if (matchesAny(resolved, BRAIN_PUBLIC_ROUTES)) {
      return { access: "public", unknownApi: false, pathname: resolved };
    }
    // Checkbox-gated surface: every other API is protected; unknown APIs
    // deny-by-default.
    const known = matchesAny(resolved, PROTECTED_ROUTE_PREFIXES);
    return { access: "protected", unknownApi: !known, pathname: resolved };
  }

  if (matchesAny(resolved, PUBLIC_STUDIO_API_ROUTES)) {
    return { access: "public", unknownApi: false, pathname: resolved };
  }

  if (matchesAny(resolved, STUDIO_SESSION_API_ROUTES)) {
    return { access: "protected-session", unknownApi: false, pathname: resolved };
  }

  if (matchesAny(resolved, PROTECTED_ROUTE_PREFIXES)) {
    return { access: "protected", unknownApi: false, pathname: resolved };
  }

  return { access: "protected", unknownApi: true, pathname: resolved };
}

function classifyAppRoute(resolved: string, surface: UweAppSurface): RouteClassification {
  if (surface === "portal") {
    if (matchesAny(resolved, PUBLIC_PLAYER_APP_ROUTES)) {
      return { access: "public", unknownApi: false, pathname: resolved };
    }
    if (matchesAny(resolved, PORTAL_SESSION_APP_ROUTES)) {
      return { access: "protected-session", unknownApi: false, pathname: resolved };
    }
    if (matchesAny(resolved, STUDIO_APP_PREFIXES) || matchesAny(resolved, PROTECTED_ROUTE_PREFIXES)) {
      return { access: "protected", unknownApi: false, pathname: resolved };
    }
    return { access: "protected", unknownApi: false, pathname: resolved };
  }

  if (surface === "brain" || surface === "family") {
    if (matchesAny(resolved, BRAIN_PUBLIC_ROUTES)) {
      return { access: "public", unknownApi: false, pathname: resolved };
    }
    // Checkbox-gated pages: require a session (redirect to /login); the handler
    // then enforces the checkbox. Deny-by-default for everything non-public.
    return { access: "protected-session", unknownApi: false, pathname: resolved };
  }

  if (matchesAny(resolved, PUBLIC_PLAYER_APP_ROUTES)) {
    return { access: "public", unknownApi: false, pathname: resolved };
  }

  if (
    matchesAny(resolved, STUDIO_PROTECTED_APP_PREFIXES) ||
    matchesAny(resolved, PROTECTED_ROUTE_PREFIXES) ||
    matchesAny(resolved, ["/admin", "/admin/*"])
  ) {
    return { access: "protected", unknownApi: false, pathname: resolved };
  }

  return { access: "protected", unknownApi: false, pathname: resolved };
}

export function isPublicRoute(pathname: string, surface: UweAppSurface): boolean {
  return classifyRoute(pathname, surface).access === "public";
}

export function requiresPortalSession(pathname: string): boolean {
  const resolved = resolvePathForSurface(pathname, "portal");
  if (isApiRoute(resolved)) {
    return classifyApiRoute(resolved, "portal").access === "protected-session";
  }
  return classifyAppRoute(resolved, "portal").access === "protected-session";
}

export function requiresStudioAuth(pathname: string): boolean {
  const classification = classifyRoute(pathname, "studio");
  return classification.access !== "public";
}

export function isUnknownProtectedApi(pathname: string, surface: UweAppSurface): boolean {
  const classification = classifyRoute(pathname, surface);
  return isApiRoute(classification.pathname) && classification.unknownApi && classification.access !== "public";
}

export function isGuestWikiPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (normalized === "/players" || normalized.startsWith("/players/")) {
    return true;
  }

  const resolved = resolvePathForSurface(pathname, "portal");
  return resolved === "/worlds" || resolved.startsWith("/worlds/");
}
