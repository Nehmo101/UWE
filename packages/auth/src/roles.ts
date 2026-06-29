import type { AuthUser, UweRole } from "./types";

/** Roles allowed to use UWE Studio (DM workspace). */
export const STUDIO_ACCESS_ROLES = ["owner", "admin", "dm"] as const satisfies readonly UweRole[];

/** Roles allowed to access /admin and /api/admin. */
export const ADMIN_ACCESS_ROLES = ["owner", "admin"] as const satisfies readonly UweRole[];

export type StudioAccessRole = (typeof STUDIO_ACCESS_ROLES)[number];
export type AdminAccessRole = (typeof ADMIN_ACCESS_ROLES)[number];

export function hasAnyRole(user: Pick<AuthUser, "role">, allowed: readonly UweRole[]): boolean {
  return allowed.includes(user.role);
}

export function isOwner(user: Pick<AuthUser, "role">): boolean {
  return user.role === "owner";
}

export function canAccessStudio(user: Pick<AuthUser, "role">): boolean {
  return hasAnyRole(user, STUDIO_ACCESS_ROLES);
}

export function canAccessAdmin(user: Pick<AuthUser, "role">): boolean {
  return hasAnyRole(user, ADMIN_ACCESS_ROLES);
}

export function isContentEditorRole(role: UweRole): boolean {
  return role === "owner" || role === "admin" || role === "dm";
}

export class AuthRequiredError extends Error {
  readonly code = "AUTH_REQUIRED";

  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class ForbiddenRoleError extends Error {
  readonly code = "FORBIDDEN_ROLE";

  constructor(message = "Insufficient role.") {
    super(message);
    this.name = "ForbiddenRoleError";
  }
}

export function requireUser(user: AuthUser | null): AuthUser {
  if (!user) {
    throw new AuthRequiredError();
  }
  return user;
}

export function requireRole(user: AuthUser | null, allowed: readonly UweRole[]): AuthUser {
  const resolved = requireUser(user);
  if (!hasAnyRole(resolved, allowed)) {
    throw new ForbiddenRoleError();
  }
  return resolved;
}

export function requireOwner(user: AuthUser | null): AuthUser {
  return requireRole(user, ["owner"]);
}

export function getRequiredRolesForApiPath(pathname: string): readonly UweRole[] | null {
  if (pathname.startsWith("/api/admin")) {
    return ADMIN_ACCESS_ROLES;
  }
  if (
    pathname.startsWith("/api/brain") ||
    pathname.startsWith("/api/ai") ||
    pathname.startsWith("/api/import")
  ) {
    return STUDIO_ACCESS_ROLES;
  }
  return null;
}

export function getRequiredRolesForPagePath(pathname: string): readonly UweRole[] | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return ADMIN_ACCESS_ROLES;
  }
  if (pathname === "/ideas" || pathname.startsWith("/ideas/")) {
    return ["owner"];
  }
  return STUDIO_ACCESS_ROLES;
}
