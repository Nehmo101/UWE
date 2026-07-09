import {
  createApiTokenService,
  createPrismaClient,
} from "@uwe/database/server";
import type { ApiAuthContext, StudioGuardOptions } from "@uwe/security";
import { requireAdminApiAuth, requireStudioRoleApiAuth } from "@uwe/security";
import { isApiTokenFormat, parseBearerToken } from "@uwe/auth";
import { createDevBypassAuthUser, studioAuthRequired } from "./auth";
import { getUserFromRequestCookieHeader } from "./auth-session";

export async function resolveStudioApiAuthContext(request: Request): Promise<ApiAuthContext> {
  const bearer = parseBearerToken(request.headers.get("authorization"));

  if (bearer && isApiTokenFormat(bearer)) {
    const db = createPrismaClient();
    try {
      const tokenService = createApiTokenService(db);
      const resolved = await tokenService.resolveFromBearer(bearer, request.headers);
      if (resolved) {
        return {
          user: {
            id: resolved.userId,
            displayName: resolved.name,
            email: null,
            role: resolved.userRole,
          },
          apiTokenId: resolved.id,
          apiTokenScopes: resolved.scopes,
          authMethod: "api_token",
        };
      }
    } finally {
      await db.$disconnect();
    }
  }

  if (bearer) {
    const envToken = process.env.STUDIO_API_TOKEN?.trim();
    if (envToken) {
      const { timingSafeEqual } = await import("node:crypto");
      const provided = Buffer.from(bearer);
      const expected = Buffer.from(envToken);
      if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
        return {
          user: null,
          apiTokenId: null,
          apiTokenScopes: null,
          authMethod: "env_token",
        };
      }
    }
  }

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (user) {
    return {
      user,
      apiTokenId: null,
      apiTokenScopes: null,
      authMethod: "session",
    };
  }

  // Mirror page auth: when AUTH_REQUIRED=false, treat the operator as owner so
  // browser fetch() to /api/admin/* works without a session cookie (Mail Center sync, etc.).
  if (!studioAuthRequired()) {
    return {
      user: createDevBypassAuthUser(),
      apiTokenId: null,
      apiTokenScopes: null,
      authMethod: "session",
    };
  }

  return {
    user: null,
    apiTokenId: null,
    apiTokenScopes: null,
    authMethod: "none",
  };
}

function readRequestPathname(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/";
  }
}

/** CSRF + role gate for Studio API routes (strict STUDIO_ACCESS_ROLES / admin paths). */
export async function guardStudioApiRequest(
  request: Request,
  options: StudioGuardOptions = {},
): Promise<Response | null> {
  const context = await resolveStudioApiAuthContext(request);
  return requireStudioRoleApiAuth(request, context, {
    ...options,
    pathname: readRequestPathname(request),
  });
}

/** Mutating Studio API routes — same as guardStudioApiRequest with optional rate limit. */
export async function guardStudioApiMutation(
  request: Request,
  options: StudioGuardOptions = {},
): Promise<Response | null> {
  return guardStudioApiRequest(request, options);
}

/** Admin Studio API routes — CSRF + ADMIN_ACCESS_ROLES or scoped API token. */
export async function guardStudioAdminApiRequest(
  request: Request,
  options: StudioGuardOptions & { requiredScopes?: readonly import("@uwe/auth").ApiTokenScope[] } = {},
): Promise<{ error: Response | null; context: ApiAuthContext }> {
  const context = await resolveStudioApiAuthContext(request);
  const error = requireAdminApiAuth(request, context, options);
  return { error, context };
}
