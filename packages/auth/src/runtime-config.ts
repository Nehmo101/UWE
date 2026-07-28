// Re-export session cookie names so internal imports from this module stay valid.
// Agents often colocate these with getSessionCookieOptions / getUweRuntimeConfig.
export { PREVIEW_COOKIE_NAME, SESSION_COOKIE_NAME } from "./session";
import { withRuntimeEnvOverrides } from "./runtime-env-overrides";

export type SessionCookieSameSite = "lax" | "strict" | "none";

export interface UweRuntimeConfig {
  isProduction: boolean;
  publicAppUrl: string | null;
  trustProxy: boolean;
  cloudflareTunnel: boolean;
  studioPath: string;
  portalPath: string;
  authRequired: boolean;
  sessionCookieSecure: boolean;
  sessionCookieSameSite: SessionCookieSameSite;
  /**
   * Optional cookie `Domain`. Unset = host-only (default). Set to a registrable
   * domain (e.g. `.uweanddragons.org`) to share the session across all its
   * subdomains — enables one sign-in on the apex landing to be valid on both
   * `studio.` and `portal.` (SSO). Only set this for domains you fully control.
   */
  sessionCookieDomain: string | null;
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
  /** Explicit Brain host (NEXT_PUBLIC_BRAIN_URL), when Brain is served on its
   * own hostname. null keeps Brain on the Studio origin (/life-brain). */
  brainUrl: string | null;
  studioPath: string;
  portalPath: string;
  deploymentModel: UweDeploymentModel;
}

export type UweDeploymentModel = "split-hostname" | "unified-path" | "local";

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: SessionCookieSameSite;
  secure: boolean;
  path: string;
  /** Cookie `Domain` when a domain-wide (cross-subdomain) session is configured. */
  domain?: string;
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

/**
 * Normalize SESSION_COOKIE_DOMAIN. Empty/unset → null (host-only cookie).
 * Accepts `example.org` or `.example.org` (leading dot = all subdomains).
 */
function normalizeCookieDomain(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  // Guard against obvious mistakes (scheme, path, port, whitespace).
  if (/[/:\s]/.test(trimmed)) {
    return null;
  }
  return trimmed;
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

function normalizeAppPath(
  value: string | undefined,
  fallback: string,
  options?: { allowRoot?: boolean },
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  if (trimmed === "/") {
    return options?.allowRoot ? "/" : fallback;
  }
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, "") || fallback;
}

const DEV_STUDIO_URL = "http://localhost:3000";
const DEV_PORTAL_URL = "http://localhost:3001";
const DEV_BRAIN_URL = "http://localhost:3002";
const DEV_FAMILY_URL = "http://localhost:3004";

function parsePublicUrlHost(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed).host.toLowerCase();
  } catch {
    return null;
  }
}

/** True when Portal and Studio are configured on different public hostnames. */
export function isSplitHostnameDeployment(env: NodeJS.ProcessEnv = process.env): boolean {
  env = withRuntimeEnvOverrides(env);
  const explicitStudio = env.NEXT_PUBLIC_STUDIO_URL?.trim();
  const explicitPortal = env.NEXT_PUBLIC_PORTAL_URL?.trim();
  if (explicitStudio && explicitPortal) {
    const studioHost = parsePublicUrlHost(explicitStudio);
    const portalHost = parsePublicUrlHost(explicitPortal);
    return Boolean(studioHost && portalHost && studioHost !== portalHost);
  }

  const runtime = getUweRuntimeConfig(env);
  if (!runtime.publicAppUrl || !explicitStudio) {
    return false;
  }

  const publicHost = parsePublicUrlHost(runtime.publicAppUrl);
  const studioHost = parsePublicUrlHost(explicitStudio);
  return Boolean(publicHost && studioHost && publicHost !== studioHost);
}

export function getUweDeploymentModel(env: NodeJS.ProcessEnv = process.env): UweDeploymentModel {
  env = withRuntimeEnvOverrides(env);
  if (isSplitHostnameDeployment(env)) {
    return "split-hostname";
  }

  const runtime = getUweRuntimeConfig(env);
  if (runtime.publicAppUrl) {
    return "unified-path";
  }

  return "local";
}

function resolveEffectiveAppPaths(
  env: NodeJS.ProcessEnv,
  runtime: UweRuntimeConfig,
): Pick<UweAppUrls, "studioPath" | "portalPath" | "deploymentModel"> {
  const deploymentModel = getUweDeploymentModel(env);

  if (deploymentModel === "split-hostname") {
    return {
      studioPath: "/",
      portalPath: "/",
      deploymentModel,
    };
  }

  return {
    studioPath: runtime.studioPath,
    portalPath: runtime.portalPath,
    deploymentModel,
  };
}

export function resolveStudioPublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const urls = resolveUweAppUrls(env);
  return (urls.studioUrl ?? DEV_STUDIO_URL).replace(/\/$/, "");
}

export function resolvePortalPublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const urls = resolveUweAppUrls(env);
  return (urls.portalUrl ?? DEV_PORTAL_URL).replace(/\/$/, "");
}

/**
 * Public base URL for the owner-only Brain surface. Brain now runs as its own
 * local app (`apps/brain`, default `http://localhost:3002`), so it defaults to
 * that loopback origin. An explicit `NEXT_PUBLIC_BRAIN_URL` can point it at a
 * chosen LAN address after owner opt-in.
 *
 * Per ADR 004/007 Brain is owner-only; its reachability is an explicit
 * deployment choice (loopback / LAN / a public origin behind the owner-gated
 * tunnel). Set `NEXT_PUBLIC_BRAIN_URL` to that origin when Brain is published —
 * otherwise a remote visitor's link points at the loopback default and is
 * intentionally not reachable. This resolver only computes a link target.
 */
export function resolveBrainPublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicitBrain = withRuntimeEnvOverrides(env).NEXT_PUBLIC_BRAIN_URL?.trim()?.replace(/\/$/, "");
  if (explicitBrain) {
    return explicitBrain;
  }
  return DEV_BRAIN_URL;
}

/**
 * Public base URL der Family-App (Abschnitt G). Wie Brain eine eigene lokale
 * App, nur nicht owner-privat: Zugang hat, wer das Häkchen `Family` trägt.
 * Ohne `NEXT_PUBLIC_FAMILY_URL` zeigt der Link auf den Loopback-Standard und
 * ist von außen absichtlich nicht erreichbar — dieser Resolver berechnet nur
 * das Ziel, nicht die Erreichbarkeit.
 */
export function resolveFamilyPublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = withRuntimeEnvOverrides(env).NEXT_PUBLIC_FAMILY_URL?.trim()?.replace(/\/$/, "");
  return explicit || DEV_FAMILY_URL;
}

/** Logged-in Portal entry — relative on Portal, absolute when linked from Studio. */
export function resolvePortalSessionHref(
  env: NodeJS.ProcessEnv = process.env,
  options: { currentApp?: "studio" | "portal" } = {},
): string {
  const currentApp = options.currentApp ?? "studio";
  const urls = resolveUweAppUrls(env);
  const portalBase = resolvePortalPublicBaseUrl(env);
  const entryPath = urls.deploymentModel === "split-hostname" ? "/auth/worlds" : "/portal";

  if (currentApp === "portal") {
    return entryPath;
  }

  if (urls.deploymentModel === "split-hostname") {
    return `${portalBase}${entryPath}`;
  }

  if (urls.portalPath === "/") {
    return `${portalBase}${entryPath}`;
  }

  if (portalBase.endsWith(urls.portalPath)) {
    return portalBase;
  }

  return `${portalBase}${entryPath}`;
}

/** Portal login — relative on Portal, absolute when linked from Studio. */
export function resolvePortalLoginHref(
  env: NodeJS.ProcessEnv = process.env,
  options: { currentApp?: "studio" | "portal" } = {},
): string {
  const currentApp = options.currentApp ?? "studio";
  if (currentApp === "portal") {
    return "/login";
  }
  return `${resolvePortalPublicBaseUrl(env)}/login`;
}

/**
 * Logged-in Studio work area — not the marketing landing at `/`.
 *
 * Die Welten-Liste, nicht mehr „Heute": das Daily Admin OS liegt in Brain
 * (Abschnitt H1), Studio ist DM-Werkzeug.
 */
export const STUDIO_SESSION_ENTRY_PATH = "/worlds";

/** Legacy unified-path mount; `/studio` redirects to {@link STUDIO_SESSION_ENTRY_PATH}. */
const STUDIO_LEGACY_MOUNT_PATH = "/studio";

/** Logged-in Studio entry — relative on Studio, absolute when linked from Portal. */
export function resolveStudioSessionHref(
  env: NodeJS.ProcessEnv = process.env,
  options: { currentApp?: "studio" | "portal" } = {},
): string {
  const currentApp = options.currentApp ?? "studio";
  const urls = resolveUweAppUrls(env);
  const studioBase = resolveStudioPublicBaseUrl(env);
  const entryPath =
    urls.deploymentModel === "split-hostname"
      ? STUDIO_SESSION_ENTRY_PATH
      : STUDIO_LEGACY_MOUNT_PATH;

  if (currentApp === "studio") {
    return entryPath;
  }

  if (urls.deploymentModel === "split-hostname") {
    return `${studioBase}${entryPath}`;
  }

  if (studioBase.endsWith(urls.studioPath)) {
    return studioBase;
  }

  return `${studioBase}${entryPath}`;
}

export function resolveUweAppUrls(env: NodeJS.ProcessEnv = process.env): UweAppUrls {
  env = withRuntimeEnvOverrides(env);
  const runtime = getUweRuntimeConfig(env);
  const pathInfo = resolveEffectiveAppPaths(env, runtime);

  const explicitStudio = env.NEXT_PUBLIC_STUDIO_URL?.trim()?.replace(/\/$/, "");
  const explicitPortal = env.NEXT_PUBLIC_PORTAL_URL?.trim()?.replace(/\/$/, "");
  const explicitBrain = env.NEXT_PUBLIC_BRAIN_URL?.trim()?.replace(/\/$/, "") || null;

  if (explicitStudio && explicitPortal) {
    return {
      publicBaseUrl: runtime.publicAppUrl,
      studioUrl: explicitStudio,
      portalUrl: explicitPortal,
      brainUrl: explicitBrain,
      studioPath: pathInfo.studioPath,
      portalPath: pathInfo.portalPath,
      deploymentModel: pathInfo.deploymentModel,
    };
  }

  if (runtime.publicAppUrl) {
    const base = runtime.publicAppUrl.replace(/\/$/, "");
    return {
      publicBaseUrl: base,
      studioUrl: pathInfo.deploymentModel === "split-hostname" && explicitStudio
        ? explicitStudio
        : `${base}${runtime.studioPath}`,
      portalUrl:
        pathInfo.deploymentModel === "split-hostname" && explicitPortal
          ? explicitPortal
          : runtime.portalPath === "/"
            ? base
            : `${base}${runtime.portalPath}`,
      brainUrl: explicitBrain,
      studioPath: pathInfo.studioPath,
      portalPath: pathInfo.portalPath,
      deploymentModel: pathInfo.deploymentModel,
    };
  }

  return {
    publicBaseUrl: null,
    studioUrl: explicitStudio ?? null,
    portalUrl: explicitPortal ?? null,
    brainUrl: explicitBrain,
    studioPath: pathInfo.studioPath,
    portalPath: pathInfo.portalPath,
    deploymentModel: pathInfo.deploymentModel,
  };
}

function isLoopbackUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function getUweRuntimeConfig(env: NodeJS.ProcessEnv = process.env): UweRuntimeConfig {
  env = withRuntimeEnvOverrides(env);
  const isProduction = isProductionEnv(env);
  const publicAppUrl = normalizePublicAppUrl(
    env.PUBLIC_BASE_URL ?? env.PUBLIC_APP_URL,
  );
  const publicHttps = publicAppUrl?.startsWith("https://") ?? false;
  const publicLoopback = isLoopbackUrl(publicAppUrl);

  const trustProxy = parseBoolEnv(
    env.TRUST_PROXY,
    isProduction && Boolean(publicAppUrl) && !publicLoopback,
  );
  const cloudflareTunnel = parseBoolEnv(env.CLOUDFLARE_TUNNEL, trustProxy);

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
    studioPath: normalizeAppPath(env.STUDIO_PATH, "/studio"),
    portalPath: normalizeAppPath(env.PORTAL_PATH, "/portal", { allowRoot: true }),
    authRequired: parseBoolEnv(env.AUTH_REQUIRED, isProduction),
    sessionCookieSecure,
    sessionCookieSameSite: parseSameSite(env.SESSION_COOKIE_SAMESITE),
    sessionCookieDomain: normalizeCookieDomain(env.SESSION_COOKIE_DOMAIN),
    allowedCorsOrigins: parseAllowedCorsOrigins(env.ALLOWED_CORS_ORIGINS),
    setupToken,
    playerPreviewPublic: parseBoolEnv(env.PLAYER_PREVIEW_PUBLIC, !isProduction),
    playerPreviewRequireToken: parseBoolEnv(env.PLAYER_PREVIEW_REQUIRE_TOKEN, isProduction),
    playerPreviewAllowDmOnly: parseBoolEnv(env.PLAYER_PREVIEW_ALLOW_DM_ONLY, false),
  };
}

export function isPublicExposureConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const config = getUweRuntimeConfig(env);
  return config.cloudflareTunnel || Boolean(config.publicAppUrl && !isLoopbackUrl(config.publicAppUrl));
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
    ...(config.sessionCookieDomain ? { domain: config.sessionCookieDomain } : {}),
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

  const urls = resolveUweAppUrls(env);
  for (const candidate of [urls.publicBaseUrl, urls.studioUrl, urls.portalUrl, urls.brainUrl]) {
    if (!candidate) {
      continue;
    }
    try {
      hosts.add(new URL(candidate).host.toLowerCase());
    } catch {
      // ignore invalid URL
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
