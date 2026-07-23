/**
 * Atlas 3D editor document model.
 *
 * Framework-agnostic types shared by the Studio editor, the Portal viewer and
 * the persistence layer. Atlas 3D content is entirely player-visible by owner
 * decision (2026-07-21) — there are deliberately no visibility fields here.
 */

export const ATLAS3D_LEVELS = ["globe", "continent", "landscape", "city"] as const;
export type Atlas3DLevel = (typeof ATLAS3D_LEVELS)[number];

export const ATLAS3D_STYLE_PRESETS = ["pergament"] as const;
export type Atlas3DStylePreset = (typeof ATLAS3D_STYLE_PRESETS)[number];

/** Reduced ink palette — the only hues assets may use (in Tuschelagen shades). */
export const ATLAS3D_PALETTE = {
  paper: "#f1e8d4",
  ink: "#211d17",
  sepia: "#7a5a3a",
  terra: "#c2622b",
  teal: "#2f6f63",
  blue: "#35597e",
} as const;
export type Atlas3DPaletteHue = keyof typeof ATLAS3D_PALETTE;

/** Time of day drives the fixed-direction map light (never camera-relative). */
export type Atlas3DTimeOfDay = "morning" | "noon" | "evening" | "night";

/** Weather overlay: cloud puffs and precipitation particles, inherited like all environment fields. */
export const ATLAS3D_WEATHER_KINDS = ["klar", "wolken", "regen", "schnee"] as const;
export type Atlas3DWeather = (typeof ATLAS3D_WEATHER_KINDS)[number];

/**
 * Environment settings inherited down the node chain. Every field is optional:
 * `undefined` means "inherit from ancestor"; a value overrides for the node
 * and everything below it.
 */
export interface Atlas3DEnvironment {
  timeOfDay?: Atlas3DTimeOfDay;
  /** Azimuth of the map light in degrees — fixed relative to the map. */
  lightAzimuthDeg?: number;
  /** 0 = clear … 1 = dense. */
  fogDensity?: number;
  /** Sea level in node units; water planes render at this height. */
  waterLevel?: number;
  /** Climate key feeding procedural generators (biomes, names). */
  climate?: string;
  weather?: Atlas3DWeather;
}

/** Fully-resolved environment after walking the inheritance chain. */
export interface Atlas3DResolvedEnvironment {
  timeOfDay: Atlas3DTimeOfDay;
  lightAzimuthDeg: number;
  fogDensity: number;
  waterLevel: number;
  climate: string;
  weather: Atlas3DWeather;
}

export const ATLAS3D_ENVIRONMENT_DEFAULTS: Atlas3DResolvedEnvironment = {
  timeOfDay: "noon",
  lightAzimuthDeg: 315,
  fogDensity: 0,
  waterLevel: 0,
  climate: "temperate",
  weather: "klar",
};

/** One entry of the ancestor chain, root (world defaults) first. */
export interface Atlas3DChainEntry {
  id: string;
  title: string;
  level: Atlas3DLevel | "world";
  stylePreset?: string | null;
  environment?: Atlas3DEnvironment | null;
  seed?: number | null;
  /** Asset sets offered on this level and below (undefined = inherit). */
  paletteScope?: readonly string[] | null;
}

export interface Atlas3DNodeSnapshot {
  id: string;
  parentId: string | null;
  level: Atlas3DLevel;
  title: string;
  slug: string;
  seed: number;
  extent: unknown;
  silhouette: unknown;
  environment: Atlas3DEnvironment | null;
  stylePresetOverride: string | null;
  sortOrder: number;
}

export function isAtlas3DLevel(value: unknown): value is Atlas3DLevel {
  return typeof value === "string" && (ATLAS3D_LEVELS as readonly string[]).includes(value);
}

/** Child level when drilling down from `level`; null on the deepest level. */
export function childLevelOf(level: Atlas3DLevel): Atlas3DLevel | null {
  const index = ATLAS3D_LEVELS.indexOf(level);
  return index >= 0 && index < ATLAS3D_LEVELS.length - 1 ? ATLAS3D_LEVELS[index + 1] : null;
}
