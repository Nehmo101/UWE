/**
 * Time-of-day environment presets — the inherited atmosphere made visible.
 *
 * Pure data consumed by editor and Portal viewer alike: map-fixed light
 * direction, a color tint over the Tuschelagen, sky backdrop and fog color.
 * Fog density itself comes from the inherited environment settings.
 */

export type Atlas3DTimeOfDayKey = "morning" | "noon" | "evening" | "night";

export interface EnvironmentPreset {
  key: Atlas3DTimeOfDayKey;
  label: string;
  /** Light direction (will be normalized by the shader). */
  lightDir: readonly [number, number, number];
  /** Multiplied over vertex colors — Tuschelagen tinting. */
  tint: readonly [number, number, number];
  /** Sky backdrop + fog color (hex). */
  sky: string;
  fogColor: string;
}

export const ENVIRONMENT_PRESETS: Record<Atlas3DTimeOfDayKey, EnvironmentPreset> = {
  morning: {
    key: "morning",
    label: "Morgen",
    lightDir: [0.75, 0.5, 0.35],
    tint: [1.04, 1.0, 0.92],
    sky: "#f5eeda",
    fogColor: "#efe6cf",
  },
  noon: {
    key: "noon",
    label: "Mittag",
    lightDir: [0.5, 0.85, 0.55],
    tint: [1, 1, 1],
    sky: "#f1e8d4",
    fogColor: "#e8dec6",
  },
  evening: {
    key: "evening",
    label: "Abend",
    lightDir: [-0.7, 0.35, 0.45],
    tint: [1.08, 0.9, 0.78],
    sky: "#e8d3b4",
    fogColor: "#dbc09a",
  },
  night: {
    key: "night",
    label: "Nacht",
    lightDir: [0.3, 0.9, 0.3],
    tint: [0.62, 0.68, 0.86],
    sky: "#2a2c3a",
    fogColor: "#343648",
  },
};

export function environmentPreset(key: unknown): EnvironmentPreset {
  if (typeof key === "string" && key in ENVIRONMENT_PRESETS) {
    return ENVIRONMENT_PRESETS[key as Atlas3DTimeOfDayKey];
  }
  return ENVIRONMENT_PRESETS.noon;
}
