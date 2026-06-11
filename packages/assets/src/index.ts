/**
 * UWE Assets — placeholder for future phases.
 * Planned: maps, handouts, soundboard assets, dungeon cockpit media.
 */

export type AssetType = "map" | "handout" | "sound" | "image" | "document";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  path: string;
}

export const ASSETS_PACKAGE_VERSION = "0.1.0";
