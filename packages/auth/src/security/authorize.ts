import {
  isCrossSiteBrowserRequest,
  isSameOriginBrowserRequest,
} from "../api-origin-guard";
import { isPublicExposureConfigured } from "../runtime-config";
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
  | "portal-action"
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

function hasValidBearerToken(request: Pick<Request, "headers">, requiredToken: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(requiredToken);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
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
    case "portal-action":
      return authorizePortalAction(input.request, input.hasSession ?? false, env);
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

  if (isCrossSiteBrowserRequest(request, env)) {
    return {
      status: 403,
      error: "Cross-Origin-Anfragen an die Studio-API sind nicht erlaubt.",
    };
  }

  const requiredToken = env.STUDIO_API_TOKEN;
  if (requiredToken) {
    if (isSameOriginBrowserRequest(request, env) || hasValidBearerToken(request, requiredToken)) {
      return null;
    }
    // Direct browser navigation (HTML) has no Origin header — session middleware handles pages.
    if (scope === "studio-action" && !request.headers.get("origin")) {
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
      error: "Studio-Zugriff erfordert Authentifizierung (UWE-Login oder API-Token).",
    };
  }

  if (scope === "studio-action" && isSameOriginBrowserRequest(request, env)) {
    return null;
  }

  if (scope === "studio-api" && isSameOriginBrowserRequest(request, env)) {
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

function authorizePortalAction(
  request: Pick<Request, "headers">,
  hasSession: boolean,
  env: NodeJS.ProcessEnv = process.env,
): AuthorizeResult {
  if (isCrossSiteBrowserRequest(request, env)) {
    return {
      status: 403,
      error: "Cross-Origin-Anfragen an Portal-Aktionen sind nicht erlaubt.",
    };
  }

  if (!hasSession) {
    return { status: 401, error: "Anmeldung erforderlich." };
  }

  if (isSameOriginBrowserRequest(request, env)) {
    return null;
  }

  if (!request.headers.get("origin")) {
    return null;
  }

  return { status: 401, error: "Anmeldung erforderlich." };
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
