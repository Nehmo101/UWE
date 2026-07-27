import type { AuthUser } from "./types";
import { canAccessStudio, isOwner } from "./area-access";
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

export function requireOwnerAccess(user: AuthUser | null): AdminGateResult {
  if (!user) {
    return { status: 401, error: "Admin-Zugriff erfordert Anmeldung." };
  }
  if (!isOwner(user)) {
    return { status: 403, error: "Nur der Owner hat Zugriff auf Admin-Bereiche." };
  }
  return null;
}

export function requireStudioAccess(user: AuthUser | null): AdminGateResult {
  if (!user) {
    return { status: 401, error: "Studio-Zugriff erfordert Anmeldung." };
  }
  if (!canAccessStudio(user)) {
    return { status: 403, error: "Kein Zugang zum Bereich Studio." };
  }
  return null;
}

/**
 * Combined admin gate for API routes.
 *
 * Session users must be the owner — with the role enum gone there is no
 * separate `admin` tier left to admit. API tokens are judged by their scopes
 * instead, as before.
 */
export function evaluateAdminGate(context: AdminGateContext): AdminGateResult {
  if (context.apiTokenScopes) {
    if (context.requiredScopes && context.requiredScopes.length > 0) {
      if (!hasApiTokenScope(context.apiTokenScopes, context.requiredScopes)) {
        return { status: 403, error: "API-Token hat nicht die erforderlichen Scopes." };
      }
    }
    return null;
  }

  return requireOwnerAccess(context.user);
}
