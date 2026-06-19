/** Context modes that may reach cloud providers — personal brain is never included. */
export const CLOUD_ALLOWED_CONTEXT_MODES = ["general_chat"] as const;

export type CloudAllowedContextMode = (typeof CLOUD_ALLOWED_CONTEXT_MODES)[number];

export function isPersonalBrainContextAllowedForProvider(provider: "cloud" | "local_rtx" | "auto"): boolean {
  return provider === "local_rtx";
}

export function assertPersonalBrainLocalOnly(provider: string): void {
  if (provider === "cloud") {
    throw new Error("Life-Brain-Kontext ist nur für lokale KI (RTX) erlaubt.");
  }
}
