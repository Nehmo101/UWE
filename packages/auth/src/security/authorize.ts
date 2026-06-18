import { isPublicExposureConfigured, originMatchesTrustedHost } from "../runtime-config";
import { classifyRoute, isApiRoute, type UweAppSurface } from "./route-policy";

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a[index]! ^ b[index]!;
  }

  return mismatch === 0;
}

export type AuthorizeScope =
  | "studio-api"
  | "studio-action"
  | "portal-api"
  | "portal-session";

export interface AuthorizeInput {
  scope: AuthorizeScope;
  request: Pick<Request, "headers"> & { url?: string };
  pathname?: string;
  hasSession?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface AuthorizeDenied {
  status: number;
  error: string;
}

export type AuthorizeResult = AuthorizeDenied | null;

function readPathname(input: AuthorizeInput): string {
  if (input.pathname) {
    return input.pathname;
  }
  if (input.request.url) {
    try {
      return new URL(input.request.url).pathname;
    } catch {
      return "/";
    }
  }
  return "/";
}

function isCrossSiteBrowserRequest(request: Pick<Request, "headers">): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin || origin === "null") {
    return false;
  }

  return !originMatchesTrustedHost(origin, request.headers.get("host"));
}

function isSameOriginBrowserRequest(request: Pick<Request, "headers">): boolean {
  if (request.headers.get("sec-fetch-site") === "same-origin") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    return originMatchesTrustedHost(origin, request.headers.get("host"));
  }

  return false;
}

function hasValidBearerToken(request: Pick<Request, "headers">, requiredToken: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(requiredToken);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function getAllowedAccessEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.STUDIO_ACCESS_ALLOWED_EMAILS?.trim() || env.STUDIO_ACCESS_EMAIL?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function hasCloudflareAccessAuth(
  request: Pick<Request, "headers">,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const email = request.headers.get("cf-access-authenticated-user-email")?.trim().toLowerCase();
  if (!email) {
    return false;
  }

  const allowed = getAllowedAccessEmails(env);
  return allowed.includes(email);
}

/**
 * Server-side authorization guard. Returns null when allowed, otherwise a denial
 * payload suitable for API responses. Middleware/proxy checks are not sufficient
 * on their own — every sensitive API route and server action must call this.
 */
export function authorize(input: AuthorizeInput): AuthorizeResult {
  const pathname = readPathname(input);
  const env = input.env ?? process.env;

  switch (input.scope) {
    case "studio-api":
    case "studio-action":
      return authorizeStudio(input.request, pathname, input.scope, env);
    case "portal-api":
      return authorizePortalApi(input.request, pathname, input.hasSession ?? false);
    case "portal-session":
      return authorizePortalSession(pathname, input.hasSession ?? false);
    default:
      return { status: 403, error: "Unbekannter Authorization-Scope." };
  }
}

function authorizeStudio(
  request: Pick<Request, "headers">,
  pathname: string,
  scope: "studio-api" | "studio-action",
  env: NodeJS.ProcessEnv = process.env,
): AuthorizeResult {
  const classification = classifyRoute(pathname, "studio");
  if (classification.access === "public") {
    return null;
  }

  if (isCrossSiteBrowserRequest(request)) {
    return {
      status: 403,
      error: "Cross-Origin-Anfragen an die Studio-API sind nicht erlaubt.",
    };
  }

  if (hasCloudflareAccessAuth(request, env)) {
    return null;
  }

  const requiredToken = env.STUDIO_API_TOKEN;
  if (requiredToken) {
    if (isSameOriginBrowserRequest(request) || hasValidBearerToken(request, requiredToken)) {
      return null;
    }
    return {
      status: 401,
      error: "Studio-API-Token erforderlich (Authorization: Bearer …).",
    };
  }

  if (isPublicExposureConfigured(env)) {
    return {
      status: 401,
      error: "Studio-Zugriff erfordert Authentifizierung (Cloudflare Access oder API-Token).",
    };
  }

  if (scope === "studio-action" && isSameOriginBrowserRequest(request)) {
    return null;
  }

  if (scope === "studio-api" && isSameOriginBrowserRequest(request)) {
    return null;
  }

  if (scope === "studio-action" && !request.headers.get("origin")) {
    return null;
  }

  if (scope === "studio-api" && !request.headers.get("origin")) {
    return null;
  }

  return {
    status: 401,
    error: "Studio-Zugriff erfordert Authentifizierung.",
  };
}

function authorizePortalApi(
  request: Pick<Request, "headers">,
  pathname: string,
  hasSession: boolean,
): AuthorizeResult {
  const classification = classifyRoute(pathname, "portal");
  if (classification.access === "public") {
    return null;
  }

  if (classification.access === "protected-session") {
    if (!hasSession) {
      return { status: 401, error: "Anmeldung erforderlich." };
    }
    return null;
  }

  if (classification.unknownApi) {
    return { status: 404, error: "API-Route nicht gefunden." };
  }

  if (!hasSession) {
    return { status: 401, error: "Anmeldung erforderlich." };
  }

  return null;
}

function authorizePortalSession(pathname: string, hasSession: boolean): AuthorizeResult {
  const classification = classifyRoute(pathname, "portal");
  if (classification.access === "public") {
    return null;
  }

  if (classification.access === "protected-session" || classification.access === "protected") {
    if (!hasSession) {
      return { status: 401, error: "Anmeldung erforderlich." };
    }
  }

  return null;
}

export function authorizeForSurface(
  request: Pick<Request, "headers"> & { url?: string },
  surface: UweAppSurface,
  options: { hasSession?: boolean; pathname?: string; env?: NodeJS.ProcessEnv } = {},
): AuthorizeResult {
  const env = options.env ?? process.env;
  const pathname = options.pathname ?? readPathname({ scope: "portal-api", request, env });
  const classification = classifyRoute(pathname, surface);

  if (classification.access === "public") {
    return null;
  }

  if (surface === "studio") {
    return authorizeStudio(
      request,
      pathname,
      isApiRoute(pathname) ? "studio-api" : "studio-action",
      env,
    );
  }

  if (options.hasSession) {
    return null;
  }

  if (classification.access === "protected-session") {
    return { status: 401, error: "Anmeldung erforderlich." };
  }

  if (classification.unknownApi) {
    return { status: 404, error: "API-Route nicht gefunden." };
  }

  return { status: 401, error: "Anmeldung erforderlich." };
}
