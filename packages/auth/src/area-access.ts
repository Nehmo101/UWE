import type { AreaAccess, AuthUser, AuthUserSource, UweArea } from "./types";

/**
 * Who may enter which app.
 *
 * There used to be a role enum (`owner`/`admin`/`dm`/`player`/`readonly`/`guest`)
 * with two role sets layered on top. It is gone (Notiz Lasse, 2026-07-26): the
 * owner ticks four checkboxes per e-mail address in the Command Center, and
 * those checkboxes are the whole answer to „wer darf wo rein". `owner` survives
 * as the single remaining role, for operations, restore and the Command Center
 * itself.
 */

export const UWE_AREA_LABELS: Record<UweArea, string> = {
  portal: "Portal",
  studio: "Studio",
  brain: "Brain",
  family: "Family",
};

export function hasAreaAccess(user: Pick<AuthUser, "access">, area: UweArea): boolean {
  return user.access[area] === true;
}

export function isOwner(user: Pick<AuthUser, "isOwner">): boolean {
  return user.isOwner === true;
}

export function canAccessPortal(user: Pick<AuthUser, "access">): boolean {
  return hasAreaAccess(user, "portal");
}

export function canAccessStudio(user: Pick<AuthUser, "access">): boolean {
  return hasAreaAccess(user, "studio");
}

export function canAccessBrain(user: Pick<AuthUser, "access">): boolean {
  return hasAreaAccess(user, "brain");
}

export function canAccessFamily(user: Pick<AuthUser, "access">): boolean {
  return hasAreaAccess(user, "family");
}

export class AuthRequiredError extends Error {
  readonly code = "AUTH_REQUIRED";

  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class ForbiddenAccessError extends Error {
  readonly code = "FORBIDDEN_ACCESS";

  constructor(message = "Kein Zugang zu diesem Bereich.") {
    super(message);
    this.name = "ForbiddenAccessError";
  }
}

export function requireUser(user: AuthUser | null): AuthUser {
  if (!user) {
    throw new AuthRequiredError();
  }
  return user;
}

export function requireArea(user: AuthUser | null, area: UweArea): AuthUser {
  const resolved = requireUser(user);
  if (!hasAreaAccess(resolved, area)) {
    throw new ForbiddenAccessError(`Kein Zugang zum Bereich ${UWE_AREA_LABELS[area]}.`);
  }
  return resolved;
}

export function requireOwner(user: AuthUser | null): AuthUser {
  const resolved = requireUser(user);
  if (!isOwner(resolved)) {
    throw new ForbiddenAccessError("Nur der Owner darf das.");
  }
  return resolved;
}

/** What a request must bring to pass a Studio route gate. */
export type StudioRouteAccess = "public" | "studio" | "owner";

function normalizeApiPathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  const normalized = withoutQuery.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  return normalized.toLowerCase();
}

/** Studio API routes that stay public at the access gate (health, auth entry, callbacks). */
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

export function getRequiredAccessForApiPath(pathname: string): StudioRouteAccess | null {
  const normalized = normalizeApiPathname(pathname);
  if (!normalized.startsWith("/api/")) {
    return null;
  }
  if (isPublicStudioApiPath(normalized)) {
    return null;
  }
  if (normalized.startsWith("/api/admin")) {
    return "owner";
  }
  return "studio";
}

export function getRequiredAccessForPagePath(pathname: string): StudioRouteAccess {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "owner";
  }
  if (pathname === "/ideas" || pathname.startsWith("/ideas/")) {
    return "owner";
  }
  return "studio";
}

/** Does `user` satisfy the access level a Studio route asks for? */
export function satisfiesStudioRouteAccess(
  user: Pick<AuthUser, "isOwner" | "access">,
  required: StudioRouteAccess,
): boolean {
  if (required === "public") {
    return true;
  }
  if (required === "owner") {
    return isOwner(user);
  }
  return canAccessStudio(user);
}

/**
 * Builds an {@link AreaAccess} record from whatever the caller has: a DB row
 * with `*Access` columns, CLI input, or a user that already carries `access`.
 */
export function toAreaAccess(input: Omit<AuthUserSource, "id" | "displayName" | "email" | "isOwner">): AreaAccess {
  if (input.access) {
    return { ...input.access };
  }
  return {
    portal: input.portalAccess === true,
    studio: input.studioAccess === true,
    brain: input.brainAccess === true,
    family: input.familyAccess === true,
  };
}

/** Builds an {@link AuthUser} from a DB row or an already-shaped user. */
export function toAuthUser(user: AuthUserSource): AuthUser {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    isOwner: user.isOwner === true,
    access: toAreaAccess(user),
  };
}
