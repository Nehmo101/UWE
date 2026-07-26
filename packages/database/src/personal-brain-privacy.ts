/**
 * Personal-brain provider guard.
 *
 * This module used to name the provider modes that were allowed to carry
 * Life-Brain context, so that private notes could never reach a cloud model.
 * Cloud providers were removed — the RTX host is the only backend — so the
 * distinction it guarded no longer exists.
 *
 * The guard stays as a narrow assertion rather than being deleted outright: it
 * still catches a caller that hands in some other provider string, which would
 * mean a route was wired up that UWE does not know about.
 */

/** The only provider mode UWE has. */
export const PERSONAL_BRAIN_ALLOWED_PROVIDER_MODES = ["local_rtx"] as const;

export type PersonalBrainAllowedProviderMode =
  (typeof PERSONAL_BRAIN_ALLOWED_PROVIDER_MODES)[number];

export function isPersonalBrainContextAllowedForProvider(provider: string): boolean {
  return (PERSONAL_BRAIN_ALLOWED_PROVIDER_MODES as readonly string[]).includes(provider);
}

export function assertPersonalBrainLocalOnly(provider: string): void {
  if (!isPersonalBrainContextAllowedForProvider(provider)) {
    throw new Error("Life-Brain-Kontext läuft ausschließlich über den lokalen RTX-Host.");
  }
}
