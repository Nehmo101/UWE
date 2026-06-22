import type { ThemeColorTokens } from "./tokens";

export type ResolvedThemeColorTokens = ThemeColorTokens & {
  sidebarBg: string;
  cardBg: string;
  inputBg: string;
  focusRing: string;
  focusShadow: string;
};

/** Fills derived surface tokens when a preset omits explicit values. */
export function resolveThemeColorTokens(
  colors: ThemeColorTokens,
): ResolvedThemeColorTokens {
  return {
    ...colors,
    sidebarBg: colors.sidebarBg ?? colors.panel,
    cardBg: colors.cardBg ?? colors.surface,
    inputBg: colors.inputBg ?? colors.bgElevated,
    focusRing:
      colors.focusRing ??
      `color-mix(in srgb, ${colors.accent} 55%, transparent)`,
    focusShadow:
      colors.focusShadow ??
      `color-mix(in srgb, ${colors.accent} 22%, transparent)`,
  };
}
