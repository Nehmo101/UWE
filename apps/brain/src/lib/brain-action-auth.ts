import { getBrainOwner } from "./page-owner";

/** Thrown when a non-owner reaches a mutating Brain Server Action. */
export class BrainActionAuthError extends Error {
  readonly status = 403;
  constructor() {
    super("Der Brain-Bereich ist nur für den System-Owner.");
    this.name = "BrainActionAuthError";
  }
}

/**
 * Owner guard for every mutating Brain Server Action. Brain data is strictly
 * owner-only, so — unlike Studio's trusted-scope guard — this asserts the global
 * owner role. Middleware gates page loads; actions must re-check here.
 */
export async function requireBrainActionAuth() {
  const owner = await getBrainOwner();
  if (!owner) {
    throw new BrainActionAuthError();
  }
  return owner;
}
