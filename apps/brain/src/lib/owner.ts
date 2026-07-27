import { canAccessBrain, type AuthUser } from "@uwe/auth";

/**
 * Who may enter the Brain product: the Brain checkbox, set per e-mail address in
 * the Command Center. It replaces the old „role === owner" gate — the role enum
 * is gone (Notiz Lasse, 2026-07-26). The first owner gets all four checkboxes at
 * setup, so nothing changes for a single-person install.
 */
export function canEnterBrain(user: Pick<AuthUser, "access"> | null | undefined): boolean {
  return user ? canAccessBrain(user) : false;
}
