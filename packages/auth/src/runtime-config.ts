// Re-export session cookie names so internal imports from this module stay valid.
// Agents often colocate these with getSessionCookieOptions / getUweRuntimeConfig.
export { PREVIEW_COOKIE_NAME, SESSION_COOKIE_NAME } from "./session";
import { withRuntimeEnvOverrides } from "./runtime-env-overrides";
import type { SessionCookieSameSite } from "./runtime-env-parse";
import {
  isLoopbackUrl,
  normalizeAppPath,
  normalizeCookieDomain,
  normalizePublicAppUrl,
  parseAllowedCorsOrigins,
  parseBoolEnv,
  parseIntEnv,
  parsePublicUrlHost,
  parseSameSite,
} from "./runtime-env-parse";

export type { SessionCookieSameSite } from "./runtime-env-parse";

export interface UweRuntimeConfig {
  isProduction: boolean;
  publicAppUrl: string | null;
  trustProxy: boolean;
  cloudflareTunnel: boolean;
  /**
   * How many proxy hops to trust when reading `X-Forwarded-For` from the right.
   * Cloudflare appends exactly one element (the real client), so the default is
   * 1. Raise it only when another trusted proxy sits between Cloudflare and the
   * app (e.g. cloudflared → nginx → app).
   */
  trustedProxyHops: number;
  studioPath: string;
  portalPath: string;
  authRequired: boolean;
  sessionCookieSecure: boolean;
  sessionCookieSameSite: SessionCookieSameSite;
  /**
   * Optional cookie `Domain`. Unset = host-only (default). Set to a registrable
   * domain (e.g. `.uwe.example`) to share the session across all its
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

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV?.trim() === "production";
}

const DEV_STUDIO_URL = "http://localhost:3000";
const DEV_PORTAL_URL = "http://localhost:3001";
const DEV_BRAIN_URL = "http://localhost:3002";
const DEV_FAMILY_URL = "http://localhost:3004";

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

/** Geschwister-Subdomains im Split-Hostname-Layout (studio./portal./brain.). */
const APP_SUBDOMAIN_LABELS = ["portal", "studio", "brain"] as const;

/**
 * Leitet den Apex-Origin aus einer Geschwister-App ab (nur Split-Hostname).
 *
 * Warum überhaupt raten: In einem Split-Hostname-Deployment ist ein
 * Loopback-Standard garantiert falsch — ein Besucher von `portal.uwe.example`
 * kann `http://localhost:3004` nie erreichen. Läuft Portal (oder Studio) unter
 * `portal.<apex>` ohne eigenen Port, dann ist `<apex>` die dokumentierte
 * Konvention derselben Installation (deploy/cloudflare/config.yml.example) und
 * damit die einzig sinnvolle Vorgabe. Ein explizit gesetzter Wert gewinnt
 * immer.
 */
function deriveApexOriginFromSiblings(
  env: NodeJS.ProcessEnv,
): { protocol: string; host: string } | null {
  if (!isSplitHostnameDeployment(env)) {
    return null;
  }

  for (const candidate of [env.NEXT_PUBLIC_PORTAL_URL, env.NEXT_PUBLIC_STUDIO_URL]) {
    const trimmed = candidate?.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const url = new URL(trimmed);
      // Eigener Port = kein Reverse-Proxy-Layout, sondern Ports auf einem Host.
      // Dann sagt der Geschwister-Hostname nichts über den Apex aus.
      if (url.port) {
        continue;
      }
      // Labelweise zerlegen und das erste Label **exakt** vergleichen. Ein
      // Präfix-Test auf der ganzen Adresse (`startsWith("portal.")`) täte hier
      // dasselbe, liest sich für einen Prüfer aber wie eine unvollständige
      // URL-Prüfung — und genau die ist der klassische Weg, an einer
      // Hostnamen-Prüfung vorbeizukommen.
      const [subdomain, ...apexLabels] = url.hostname.toLowerCase().split(".");
      if (!subdomain || !APP_SUBDOMAIN_LABELS.some((entry) => entry === subdomain)) {
        continue;
      }
      // Weniger als zwei Labels wäre ein reiner Hostname (LAN) — dort gibt es
      // keine Subdomain-Konvention, auf die man sich verlassen könnte.
      if (apexLabels.length < 2) {
        continue;
      }
      return { protocol: url.protocol, host: apexLabels.join(".") };
    } catch {
      // Ungültige Geschwister-URL — nächste Quelle versuchen.
    }
  }

  return null;
}

/**
 * Leitet die Family-Origin aus einer Geschwister-App ab, solange
 * `NEXT_PUBLIC_FAMILY_URL` fehlt: `family.<apex>`.
 *
 * Bewusst nicht für Brain: dessen Erreichbarkeit ist eine ausdrückliche
 * Owner-Entscheidung (ADR 004/007), Family hängt dagegen am Häkchen.
 */
function deriveFamilyUrlFromSiblings(env: NodeJS.ProcessEnv): string | null {
  const apex = deriveApexOriginFromSiblings(env);
  return apex ? `${apex.protocol}//family.${apex.host}` : null;
}

/**
 * Public base URL der Family-App (Abschnitt G). Wie Brain eine eigene lokale
 * App, nur nicht owner-privat: Zugang hat, wer das Häkchen `Family` trägt.
 *
 * Reihenfolge: `NEXT_PUBLIC_FAMILY_URL` (Host-`.env` oder DB-Override), dann
 * die aus den Geschwister-Apps abgeleitete Subdomain, sonst der
 * Loopback-Standard. Dieser Resolver berechnet nur das Ziel, nicht die
 * Erreichbarkeit — der Tunnel-Ingress bleibt eine getrennte Entscheidung
 * (deploy/scripts/configure-cloudflare-tunnel.sh richtet ihn mit ein).
 */
export function resolveFamilyPublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const effective = withRuntimeEnvOverrides(env);
  const explicit = effective.NEXT_PUBLIC_FAMILY_URL?.trim()?.replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }
  return deriveFamilyUrlFromSiblings(effective) ?? DEV_FAMILY_URL;
}

/**
 * Public base URL der öffentlichen Startseite — Ziel des „UWE Start"-Knopfs in
 * Studio, Portal, Brain und Family.
 *
 * Die Startseite hat bewusst keine eigene `NEXT_PUBLIC_*`-Adresse: sie *ist*
 * der Apex-Origin, den `PUBLIC_BASE_URL` / `PUBLIC_APP_URL` benennt (siehe
 * .env.example und deploy/cloudflare/config.yml.example). Fehlt der Wert,
 * bleibt im Split-Hostname-Layout noch der aus den Geschwister-Subdomains
 * abgeleitete Apex.
 *
 * Ohne beides — die rein lokale Installation — zeigt der Knopf auf die
 * Studio-Origin und **nicht** auf `localhost:3103`: der eigene
 * Startseiten-Prozess (`apps/landing`) ist im Einrichtungs-Assistenten optional
 * („nur nötig, wenn UWE öffentlich erreichbar sein soll"), Studio liefert unter
 * `/` aber dieselbe Startseite aus. Ein Link auf einen Port, den diese
 * Installation vielleicht nie startet, wäre die schlechtere Vorgabe.
 */
export function resolveLandingPublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const effective = withRuntimeEnvOverrides(env);
  const publicAppUrl = getUweRuntimeConfig(effective).publicAppUrl?.replace(/\/$/, "");
  if (publicAppUrl) {
    return publicAppUrl;
  }

  const apex = deriveApexOriginFromSiblings(effective);
  if (apex) {
    return `${apex.protocol}//${apex.host}`;
  }

  return resolveStudioPublicBaseUrl(effective);
}

/** Origins der app-übergreifenden Navigation (Bottom-Nav, Landing-Kacheln). */
export interface UweCrossAppUrls {
  /** Apex-Origin der öffentlichen Startseite (`apps/landing`). */
  start: string;
  studio: string;
  portal: string;
  brain: string;
  family: string;
}

/**
 * Löst alle Produkt-Origins **zur Laufzeit** auf — für Server-Komponenten und
 * für den `AppUrlsProvider`, der die Werte an die Client-Shells reicht.
 *
 * Das Gegenstück in shared-ui (`readClientAppUrls`) liest literale
 * `process.env.NEXT_PUBLIC_*`-Zugriffe, die Next beim Build einsetzt. Hier
 * zählt die Umgebung des laufenden Prozesses samt DB-Overrides und der aus dem
 * Split-Hostname-Layout abgeleiteten Family-Origin.
 */
export function resolveCrossAppUrls(env: NodeJS.ProcessEnv = process.env): UweCrossAppUrls {
  return {
    start: resolveLandingPublicBaseUrl(env),
    studio: resolveStudioPublicBaseUrl(env),
    portal: resolvePortalPublicBaseUrl(env),
    brain: resolveBrainPublicBaseUrl(env),
    family: resolveFamilyPublicBaseUrl(env),
  };
}

/**
 * Setzt eine aus der Anfrage abgeleitete URL auf die konfigurierte öffentliche
 * Origin um. Brain und Family binden auf Loopback
 * (`next start --hostname 127.0.0.1`), deshalb löst Next `request.nextUrl` auf
 * `localhost:<port>` auf und ignoriert den weitergereichten Host-Header — ein
 * daraus gebauter Redirect schickt Tunnel-Besucher auf ein unerreichbares
 * `http://localhost:3004/login`.
 *
 * Ist eine echte (nicht-Loopback) öffentliche Origin konfiguriert, übernimmt sie
 * Protokoll, Hostname und Port. Rein lokale Installationen behalten die
 * unveränderte URL — die erreicht ein lokaler Browser weiterhin.
 */
export function rebaseUrlOnPublicOrigin(url: URL, publicBaseUrl: string): URL {
  try {
    const base = new URL(publicBaseUrl);
    if (!isLoopbackUrl(base.toString())) {
      url.protocol = base.protocol;
      // Hostname und Port getrennt setzen: der `host`-Setter lässt einen
      // vorhandenen Port stehen, wenn der neue Wert keinen nennt — die URL
      // behielte sonst den Loopback-Port, der durch den Tunnel nicht
      // erreichbar ist. `base.port` ist "" bei Standard-HTTPS und löscht ihn.
      url.hostname = base.hostname;
      url.port = base.port;
    }
  } catch {
    // Malformed public URL — fall back to the request-derived origin.
  }
  return url;
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
  const trustedProxyHops = parseIntEnv(env.TRUSTED_PROXY_HOPS, 1);

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
    trustedProxyHops,
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

/**
 * Every cookie scope a session may have been written under, so clearing covers all of them.
 *
 * A cookie's identity is (name, domain, path): once `SESSION_COOKIE_DOMAIN` is added or
 * removed, the browser holds both a host-only and a domain-scoped `uwe_session` and sends
 * both. Clearing only the currently configured variant leaves the other one behind forever
 * — it then shadows the fresh session on every request and survives each login/logout cycle.
 */
export function getSessionCookieClearVariants(
  request: RequestLikeForCookieOptions,
  env: NodeJS.ProcessEnv = process.env,
): SessionCookieOptions[] {
  const configured = getSessionCookieOptionsForRequest(request, env);
  if (!configured.domain) {
    return [configured];
  }

  const { domain: _domain, ...hostOnly } = configured;
  return [configured, hostOnly];
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
