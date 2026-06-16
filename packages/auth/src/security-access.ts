import type { UweRole } from "./types";

/** Roles that may access the UWE Admin Security Dashboard (/admin/security). */
export const SECURITY_DASHBOARD_ROLES: ReadonlySet<UweRole> = new Set(["owner", "admin"]);

export function isSecurityDashboardRole(role: string): role is UweRole {
  return role === "owner" || role === "admin" || role === "dm" || role === "player" || role === "guest";
}

export function canAccessSecurityDashboard(role: string): boolean {
  return SECURITY_DASHBOARD_ROLES.has(role as UweRole);
}

export const SECURITY_ROLE_LABELS: Record<string, string> = {
  owner: "OWNER",
  admin: "ADMIN",
  dm: "DM",
  player: "PLAYER",
  guest: "GUEST",
};
