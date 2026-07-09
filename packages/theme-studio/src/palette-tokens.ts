/**
 * Runtime palette token lists — the authoritative set of color keys a custom
 * theme must (and may) provide. Mirrors `ThemeColorTokens` in
 * `@uwe/shared-ui/theme/tokens.ts`; kept as a runtime list here (a type has no
 * runtime form) so the generator and validator can check completeness without a
 * `@uwe/shared-ui` dependency. Keep in sync when tokens change.
 */

/** Colors every custom palette must define (drives `--uwe-*` core variables). */
export const REQUIRED_PALETTE_KEYS = [
  "bg",
  "bgElevated",
  "surface",
  "panel",
  "border",
  "borderMuted",
  "fg",
  "fgMuted",
  "fgSubtle",
  "accent",
  "accentHover",
  "accentMuted",
  "danger",
  "warning",
  "success",
  "info",
  "wikiLink",
  "wikiLinkHover",
  "dmOnly",
  "playerVisible",
  "shellGradientStart",
  "shellGradientMid",
  "shellGradientEnd",
] as const;

/** Optional colors — derived from required ones when omitted (see resolveColorTokens). */
export const OPTIONAL_PALETTE_KEYS = [
  "link",
  "sidebarBg",
  "sidebarFg",
  "sidebarFgMuted",
  "cardBg",
  "inputBg",
  "focusRing",
  "focusShadow",
] as const;

export type RequiredPaletteKey = (typeof REQUIRED_PALETTE_KEYS)[number];
export type OptionalPaletteKey = (typeof OPTIONAL_PALETTE_KEYS)[number];
export type PaletteKey = RequiredPaletteKey | OptionalPaletteKey;

/** A palette as a loose key→color map (values are CSS colors, usually hex). */
export type PaletteColors = Record<string, string>;

export const ALL_PALETTE_KEYS: readonly string[] = [
  ...REQUIRED_PALETTE_KEYS,
  ...OPTIONAL_PALETTE_KEYS,
];
