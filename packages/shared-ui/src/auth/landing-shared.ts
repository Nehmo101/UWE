import type { CSSProperties } from "react";

/**
 * Shared design constants for the uwe.example landing page, split out so
 * both UweLandingPage and UweLandingLoginCard stay well under the module-size
 * budget. Values follow design_handoff_landing_page/README.md (Parchment OS).
 * The type scale below is not exposed as codebase tokens, so exact px are used.
 */

export const TEXT_2XS = "10.9px";
export const TEXT_XS = "11.5px";
export const TEXT_SM = "13px";
export const TEXT_BASE = "14.4px";
export const TEXT_2XL = "28px";
export const LEADING = 1.5;

export const FONT_MONO =
  'var(--uwe-font-space-mono, ui-monospace, "Cascadia Code", monospace)';
export const FONT_SERIF = "var(--uwe-font-newsreader, Georgia, serif)";

export function eyebrowStyle(color: string): CSSProperties {
  return {
    fontSize: TEXT_2XS,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color,
    fontWeight: 700,
  };
}
