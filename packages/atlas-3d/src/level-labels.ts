/** German display labels for the Atlas 3D level hierarchy (shared by Studio + Portal). */
export const ATLAS3D_LEVEL_LABELS: Record<string, string> = {
  globe: "Globus",
  continent: "Kontinent",
  landscape: "Landschaft",
  city: "Stadt",
};

export function atlas3DLevelLabel(level: string): string {
  return ATLAS3D_LEVEL_LABELS[level] ?? level;
}
