import { canUseEngineAi } from "@uwe/auth";
import { getFamilyUser } from "./page-family";

/** Thrown when someone without the family checkbox reaches a mutating action. */
export class FamilyActionAuthError extends Error {
  readonly status = 403;
  constructor(message = "Kein Zugang zum Bereich Family.") {
    super(message);
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

/**
 * Family-Action, die den Maschinenraum-Host beschäftigt (G-KI) — die Beleg-Analyse im
 * Scan-Postfach. Das Family-Häkchen bringt jemanden in den Bereich; ob er
 * darin Inferenz auslösen darf, sagt das KI-Flag. Der Owner geht durch.
 */
export async function requireFamilyAiActionAuth() {
  const user = await requireFamilyActionAuth();
  if (!canUseEngineAi(user)) {
    throw new FamilyActionAuthError(
      "Für dieses Konto ist die Maschinenraum-KI nicht freigeschaltet. Der Owner richtet das im Command Center ein.",
    );
  }
  return user;
}
