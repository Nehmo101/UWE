import { isProductionEnv, isPublicExposureConfigured } from "../runtime-config";
import { SESSION_COOKIE_NAME } from "../session";
import { authorizeForSurface } from "./authorize";
import {
  classifyRoute,
  isApiRoute,
  isUnknownProtectedApi,
  type UweAppSurface,
} from "./route-policy";

export interface MiddlewareDecision {
  action: "allow" | "block" | "redirect-login";
  status?: number;
  error?: string;
  redirectPath?: string;
}

export interface MiddlewareRequestLike {
  pathname: string;
  cookies: {
    get(name: string): { value: string } | undefined;
  };
  headers: Headers;
  url: string;
}

function buildRequest(request: MiddlewareRequestLike): Request {
  return new Request(request.url, { headers: request.headers });
}

export function evaluatePortalMiddleware(
  request: MiddlewareRequestLike,
  env: NodeJS.ProcessEnv = process.env,
): MiddlewareDecision {
  if (!isProductionEnv(env)) {
    return { action: "allow" };
  }

  const pathname = request.pathname;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const httpRequest = buildRequest(request);

  if (isApiRoute(pathname)) {
    if (isUnknownProtectedApi(pathname, "portal")) {
      return { action: "block", status: 404, error: "API-Route nicht gefunden." };
    }

    const denied = authorizeForSurface(httpRequest, "portal", { hasSession, pathname, env });
    if (denied) {
      return { action: "block", status: denied.status, error: denied.error };
    }
    return { action: "allow" };
  }

  const classification = classifyRoute(pathname, "portal");
  if (classification.access === "protected-session") {
    if (!hasSession) {
      return { action: "redirect-login", redirectPath: "/login" };
    }
    return { action: "allow" };
  }

  if (classification.access === "protected") {
    return { action: "block", status: 403, error: "Zugriff verweigert." };
  }

  return { action: "allow" };
}

export function evaluateStudioMiddleware(
  request: MiddlewareRequestLike,
  env: NodeJS.ProcessEnv = process.env,
): MiddlewareDecision {
  const pathname = request.pathname;
  const httpRequest = buildRequest(request);

  if (isApiRoute(pathname)) {
    if (isUnknownProtectedApi(pathname, "studio")) {
      return { action: "block", status: 404, error: "API-Route nicht gefunden." };
    }
  }

  const classification = classifyRoute(pathname, "studio");
  if (classification.access === "public") {
    return { action: "allow" };
  }

  const publiclyExposed = isPublicExposureConfigured(env);
  const enforceInDev = env.STUDIO_ROUTE_POLICY_ENFORCE === "true";
  if (!publiclyExposed && !enforceInDev && !isProductionEnv(env)) {
    return { action: "allow" };
  }

  if (!publiclyExposed && !enforceInDev && isProductionEnv(env)) {
    const denied = authorizeForSurface(httpRequest, "studio", { pathname, env });
    if (denied && isApiRoute(pathname)) {
      return { action: "block", status: denied.status, error: denied.error };
    }
    return { action: "allow" };
  }

  const denied = authorizeForSurface(httpRequest, "studio", { pathname, env });
  if (denied) {
    return { action: "block", status: denied.status, error: denied.error };
  }

  return { action: "allow" };
}

/**
 * Checkbox-gated surface (Brain, Family): path-based, deny-by-default session
 * gate. Pages without a session redirect to /login; protected APIs return 401
 * (or 404 for unknown APIs, hiding their existence). *Which* checkbox is
 * required is enforced server-side by the route handlers
 * (`requireBrainOwnerAuth` / `requireFamilyAuth`) — the middleware has no user
 * object and therefore never decides it. In non-production everything is
 * allowed for local development.
 */
function evaluateCheckboxSurfaceMiddleware(
  surface: "brain" | "family",
  request: MiddlewareRequestLike,
  env: NodeJS.ProcessEnv = process.env,
): MiddlewareDecision {
  if (!isProductionEnv(env)) {
    return { action: "allow" };
  }
  const pathname = request.pathname;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const classification = classifyRoute(pathname, surface);

  if (classification.access === "public") {
    return { action: "allow" };
  }

  if (isApiRoute(pathname)) {
    if (hasSession) {
      return { action: "allow" };
    }
    if (classification.unknownApi) {
      return { action: "block", status: 404, error: "API-Route nicht gefunden." };
    }
    return { action: "block", status: 401, error: "Anmeldung erforderlich." };
  }

  if (!hasSession) {
    return { action: "redirect-login", redirectPath: "/login" };
  }
  return { action: "allow" };
}

export function evaluateBrainMiddleware(
  request: MiddlewareRequestLike,
  env: NodeJS.ProcessEnv = process.env,
): MiddlewareDecision {
  return evaluateCheckboxSurfaceMiddleware("brain", request, env);
}

export function evaluateFamilyMiddleware(
  request: MiddlewareRequestLike,
  env: NodeJS.ProcessEnv = process.env,
): MiddlewareDecision {
  return evaluateCheckboxSurfaceMiddleware("family", request, env);
}

export function getMiddlewareMatcher(surface: UweAppSurface): string[] {
  if (surface === "portal") {
    return [
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
    ];
  }

  return ["/((?!_next/static|_next/image|favicon.ico).*)"];
}
