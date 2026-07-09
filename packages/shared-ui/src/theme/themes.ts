import type {
  BackgroundPatternId,
  DensityId,
  FontFamilyId,
  ThemeColorTokens,
} from "./tokens";

export type ThemeId =
  | "uwe-default"
  | "uwe-dark-fantasy"
  | "uwe-charcoal-desk"
  | "uwe-night-observatory"
  | "uwe-parchment-study"
  | "uwe-parchment-os"
  | "uwe-parchment-teal"
  | "uwe-phosphor-console"
  | "terra"
  | "hells";

export interface UweThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  colors: ThemeColorTokens;
  defaults?: {
    font?: FontFamilyId;
    density?: DensityId;
    background?: BackgroundPatternId;
    frostedGlass?: boolean;
    bgEffectColor?: string;
    bgEffectIntensity?: number;
  };
}

/**
 * UWE-authored theme palettes. Product code uses UWE-native IDs and hex values only.
 * External AGPL projects may inform UX research — never copy their source or palettes 1:1.
 */
export const UWE_THEMES: Record<ThemeId, UweThemeDefinition> = {
  "uwe-default": {
    id: "uwe-default",
    label: "UWE Default",
    description: "Slate workspace with indigo accents — Studio baseline.",
    colors: {
      bg: "#0b1220",
      bgElevated: "#0f172a",
      surface: "rgba(15, 23, 42, 0.55)",
      panel: "rgba(8, 12, 22, 0.85)",
      border: "rgba(148, 163, 184, 0.18)",
      borderMuted: "rgba(148, 163, 184, 0.12)",
      fg: "#e2e8f0",
      fgMuted: "#94a3b8",
      fgSubtle: "#64748b",
      accent: "#6366f1",
      accentHover: "#818cf8",
      accentMuted: "rgba(99, 102, 241, 0.15)",
      danger: "#f87171",
      warning: "#fbbf24",
      success: "#4ade80",
      info: "#38bdf8",
      wikiLink: "#38bdf8",
      wikiLinkHover: "#7dd3fc",
      dmOnly: "#fbbf24",
      playerVisible: "#86efac",
      shellGradientStart: "rgba(99, 102, 241, 0.18)",
      shellGradientMid: "rgba(56, 189, 248, 0.1)",
      shellGradientEnd: "#060a12",
    },
    defaults: { background: "none", frostedGlass: true },
  },
  "uwe-dark-fantasy": {
    id: "uwe-dark-fantasy",
    label: "Dark Fantasy",
    description: "Deep navy fantasy workspace with cyan highlights.",
    colors: {
      bg: "#070d18",
      bgElevated: "#0c1528",
      surface: "rgba(12, 21, 40, 0.62)",
      panel: "rgba(6, 10, 20, 0.88)",
      border: "rgba(100, 116, 139, 0.22)",
      borderMuted: "rgba(100, 116, 139, 0.14)",
      fg: "#dbeafe",
      fgMuted: "#93c5fd",
      fgSubtle: "#64748b",
      accent: "#22d3ee",
      accentHover: "#67e8f9",
      accentMuted: "rgba(34, 211, 238, 0.14)",
      danger: "#fb7185",
      warning: "#fcd34d",
      success: "#6ee7b7",
      info: "#7dd3fc",
      wikiLink: "#67e8f9",
      wikiLinkHover: "#a5f3fc",
      dmOnly: "#f59e0b",
      playerVisible: "#86efac",
      shellGradientStart: "rgba(34, 211, 238, 0.12)",
      shellGradientMid: "rgba(99, 102, 241, 0.14)",
      shellGradientEnd: "#030712",
    },
    defaults: { background: "constellation", frostedGlass: true, bgEffectIntensity: 0.55 },
  },
  "uwe-charcoal-desk": {
    id: "uwe-charcoal-desk",
    label: "Charcoal Desk",
    description: "Muted charcoal shell with cool cyan type — focused editing.",
    colors: {
      bg: "#232830",
      bgElevated: "#2c323c",
      surface: "rgba(24, 28, 36, 0.74)",
      panel: "rgba(16, 19, 26, 0.93)",
      border: "rgba(88, 118, 132, 0.42)",
      borderMuted: "rgba(88, 118, 132, 0.22)",
      fg: "#a8d4e6",
      fgMuted: "#7eb3c9",
      fgSubtle: "#5c7a88",
      accent: "#d4737e",
      accentHover: "#e2949c",
      accentMuted: "rgba(212, 115, 126, 0.15)",
      danger: "#d4737e",
      warning: "#ddb566",
      success: "#72b892",
      info: "#6eb8d4",
      wikiLink: "#6eb8d4",
      wikiLinkHover: "#9ad0e4",
      dmOnly: "#ddb566",
      playerVisible: "#72b892",
      shellGradientStart: "rgba(110, 184, 212, 0.09)",
      shellGradientMid: "rgba(212, 115, 126, 0.07)",
      shellGradientEnd: "#181c22",
    },
    defaults: { font: "mono", background: "none", frostedGlass: false },
  },
  "uwe-night-observatory": {
    id: "uwe-night-observatory",
    label: "Night Observatory",
    description: "Deep blue-black canvas with soft starfield accents.",
    colors: {
      bg: "#101620",
      bgElevated: "#182030",
      surface: "rgba(20, 28, 42, 0.8)",
      panel: "rgba(14, 20, 32, 0.94)",
      border: "rgba(72, 88, 112, 0.5)",
      borderMuted: "rgba(72, 88, 112, 0.28)",
      fg: "#c5d0de",
      fgMuted: "#96a3b5",
      fgSubtle: "#6a7788",
      accent: "#e85d4c",
      accentHover: "#f08072",
      accentMuted: "rgba(232, 93, 76, 0.14)",
      danger: "#e85d4c",
      warning: "#c9a227",
      success: "#3da866",
      info: "#4d9de0",
      wikiLink: "#4d9de0",
      wikiLinkHover: "#76b8eb",
      dmOnly: "#c9a227",
      playerVisible: "#3da866",
      shellGradientStart: "rgba(77, 157, 224, 0.09)",
      shellGradientMid: "rgba(232, 93, 76, 0.05)",
      shellGradientEnd: "#0a1018",
    },
    defaults: {
      background: "constellation",
      frostedGlass: true,
      bgEffectColor: "#d8e2ee",
      bgEffectIntensity: 0.42,
    },
  },
  "uwe-parchment-study": {
    id: "uwe-parchment-study",
    label: "Parchment Study",
    description: "Warm light workspace for long wiki reading sessions.",
    colors: {
      bg: "#f3efe6",
      bgElevated: "#faf7f0",
      surface: "rgba(252, 249, 242, 0.9)",
      panel: "rgba(255, 253, 248, 0.97)",
      border: "rgba(168, 158, 140, 0.5)",
      borderMuted: "rgba(168, 158, 140, 0.28)",
      fg: "#3d3832",
      fgMuted: "#574e40",
      fgSubtle: "#665d4f",
      accent: "#a67c1a",
      accentHover: "#bf9428",
      accentMuted: "rgba(166, 124, 26, 0.11)",
      link: "#155e8a",
      danger: "#a84818",
      warning: "#b8860b",
      success: "#1a7a42",
      info: "#1d6fa8",
      wikiLink: "#1d6fa8",
      wikiLinkHover: "#2a8cc4",
      dmOnly: "#a84818",
      playerVisible: "#1a7a42",
      shellGradientStart: "rgba(166, 124, 26, 0.07)",
      shellGradientMid: "rgba(255, 255, 255, 0.35)",
      shellGradientEnd: "#e8e2d6",
    },
    defaults: { font: "serif", background: "parchment", frostedGlass: false },
  },
  "uwe-parchment-os": {
    id: "uwe-parchment-os",
    label: "Parchment OS",
    description: "Warmes Papier-Studio mit Tinte-Sidebar — neues Studio-Standard-Design.",
    colors: {
      bg: "#f1e8d4",
      bgElevated: "#fbf6ea",
      surface: "rgba(251, 246, 234, 0.95)",
      panel: "#ece1c9",
      border: "#e0d4ba",
      borderMuted: "rgba(224, 212, 186, 0.7)",
      fg: "#211d17",
      fgMuted: "#574e40",
      fgSubtle: "#665d4f",
      accent: "#c2622b",
      accentHover: "#d47030",
      accentMuted: "rgba(194, 98, 43, 0.12)",
      link: "#1a5c4f",
      danger: "#c2622b",
      warning: "#e0b15a",
      success: "#2f6f63",
      info: "#2f6f63",
      wikiLink: "#2f6f63",
      wikiLinkHover: "#3a8878",
      dmOnly: "#c2622b",
      playerVisible: "#2f6f63",
      shellGradientStart: "rgba(194, 98, 43, 0.03)",
      shellGradientMid: "rgba(241, 232, 212, 0.05)",
      shellGradientEnd: "#f1e8d4",
      sidebarBg: "#211d17",
      sidebarFg: "#f1e8d4",
      sidebarFgMuted: "#b6ab92",
      cardBg: "#fbf6ea",
    },
    defaults: { font: "mono", background: "none", frostedGlass: false },
  },
  "uwe-parchment-teal": {
    id: "uwe-parchment-teal",
    label: "Parchment Teal",
    description:
      "Warmes Papier-Studio mit Tinte-Sidebar und Teal-Akzent — spielersichtbares Portal-Design.",
    colors: {
      bg: "#f1e8d4",
      bgElevated: "#fbf6ea",
      surface: "rgba(251, 246, 234, 0.95)",
      panel: "#ece1c9",
      border: "#e0d4ba",
      borderMuted: "rgba(224, 212, 186, 0.7)",
      fg: "#211d17",
      fgMuted: "#574e40",
      fgSubtle: "#665d4f",
      accent: "#2f6f63",
      accentHover: "#3a8878",
      accentMuted: "rgba(47, 111, 99, 0.16)",
      link: "#2f6f63",
      danger: "#c2622b",
      warning: "#e0b15a",
      success: "#2f6f63",
      info: "#2f6f63",
      wikiLink: "#2f6f63",
      wikiLinkHover: "#3a8878",
      dmOnly: "#c2622b",
      playerVisible: "#2f6f63",
      shellGradientStart: "rgba(47, 111, 99, 0.03)",
      shellGradientMid: "rgba(241, 232, 212, 0.05)",
      shellGradientEnd: "#f1e8d4",
      sidebarBg: "#211d17",
      sidebarFg: "#f1e8d4",
      sidebarFgMuted: "#b6ab92",
      cardBg: "#fbf6ea",
    },
    defaults: { font: "mono", background: "none", frostedGlass: false },
  },
  "uwe-phosphor-console": {
    id: "uwe-phosphor-console",
    label: "Phosphor Console",
    description: "Retro green-on-black terminal aesthetic for power users.",
    colors: {
      bg: "#080a08",
      bgElevated: "#101410",
      surface: "rgba(12, 16, 12, 0.88)",
      panel: "rgba(10, 12, 10, 0.96)",
      border: "rgba(36, 92, 52, 0.48)",
      borderMuted: "rgba(36, 92, 52, 0.24)",
      fg: "#2ee86a",
      fgMuted: "#24b856",
      fgSubtle: "#1a7a3e",
      accent: "#2ee86a",
      accentHover: "#5ef090",
      accentMuted: "rgba(46, 232, 106, 0.11)",
      danger: "#f05252",
      warning: "#e6b422",
      success: "#2ee86a",
      info: "#1ad4b8",
      wikiLink: "#1ad4b8",
      wikiLinkHover: "#52e6d0",
      dmOnly: "#e6b422",
      playerVisible: "#2ee86a",
      shellGradientStart: "rgba(46, 232, 106, 0.05)",
      shellGradientMid: "rgba(0, 0, 0, 0.18)",
      shellGradientEnd: "#040604",
    },
    defaults: {
      font: "mono",
      background: "synapse",
      frostedGlass: false,
      bgEffectIntensity: 0.7,
    },
  },
  terra: {
    id: "terra",
    label: "Terra",
    description: "Earthy greens and amber — campaign world default.",
    colors: {
      bg: "#0f1a14",
      bgElevated: "#152820",
      surface: "rgba(21, 40, 32, 0.68)",
      panel: "rgba(12, 22, 17, 0.9)",
      border: "rgba(74, 124, 89, 0.35)",
      borderMuted: "rgba(74, 124, 89, 0.2)",
      fg: "#d8eadf",
      fgMuted: "#9bc4a8",
      fgSubtle: "#6b8f76",
      accent: "#84cc16",
      accentHover: "#a3e635",
      accentMuted: "rgba(132, 204, 22, 0.14)",
      danger: "#ef4444",
      warning: "#eab308",
      success: "#22c55e",
      info: "#38bdf8",
      wikiLink: "#86efac",
      wikiLinkHover: "#bbf7d0",
      dmOnly: "#eab308",
      playerVisible: "#4ade80",
      shellGradientStart: "rgba(132, 204, 22, 0.12)",
      shellGradientMid: "rgba(56, 189, 248, 0.06)",
      shellGradientEnd: "#08120d",
    },
    defaults: { background: "dots", frostedGlass: true },
  },
  hells: {
    id: "hells",
    label: "Hells",
    description: "Infernal crimson and ember glow for diabolic campaigns.",
    colors: {
      bg: "#140808",
      bgElevated: "#1f0c0c",
      surface: "rgba(40, 12, 12, 0.72)",
      panel: "rgba(20, 6, 6, 0.92)",
      border: "rgba(185, 28, 28, 0.35)",
      borderMuted: "rgba(185, 28, 28, 0.2)",
      fg: "#fecaca",
      fgMuted: "#f87171",
      fgSubtle: "#b91c1c",
      accent: "#ef4444",
      accentHover: "#f87171",
      accentMuted: "rgba(239, 68, 68, 0.16)",
      danger: "#ff6b6b",
      warning: "#fb923c",
      success: "#86efac",
      info: "#fca5a5",
      wikiLink: "#fca5a5",
      wikiLinkHover: "#fecaca",
      dmOnly: "#fb923c",
      playerVisible: "#86efac",
      shellGradientStart: "rgba(239, 68, 68, 0.2)",
      shellGradientMid: "rgba(251, 146, 60, 0.1)",
      shellGradientEnd: "#0a0404",
    },
    defaults: {
      background: "noise",
      frostedGlass: true,
      bgEffectColor: "#ef4444",
      bgEffectIntensity: 0.35,
    },
  },
};

export const THEME_LIST = Object.values(UWE_THEMES);

export const DEFAULT_STUDIO_THEME_ID: ThemeId = "uwe-parchment-os";
export const DEFAULT_PORTAL_THEME_ID: ThemeId = "uwe-parchment-os";

export function isThemeId(value: string): value is ThemeId {
  return value in UWE_THEMES;
}

export function getTheme(id: ThemeId): UweThemeDefinition {
  return UWE_THEMES[id];
}

/**
 * Retired theme IDs — mapped to current UWE-native names at read time.
 * The old per-scope defaults (cockpit-red / portal-purple) are remapped to
 * Parchment OS so existing installs adopt the new design with no migration.
 */
export const LEGACY_THEME_ID_MAP: Record<string, ThemeId> = {
  "odysseus-dark-inspired": "uwe-charcoal-desk",
  "odysseus-midnight-inspired": "uwe-night-observatory",
  "odysseus-paper-inspired": "uwe-parchment-study",
  "odysseus-terminal-inspired": "uwe-phosphor-console",
  "uwe-cockpit-red": "uwe-parchment-os",
  "uwe-portal-purple": "uwe-parchment-os",
};

export function resolveThemeId(value: string, fallback: ThemeId): ThemeId {
  if (isThemeId(value)) return value;
  return LEGACY_THEME_ID_MAP[value] ?? fallback;
}
