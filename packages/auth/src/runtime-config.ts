// Re-export session cookie names so internal imports from this module stay valid.
// Agents often colocate these with getSessionCookieOptions / getUweRuntimeConfig.
export { PREVIEW_COOKIE_NAME, SESSION_COOKIE_NAME } from "./session";

export type SessionCookieSameSite = "lax" | "strict" | "none";

export interface UweRuntimeConfig {
  isProduction: boolean;
  publicAppUrl: string | null;
  trustProxy: boolean;
  cloudflareTunnel: boolean;
  cloudflareAccessEnabled: boolean;
  studioPath: string;
  portalPath: string;
  authRequired: boolean;
  sessionCookieSecure: boolean;
  sessionCookieSameSite: SessionCookieSameSite;
  allowedCorsOrigins: string[];
  setupToken: string | null;
  playerPreviewPublic: boolean;
  playerPreviewRequireToken: boolean;
  playerPreviewAllowDmOnly: boolean;
}

export interface UweAppUrls {
  publicBaseUrl: string | null;
  studioUrl: string | null;
  portalUrl: string | null;
  studioPath: string;
  portalPath: string;
}

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: SessionCookieSameSite;
  secure: boolean;
  path: string;
}

function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return defaultValue;
}

function parseSameSite(value: string | undefined): SessionCookieSameSite {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "strict" || normalized === "none") {
    return normalized;
  }
  return "lax";
}

function parseAllowedCorsOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  const origins: string[] = [];
  for (const part of value.split(",")) {
    const origin = part.trim();
    if (!origin) {
      continue;
    }

    try {
      origins.push(new URL(origin).toString().replace(/\/$/, ""));
    } catch {
      // ignore invalid origins — default remains same-origin only
    }
  }

  return origins;
}

function normalizePublicAppUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV?.trim() === "production";
}

function normalizeAppPath(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return fallback;
  }
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, "") || fallback;
}

export function resolveUweAppUrls(env: NodeJS.ProcessEnv = process.env): UweAppUrls {
  const runtime = getUweRuntimeConfig(env);
  const studioPath = runtime.studioPath;
  const portalPath = runtime.portalPath;

  const explicitStudio = env.NEXT_PUBLIC_STUDIO_URL?.trim()?.replace(/\/$/, "");
  const explicitPortal = env.NEXT_PUBLIC_PORTAL_URL?.trim()?.replace(/\/$/, "");

  if (explicitStudio && explicitPortal) {
    return {
      publicBaseUrl: runtime.publicAppUrl,
      studioUrl: explicitStudio,
      portalUrl: explicitPortal,
      studioPath,
      portalPath,
    };
  }

  if (runtime.publicAppUrl) {
    const base = runtime.publicAppUrl.replace(/\/$/, "");
    return {
      publicBaseUrl: base,
      studioUrl: `${base}${studioPath}`,
      portalUrl: `${base}${portalPath}`,
      studioPath,
      portalPath,
    };
  }

  return {
    publicBaseUrl: null,
    studioUrl: explicitStudio ?? null,
    portalUrl: explicitPortal ?? null,
    studioPath,
    portalPath,
  };
}

export function getUweRuntimeConfig(env: NodeJS.ProcessEnv = process.env): UweRuntimeConfig {
  const isProduction = isProductionEnv(env);
  const publicAppUrl = normalizePublicAppUrl(
    env.PUBLIC_BASE_URL ?? env.PUBLIC_APP_URL,
  );
  const publicHttps = publicAppUrl?.startsWith("https://") ?? false;

  const trustProxy = parseBoolEnv(env.TRUST_PROXY, isProduction && Boolean(publicAppUrl));
  const cloudflareTunnel = parseBoolEnv(env.CLOUDFLARE_TUNNEL, trustProxy);
  const cloudflareAccessEnabled = parseBoolEnv(env.CLOUDFLARE_ACCESS_ENABLED, false);

  const sessionCookieSecure = parseBoolEnv(
    env.SESSION_COOKIE_SECURE,
    publicHttps,
  );

  const setupToken = env.UWE_SETUP_TOKEN?.trim() || null;

  return {
    isProduction,
    publicAppUrl,
    trustProxy,
    cloudflareTunnel,
    cloudflareAccessEnabled,
    studioPath: normalizeAppPath(env.STUDIO_PATH, "/studio"),
    portalPath: normalizeAppPath(env.PORTAL_PATH, "/portal"),
    authRequired: parseBoolEnv(env.AUTH_REQUIRED, isProduction),
    sessionCookieSecure,
    sessionCookieSameSite: parseSameSite(env.SESSION_COOKIE_SAMESITE),
    allowedCorsOrigins: parseAllowedCorsOrigins(env.ALLOWED_CORS_ORIGINS),
    setupToken,
    playerPreviewPublic: parseBoolEnv(env.PLAYER_PREVIEW_PUBLIC, !isProduction),
    playerPreviewRequireToken: parseBoolEnv(env.PLAYER_PREVIEW_REQUIRE_TOKEN, isProduction),
    playerPreviewAllowDmOnly: parseBoolEnv(env.PLAYER_PREVIEW_ALLOW_DM_ONLY, false),
  };
}

export function isPublicExposureConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const config = getUweRuntimeConfig(env);
  return Boolean(config.publicAppUrl) || config.cloudflareTunnel;
}

export function getSessionCookieOptions(
  env: NodeJS.ProcessEnv = process.env,
): SessionCookieOptions {
  const config = getUweRuntimeConfig(env);

  return {
    httpOnly: true,
    sameSite: config.sessionCookieSameSite,
    secure: config.sessionCookieSecure,
    path: "/",
  };
}

export interface RequestLikeForCookieOptions {
  url: string;
  headers: Headers;
}

/**
 * Whether the incoming request was made over HTTPS (directly or via trusted proxy headers).
 */
export function isRequestSecure(
  request: RequestLikeForCookieOptions,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const { trustProxy } = getUweRuntimeConfig(env);

  if (trustProxy) {
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    if (forwardedProto === "https") {
      return true;
    }
    if (forwardedProto === "http") {
      return false;
    }
  }

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Session cookie options adjusted for the actual request transport.
 * Browsers ignore Secure cookies on plain HTTP — without this, login appears to succeed
 * but the session is never stored (silent redirect loop back to /login).
 */
export function getSessionCookieOptionsForRequest(
  request: RequestLikeForCookieOptions,
  env: NodeJS.ProcessEnv = process.env,
): SessionCookieOptions {
  const base = getSessionCookieOptions(env);
  const requestSecure = isRequestSecure(request, env);

  if (base.secure && !requestSecure) {
    return {
      ...base,
      secure: false,
      sameSite: base.sameSite === "none" ? "lax" : base.sameSite,
    };
  }

  return base;
}

export function getOAuthStateCookieOptions(
  cookiePath: string,
  env: NodeJS.ProcessEnv = process.env,
): SessionCookieOptions {
  const base = getSessionCookieOptions(env);
  return {
    ...base,
    path: cookiePath,
  };
}

export function getAllowedCorsOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(getUweRuntimeConfig(env).allowedCorsOrigins);
}

export function getTrustedRequestHosts(
  requestHost: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  const hosts = new Set<string>();

  if (requestHost?.trim()) {
    hosts.add(requestHost.trim().toLowerCase());
  }

  const publicAppUrl = getUweRuntimeConfig(env).publicAppUrl;
  if (publicAppUrl) {
    try {
      hosts.add(new URL(publicAppUrl).host.toLowerCase());
    } catch {
      // ignore invalid PUBLIC_APP_URL — already normalized to null in config
    }
  }

  return hosts;
}

export function originMatchesTrustedHost(
  origin: string,
  requestHost: string | null,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    const originHost = new URL(origin).host.toLowerCase();
    return getTrustedRequestHosts(requestHost, env).has(originHost);
  } catch {
    return false;
  }
}
