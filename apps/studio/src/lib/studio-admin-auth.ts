import {
  createApiTokenService,
  createPrismaClient,
} from "@uwe/database/server";
import type { ApiAuthContext } from "@uwe/security";
import { isApiTokenFormat, parseBearerToken } from "@uwe/auth";
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

  return {
    user: null,
    apiTokenId: null,
    apiTokenScopes: null,
    authMethod: "none",
  };
}
