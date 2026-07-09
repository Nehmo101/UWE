/**
 * Framework-agnostic WCAG contrast utilities (same math as
 * `@uwe/shared-ui/theme/resolveColorTokens`, re-implemented here to keep this
 * package dependency-free). Only `#rgb`/`#rrggbb` hex is parseable; other CSS
 * color forms (rgba/color-mix) return `null` and are skipped by callers.
 */

export const AA_CONTRAST = 4.5;
export const AA_LARGE_CONTRAST = 3;

export function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** Relative luminance (WCAG) of a hex color, or `null` if not parseable. */
export function relativeLuminance(color: string): number | null {
  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(full.slice(0, 2), 16));
  const g = channel(parseInt(full.slice(2, 4), 16));
  const b = channel(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors, or `null` if either is non-hex. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white text for an accent fill, whichever meets AA better. */
export function bestOnColor(background: string): "#000000" | "#ffffff" {
  const lum = relativeLuminance(background);
  if (lum === null) return "#ffffff";
  return lum > 0.179 ? "#000000" : "#ffffff";
}
