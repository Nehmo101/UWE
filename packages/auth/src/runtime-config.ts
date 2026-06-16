export type SessionCookieSameSite = "lax" | "strict" | "none";

export interface UweRuntimeConfig {
  isProduction: boolean;
  publicAppUrl: string | null;
  trustProxy: boolean;
  cloudflareTunnel: boolean;
  authRequired: boolean;
  sessionCookieSecure: boolean;
  sessionCookieSameSite: SessionCookieSameSite;
  allowedCorsOrigins: string[];
  setupToken: string | null;
  playerPreviewPublic: boolean;
  playerPreviewRequireToken: boolean;
  playerPreviewAllowDmOnly: boolean;
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

export function getUweRuntimeConfig(env: NodeJS.ProcessEnv = process.env): UweRuntimeConfig {
  const isProduction = isProductionEnv(env);
  const publicAppUrl = normalizePublicAppUrl(
    env.PUBLIC_BASE_URL ?? env.PUBLIC_APP_URL,
  );
  const publicHttps = publicAppUrl?.startsWith("https://") ?? false;

  const trustProxy = parseBoolEnv(env.TRUST_PROXY, isProduction && Boolean(publicAppUrl));
  const cloudflareTunnel = parseBoolEnv(env.CLOUDFLARE_TUNNEL, trustProxy);

  const sessionCookieSecure = parseBoolEnv(
    env.SESSION_COOKIE_SECURE,
    isProduction || publicHttps,
  );

  const setupToken = env.UWE_SETUP_TOKEN?.trim() || null;

  return {
    isProduction,
    publicAppUrl,
    trustProxy,
    cloudflareTunnel,
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
