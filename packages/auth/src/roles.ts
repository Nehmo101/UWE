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

function normalizeApiPathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  const normalized = withoutQuery.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  return normalized.toLowerCase();
}

/** Studio API routes that stay public at the role gate (health, auth entry, callbacks). */
const PUBLIC_STUDIO_API_PREFIXES = [
  "/api/health",
  "/api/maintenance/status",
  "/api/maintenance/evaluate",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/setup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/two-factor/verify",
  "/api/spotify/callback",
  "/api/agent-jobs/callback",
  "/api/connectors/",
] as const;

function isPublicStudioApiPath(pathname: string): boolean {
  const normalized = normalizeApiPathname(pathname);
  return PUBLIC_STUDIO_API_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix),
  );
}

export function getRequiredRolesForApiPath(pathname: string): readonly UweRole[] | null {
  const normalized = normalizeApiPathname(pathname);
  if (!normalized.startsWith("/api/")) {
    return null;
  }
  if (isPublicStudioApiPath(normalized)) {
    return null;
  }
  if (normalized.startsWith("/api/admin")) {
    return ADMIN_ACCESS_ROLES;
  }
  return STUDIO_ACCESS_ROLES;
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
