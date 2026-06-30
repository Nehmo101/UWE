/** Client-safe Life Brain category labels (mirrors life-admin-service). */
export const PERSONAL_BRAIN_CATEGORIES = [
  "uwe_coding",
  "hardware_homelab",
  "contracts_expenses",
  "art_workshop",
  "miniatures_terrain",
  "printing_3d",
  "troubleshooting",
  "personal_notes",
] as const;

export const PERSONAL_BRAIN_CATEGORY_LABELS: Record<
  (typeof PERSONAL_BRAIN_CATEGORIES)[number],
  string
> = {
  uwe_coding: "UWE/Coding",
  hardware_homelab: "Hardware/Homelab",
  contracts_expenses: "Verträge/Ausgaben",
  art_workshop: "Kunst/Werkstatt",
  miniatures_terrain: "Miniaturen/Terrain",
  printing_3d: "3D-Druck",
  troubleshooting: "Anleitungen/Troubleshooting",
  personal_notes: "Persönliche Notizen",
};
