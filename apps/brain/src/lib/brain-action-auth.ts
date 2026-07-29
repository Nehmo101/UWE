import { canUseRtxAi } from "@uwe/auth";
import { getBrainOwner } from "./page-owner";

/** Thrown when a non-owner reaches a mutating Brain Server Action. */
export class BrainActionAuthError extends Error {
  readonly status = 403;
  constructor(message = "Kein Zugang zum Bereich Brain.") {
    super(message);
    this.name = "BrainActionAuthError";
  }
}

/**
 * Owner guard for every mutating Brain Server Action. Brain data is strictly
 * gated on the `brain` checkbox, so — unlike Studio's trusted-scope guard — this asserts the
 * owner role. Middleware gates page loads; actions must re-check here.
 */
export async function requireBrainActionAuth() {
  const owner = await getBrainOwner();
  if (!owner) {
    throw new BrainActionAuthError();
  }
  return owner;
}

/**
 * Zusätzliche Prüfung für Brain-Actions, die den RTX-Host beschäftigen (G-KI).
 *
 * Das Brain-Häkchen bringt jemanden in den Bereich; ob er darin die lokale
 * Inferenz auslösen darf, sagt das KI-Flag. Der Owner geht über `canUseRtxAi`
 * durch — für ihn ändert sich nichts.
 */
export async function requireBrainAiActionAuth() {
  const owner = await requireBrainActionAuth();
  if (!canUseRtxAi(owner)) {
    throw new BrainActionAuthError(
      "Für dieses Konto ist die RTX-KI nicht freigeschaltet. Der Owner richtet das im Command Center ein.",
    );
  }
  return owner;
}
