import type { WorkshopPaintTarget, WorkshopRentalStatus } from "./generated/prisma-brain/client";

export interface WorkshopMaterialEntry {
  name: string;
  quantity?: string;
  acquired?: boolean;
}

export interface WorkshopColorEntry {
  brand?: string;
  name: string;
  code?: string;
}

export interface WorkshopFilamentEntry {
  brand?: string;
  material: string;
  color?: string;
  spool?: string;
}

export interface WorkshopLinkEntry {
  label: string;
  url: string;
  kind?: "stl" | "shop" | "reference" | "other";
}

export interface WorkshopPhotoEntry {
  url: string;
  caption?: string;
}

export interface WorkshopChecklistItem {
  item: string;
  checked: boolean;
}

export interface WorkshopOpenTask {
  id: string;
  title: string;
  projectType: string;
  status: string;
  nextAction: string;
  href: string;
}

export const WORKSHOP_PAINT_TARGET_LABELS: Record<WorkshopPaintTarget, string> = {
  miniature: "Miniatur",
  terrain: "Terrain",
  diorama: "Diorama",
  other: "Sonstiges",
};

export const WORKSHOP_RENTAL_STATUS_LABELS: Record<WorkshopRentalStatus, string> = {
  available: "Verfügbar",
  reserved: "Reserviert",
  on_loan: "Ausgeliehen",
  maintenance: "Wartung",
  retired: "Ausgemustert",
};

export function asMaterialList(value: unknown): WorkshopMaterialEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return { name: entry };
      if (entry && typeof entry === "object" && "name" in entry) {
        const row = entry as WorkshopMaterialEntry;
        return { name: String(row.name), quantity: row.quantity, acquired: row.acquired };
      }
      return null;
    })
    .filter((entry): entry is WorkshopMaterialEntry => Boolean(entry?.name));
}

export function asColorList(value: unknown): WorkshopColorEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return { name: entry };
      if (entry && typeof entry === "object" && "name" in entry) {
        const row = entry as WorkshopColorEntry;
        return { name: String(row.name), brand: row.brand, code: row.code };
      }
      return null;
    })
    .filter((entry): entry is WorkshopColorEntry => Boolean(entry?.name));
}

export function asFilamentList(value: unknown): WorkshopFilamentEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return { material: entry };
      if (entry && typeof entry === "object" && "material" in entry) {
        const row = entry as WorkshopFilamentEntry;
        return {
          material: String(row.material),
          brand: row.brand,
          color: row.color,
          spool: row.spool,
        };
      }
      return null;
    })
    .filter((entry): entry is WorkshopFilamentEntry => Boolean(entry?.material));
}

export function asLinkList(value: unknown): WorkshopLinkEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return { label: entry, url: entry };
      if (entry && typeof entry === "object" && "url" in entry) {
        const row = entry as WorkshopLinkEntry;
        return {
          label: String(row.label || row.url),
          url: String(row.url),
          kind: row.kind,
        };
      }
      return null;
    })
    .filter((entry): entry is WorkshopLinkEntry => Boolean(entry?.url));
}

export function asPhotoList(value: unknown): WorkshopPhotoEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return { url: entry };
      if (entry && typeof entry === "object" && "url" in entry) {
        const row = entry as WorkshopPhotoEntry;
        return { url: String(row.url), caption: row.caption };
      }
      return null;
    })
    .filter((entry): entry is WorkshopPhotoEntry => Boolean(entry?.url));
}

export function asChecklist(value: unknown): WorkshopChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (entry && typeof entry === "object" && "item" in entry) {
        const row = entry as WorkshopChecklistItem;
        return { item: String(row.item), checked: Boolean(row.checked) };
      }
      return null;
    })
    .filter((entry): entry is WorkshopChecklistItem => Boolean(entry?.item));
}

export function countMaterialsNeeded(materials: unknown): { total: number; missing: number } {
  const list = asMaterialList(materials);
  const missing = list.filter((entry) => entry.acquired === false).length;
  return { total: list.length, missing };
}

export function firstPhotoUrl(...sources: unknown[]): string | null {
  for (const source of sources) {
    const photos = asPhotoList(source);
    if (photos[0]?.url) return photos[0].url;
  }
  return null;
}
