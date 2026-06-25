import type { ThemeColorTokens } from "./tokens";

export type ResolvedThemeColorTokens = ThemeColorTokens & {
  sidebarBg: string;
  sidebarFg: string;
  sidebarFgMuted: string;
  cardBg: string;
  inputBg: string;
  focusRing: string;
  focusShadow: string;
  /** Text color for accent-filled controls (primary buttons), AA-contrasting. */
  onAccent: string;
  /** Default hyperlink color, AA-contrasting against the theme background. */
  link: string;
};

/** WCAG contrast ratio between two hex colors, or null if either is non-hex. */
function hexContrast(a: string, b: string): number | null {
  const la = hexLuminance(a);
  const lb = hexLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Picks a hyperlink color that meets WCAG AA against the background: the first
 * of [accentHover, wikiLink, accent] reaching >=4.5:1 (brand accent on dark
 * themes, the darker wiki-link on light themes). Falls back to the highest-
 * contrast candidate when none clears 4.5.
 */
export function deriveLink(colors: ThemeColorTokens): string {
  if (colors.link) return colors.link;
  const bg = colors.bg;
  const candidates = [colors.accentHover, colors.wikiLink, colors.accent].filter(
    (c): c is string => typeof c === "string",
  );
  let best = candidates[0] ?? colors.accent;
  let bestRatio = -1;
  for (const candidate of candidates) {
    const ratio = hexContrast(candidate, bg);
    if (ratio === null) continue;
    if (ratio >= 4.5) return candidate;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  }
  return best;
}

/** Relative luminance (WCAG) of a #rgb/#rrggbb color, or null if not parseable. */
function hexLuminance(color: string): number | null {
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

/**
 * Picks black or white text for an accent fill so the pair meets WCAG AA.
 * The crossover where #000 and #fff give equal contrast is L≈0.179; lighter
 * accents take black text, darker accents take white. Non-hex accents (rgba/
 * color-mix) fall back to white.
 */
export function deriveOnAccent(accent: string): string {
  const lum = hexLuminance(accent);
  if (lum === null) return "#ffffff";
  return lum > 0.179 ? "#000000" : "#ffffff";
}

/** Fills derived surface tokens when a preset omits explicit values. */
export function resolveThemeColorTokens(
  colors: ThemeColorTokens,
): ResolvedThemeColorTokens {
  return {
    ...colors,
    sidebarBg: colors.sidebarBg ?? colors.panel,
    sidebarFg: colors.sidebarFg ?? colors.fg,
    sidebarFgMuted: colors.sidebarFgMuted ?? colors.fgMuted,
    cardBg: colors.cardBg ?? colors.surface,
    inputBg: colors.inputBg ?? colors.bgElevated,
    focusRing:
      colors.focusRing ??
      `color-mix(in srgb, ${colors.accent} 55%, transparent)`,
    focusShadow:
      colors.focusShadow ??
      `color-mix(in srgb, ${colors.accent} 22%, transparent)`,
    onAccent: deriveOnAccent(colors.accent),
    link: deriveLink(colors),
  };
}
