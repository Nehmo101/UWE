import type { AuthUser, UweRole } from "./types";
import { ADMIN_ACCESS_ROLES, STUDIO_ACCESS_ROLES, hasAnyRole } from "./roles";
import type { ApiTokenScope } from "./api-token";
import { hasApiTokenScope } from "./api-token";

export interface AdminGateContext {
  user: AuthUser | null;
  apiTokenScopes?: readonly ApiTokenScope[] | null;
  requiredScopes?: readonly ApiTokenScope[];
}

export interface AdminGateDenied {
  status: number;
  error: string;
}

export type AdminGateResult = AdminGateDenied | null;

export function requireAdminRole(user: AuthUser | null): AdminGateResult {
  if (!user) {
    return { status: 401, error: "Admin-Zugriff erfordert Anmeldung." };
  }
  if (!hasAnyRole(user, ADMIN_ACCESS_ROLES)) {
    return { status: 403, error: "Nur OWNER und ADMIN haben Zugriff auf Admin-Bereiche." };
  }
  return null;
}

export function requireStudioRole(user: AuthUser | null): AdminGateResult {
  if (!user) {
    return { status: 401, error: "Studio-Zugriff erfordert Anmeldung." };
  }
  if (!hasAnyRole(user, STUDIO_ACCESS_ROLES)) {
    return { status: 403, error: "Unzureichende Studio-Rolle." };
  }
  return null;
}

export function requirePlayerBlocked(user: AuthUser | null): AdminGateResult {
  if (!user) {
    return null;
  }
  if (user.role === "player" || user.role === "guest" || user.role === "readonly") {
    return { status: 403, error: "Spieler haben keinen Zugriff auf Studio/Admin-APIs." };
  }
  return null;
}

/**
 * Combined admin gate for API routes.
 * Session users must be owner/admin; API tokens must carry required scopes.
 */
export function evaluateAdminGate(context: AdminGateContext): AdminGateResult {
  const playerDenied = requirePlayerBlocked(context.user);
  if (playerDenied) {
    return playerDenied;
  }

  if (context.apiTokenScopes) {
    if (context.requiredScopes && context.requiredScopes.length > 0) {
      if (!hasApiTokenScope(context.apiTokenScopes, context.requiredScopes)) {
        return { status: 403, error: "API-Token hat nicht die erforderlichen Scopes." };
      }
    }
    return null;
  }

  return requireAdminRole(context.user);
}

export function isAdminRole(role: UweRole): boolean {
  return hasAnyRole({ role }, ADMIN_ACCESS_ROLES);
}
