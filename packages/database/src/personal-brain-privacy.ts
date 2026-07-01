/** Context modes that may reach cloud providers — personal brain is never included. */
export const CLOUD_ALLOWED_CONTEXT_MODES = ["general_chat"] as const;

export type CloudAllowedContextMode = (typeof CLOUD_ALLOWED_CONTEXT_MODES)[number];

/**
 * Provider modes that may carry personal_brain (Life Brain) context.
 * Mirrors AiProviderMode in packages/ai-brain/src/router/types.ts.
 * - "local_rtx": always local, allowed.
 * - "auto": allowed — the AI router (validateLocalRtxRequired) guarantees that
 *   personal_brain in auto mode never resolves to cloud (no fallback).
 * - "cloud" and any unknown value: rejected.
 */
export const PERSONAL_BRAIN_ALLOWED_PROVIDER_MODES = ["local_rtx", "auto"] as const;

export type PersonalBrainAllowedProviderMode =
  (typeof PERSONAL_BRAIN_ALLOWED_PROVIDER_MODES)[number];

export function isPersonalBrainContextAllowedForProvider(provider: string): boolean {
  return (PERSONAL_BRAIN_ALLOWED_PROVIDER_MODES as readonly string[]).includes(provider);
}

export function assertPersonalBrainLocalOnly(provider: string): void {
  if (!isPersonalBrainContextAllowedForProvider(provider)) {
    throw new Error("Life-Brain-Kontext ist nur für lokale KI (RTX) erlaubt.");
  }
}
