import { getFamilyUser } from "./page-family";

/** Thrown when someone without the family checkbox reaches a mutating action. */
export class FamilyActionAuthError extends Error {
  readonly status = 403;
  constructor() {
    super("Kein Zugang zum Bereich Family.");
    this.name = "FamilyActionAuthError";
  }
}

/**
 * Häkchen-Guard für jede schreibende Family-Server-Action. Das Middleware
 * prüft nur, ob überhaupt eine Sitzung da ist — welche Häkchen sie trägt,
 * entscheidet sich hier.
 */
export async function requireFamilyActionAuth() {
  const user = await getFamilyUser();
  if (!user) {
    throw new FamilyActionAuthError();
  }
  return user;
}
