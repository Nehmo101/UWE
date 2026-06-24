const DESIGN_V2_ENV_KEY = "NEXT_PUBLIC_UWE_DESIGN_V2";

/** Whether the UWE Design V2 shell/CSS refresh is enabled (default: on). */
export function isDesignV2Enabled(env?: Record<string, string | undefined>): boolean {
  const source = env ?? (typeof process !== "undefined" ? process.env : undefined);
  const raw = source?.[DESIGN_V2_ENV_KEY];
  if (raw === "false") return false;
  return true;
}
