/**
 * Inheritance resolution for the Atlas 3D node chain.
 *
 * Every setting is resolved root→leaf: the world entry provides defaults, each
 * node may override individual fields, everything else flows down unchanged.
 * The same pure function is used by the Studio editor, the Portal viewer and
 * exports, so all three always agree on the effective settings.
 */

import {
  ATLAS3D_ENVIRONMENT_DEFAULTS,
  type Atlas3DChainEntry,
  type Atlas3DEnvironment,
  type Atlas3DResolvedEnvironment,
} from "./doc";

export interface Atlas3DEffectiveSettings {
  stylePreset: string;
  environment: Atlas3DResolvedEnvironment;
  seed: number;
  paletteScope: readonly string[];
  /**
   * Per-field origin: chain entry id that provided the effective value.
   * Drives the "Geerbt von …" badges in the inspector.
   */
  origins: {
    stylePreset: string;
    environment: Record<keyof Atlas3DResolvedEnvironment, string>;
    seed: string;
    paletteScope: string;
  };
}

export const ATLAS3D_DEFAULT_PALETTE_SCOPE: readonly string[] = ["natur", "siedlung", "gewaesser", "weltenbau"];

const ENVIRONMENT_KEYS = Object.keys(ATLAS3D_ENVIRONMENT_DEFAULTS) as (keyof Atlas3DResolvedEnvironment)[];

function hasValue<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Resolve the effective settings for the LAST entry of the chain.
 * The chain must be ordered root (world defaults) → … → target node.
 * An empty chain yields the built-in defaults with origin "default".
 */
export function resolveEffectiveNodeSettings(chain: readonly Atlas3DChainEntry[]): Atlas3DEffectiveSettings {
  const environment: Atlas3DResolvedEnvironment = { ...ATLAS3D_ENVIRONMENT_DEFAULTS };
  const environmentOrigins = Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [key, "default"])) as Record<
    keyof Atlas3DResolvedEnvironment,
    string
  >;

  let stylePreset = "pergament";
  let stylePresetOrigin = "default";
  let seed = 1;
  let seedOrigin = "default";
  let paletteScope = ATLAS3D_DEFAULT_PALETTE_SCOPE;
  let paletteScopeOrigin = "default";

  for (const entry of chain) {
    if (hasValue(entry.stylePreset) && entry.stylePreset.length > 0) {
      stylePreset = entry.stylePreset;
      stylePresetOrigin = entry.id;
    }
    if (hasValue(entry.seed)) {
      seed = entry.seed;
      seedOrigin = entry.id;
    }
    if (hasValue(entry.paletteScope)) {
      paletteScope = entry.paletteScope;
      paletteScopeOrigin = entry.id;
    }
    const env: Atlas3DEnvironment | null | undefined = entry.environment;
    if (hasValue(env)) {
      for (const key of ENVIRONMENT_KEYS) {
        const value = env[key];
        if (value !== undefined) {
          (environment[key] as typeof value) = value;
          environmentOrigins[key] = entry.id;
        }
      }
    }
  }

  return {
    stylePreset,
    environment,
    seed,
    paletteScope,
    origins: {
      stylePreset: stylePresetOrigin,
      environment: environmentOrigins,
      seed: seedOrigin,
      paletteScope: paletteScopeOrigin,
    },
  };
}

/** True when the given chain entry (usually the leaf) overrides the field itself. */
export function isOverriddenBy(settings: Atlas3DEffectiveSettings, field: keyof Atlas3DEffectiveSettings["origins"], entryId: string): boolean {
  if (field === "environment") {
    return Object.values(settings.origins.environment).includes(entryId);
  }
  return settings.origins[field] === entryId;
}
