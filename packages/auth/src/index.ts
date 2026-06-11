/**
 * UWE Auth — placeholder for Phase 4.
 * Planned: DM vs. player roles, session management, portal access tokens.
 */

export type UweRole = "dm" | "player" | "admin";

export interface UweUser {
  id: string;
  name: string;
  role: UweRole;
}

export const AUTH_PACKAGE_VERSION = "0.1.0";
