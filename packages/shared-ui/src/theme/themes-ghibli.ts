import type { ThemeColorTokens } from "./tokens";

/**
 * „Gemalte Welt" — das Hell/Dunkel-Paar des Ghibli-Redesigns.
 *
 * Alle Farbwerte stammen aus der Token-Tabelle des Design-Handoffs
 * (`design_handoff_ghibli_redesign/README.md`, Abschnitt „Design-Tokens").
 * Die Handoff-Namen stehen als Kommentar hinter jedem Wert, damit ein späterer
 * Abgleich mit dem Handoff ohne Rätselraten funktioniert.
 *
 * Drei Rollen fordert `ThemeColorTokens`, die der Handoff nicht benennt; sie
 * sind abgeleitet, nicht erfunden:
 *   - `bgElevated` — die Chrome-/Panel-Farbe des Handoffs bei voller Deckkraft.
 *   - `borderMuted` — dieselbe Farbe wie `border` mit reduziertem Alpha
 *     (Konvention der Bestandsthemes, vgl. `uwe-parchment-os`).
 *   - `accentHover` — der Handoff beschreibt Hover als `filter: brightness(1.12)`
 *     statt als Farbe; `color-mix` mit der Papierfarbe bildet das nach.
 * `warning` kennt der Handoff nicht — hier bleibt der etablierte
 * UWE-Parchment-Bernstein `#e0b15a`.
 *
 * Der Produktakzent (`--acc`/`--acc-bg`) ist **pro App** unterschiedlich und
 * steht deshalb nicht hier, sondern in `AppAccentScope`: die Theme-Engine
 * schreibt `--uwe-accent` als Inline-Style auf `<html>`, wo keine
 * Stylesheet-Regel mehr herankommt. Ein Wrapper-Element setzt die Property für
 * seinen Teilbaum erneut inline und gewinnt dadurch. Der Wert hier ist der
 * Landing-/Studio-Akzent, also der Default ohne Scope.
 */

const GHIBLI_TAG_COLORS: ThemeColorTokens = {
  bg: "#f1e8d4", // --ground
  bgElevated: "#fbf6ea", // --chrome/--panel bei voller Deckkraft
  surface: "rgba(251, 246, 234, 0.88)", // --panel (Glaskarten)
  panel: "rgba(251, 246, 234, 0.92)", // --chrome (Topbar/Nav)
  border: "#e0d4ba", // --panel-bd
  borderMuted: "rgba(224, 212, 186, 0.7)", // --panel-bd, reduziert
  fg: "#211d17", // --ink
  fgMuted: "#4a4336", // --ink2
  fgSubtle: "#8a7d64", // --ink3
  accent: "#c2622b", // --acc (Landing + Studio, hell)
  accentHover: "color-mix(in srgb, #c2622b 88%, #fbf5e6)", // brightness(1.12)
  accentMuted: "rgba(194, 98, 43, 0.13)", // --acc-bg
  link: "#1a5c4f", // --teal
  danger: "#a8541b", // --terra
  warning: "#e0b15a",
  success: "#1a5c4f", // --teal
  info: "#1a5c4f", // --teal
  wikiLink: "#1a5c4f", // --teal
  wikiLinkHover: "#2f6f63", // Hover-Border der Portal-Karte
  dmOnly: "#a8541b", // --terra
  playerVisible: "#1a5c4f", // --teal
  // Der gemalte Hintergrund ist die Bühne — der Shell-Verlauf bleibt praktisch
  // unsichtbar, damit er die Szene nicht überlagert.
  shellGradientStart: "rgba(194, 98, 43, 0.03)",
  shellGradientMid: "rgba(241, 232, 212, 0.05)",
  shellGradientEnd: "#f1e8d4", // --ground
  sidebarBg: "#211d17", // --side-bg
  sidebarFg: "#cfc4ab", // --side-ink
  sidebarFgMuted: "#8f8574", // --side-label
  cardBg: "rgba(251, 246, 234, 0.88)", // --panel
  inputBg: "rgba(33, 29, 23, 0.08)", // --field
};

const GHIBLI_NACHT_COLORS: ThemeColorTokens = {
  bg: "#100e16", // --ground
  bgElevated: "#12101a", // --panel bei voller Deckkraft
  surface: "rgba(18, 16, 26, 0.74)", // --panel (Glaskarten)
  panel: "rgba(14, 12, 20, 0.92)", // --chrome (Topbar/Nav)
  border: "rgba(225, 215, 195, 0.17)", // --panel-bd
  borderMuted: "rgba(225, 215, 195, 0.1)", // --panel-bd, reduziert
  fg: "#f1e8d4", // --ink
  fgMuted: "#c9bfaf", // --ink2
  fgSubtle: "#948b78", // --ink3
  accent: "#e8a670", // --acc (Landing + Studio, dunkel)
  accentHover: "color-mix(in srgb, #e8a670 88%, #fbf5e6)", // brightness(1.12)
  accentMuted: "rgba(232, 166, 112, 0.16)", // --acc-bg
  link: "#7fd0b4", // --teal
  danger: "#e8a670", // --terra
  warning: "#e0b15a",
  success: "#7fd0b4", // --teal
  info: "#7fd0b4", // --teal
  wikiLink: "#7fd0b4", // --teal
  wikiLinkHover: "color-mix(in srgb, #7fd0b4 88%, #fbf5e6)",
  dmOnly: "#e8a670", // --terra
  playerVisible: "#7fd0b4", // --teal
  shellGradientStart: "rgba(232, 166, 112, 0.04)",
  shellGradientMid: "rgba(16, 14, 22, 0.05)",
  shellGradientEnd: "#100e16", // --ground
  sidebarBg: "#0d0b13", // --side-bg
  sidebarFg: "#c2b9ab", // --side-ink
  sidebarFgMuted: "#7d7565", // --side-label
  cardBg: "rgba(18, 16, 26, 0.74)", // --panel
  inputBg: "rgba(241, 232, 212, 0.07)", // --field
};

export const GHIBLI_THEMES = {
  "uwe-ghibli-tag": {
    id: "uwe-ghibli-tag" as const,
    label: "Gemalte Welt — Tag",
    description:
      "Parchment OS über gemalter Landschaft: warmes Papier, Tinte-Sidebar, Terrakotta-Akzent.",
    colors: GHIBLI_TAG_COLORS,
    // `background: "none"` ist Pflicht, nicht Geschmack: das Canvas von
    // BackgroundEffect liegt auf derselben Ebene wie die gemalte Szene.
    defaults: { font: "mono" as const, background: "none" as const, frostedGlass: true },
  },
  "uwe-ghibli-nacht": {
    id: "uwe-ghibli-nacht" as const,
    label: "Gemalte Welt — Nacht",
    description:
      "Nachttusche über gemalter Landschaft: tiefes Indigo, Papiertext, warmer Laternen-Akzent.",
    colors: GHIBLI_NACHT_COLORS,
    defaults: { font: "mono" as const, background: "none" as const, frostedGlass: true },
  },
};

export type GhibliThemeId = keyof typeof GHIBLI_THEMES;

/** Hell/Dunkel-Zuordnung des Paars — Quelle für `PaintedScene` und den Toggle. */
export const GHIBLI_MODE_BY_THEME = {
  "uwe-ghibli-tag": "hell",
  "uwe-ghibli-nacht": "dunkel",
} as const satisfies Record<GhibliThemeId, "hell" | "dunkel">;

/** Das jeweils andere Theme des Paars — der Toggle braucht nichts weiter. */
export const GHIBLI_COUNTERPART = {
  "uwe-ghibli-tag": "uwe-ghibli-nacht",
  "uwe-ghibli-nacht": "uwe-ghibli-tag",
} as const satisfies Record<GhibliThemeId, GhibliThemeId>;
