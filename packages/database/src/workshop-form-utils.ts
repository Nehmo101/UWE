import type {
  WorkshopChecklistItem,
  WorkshopColorEntry,
  WorkshopFilamentEntry,
  WorkshopLinkEntry,
  WorkshopMaterialEntry,
  WorkshopPhotoEntry,
} from "./workshop-types";
import {
  asChecklist,
  asColorList,
  asFilamentList,
  asLinkList,
  asMaterialList,
  asPhotoList,
} from "./workshop-types";

function splitLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseMaterialsFromForm(raw: string): WorkshopMaterialEntry[] {
  return splitLines(raw).map((line) => {
    const [name, quantity, acquiredFlag] = line.split("|").map((part) => part.trim());
    const acquired =
      acquiredFlag?.toLowerCase() === "ja" ||
      acquiredFlag?.toLowerCase() === "yes" ||
      acquiredFlag === "1"
        ? true
        : acquiredFlag?.toLowerCase() === "nein" ||
            acquiredFlag?.toLowerCase() === "no" ||
            acquiredFlag === "0"
          ? false
          : undefined;
    return { name: name || line, quantity: quantity || undefined, acquired };
  });
}

export function formatMaterialsForForm(materials: unknown): string {
  return asMaterialList(materials)
    .map((entry) => {
      const parts = [entry.name];
      if (entry.quantity) parts.push(entry.quantity);
      if (entry.acquired === true) parts.push("ja");
      if (entry.acquired === false) parts.push("nein");
      return parts.join(" | ");
    })
    .join("\n");
}

export function parseColorsFromForm(raw: string): WorkshopColorEntry[] {
  return splitLines(raw).map((line) => {
    const brandMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (!brandMatch) return { name: line };
    const rest = brandMatch[2] ?? "";
    const codeMatch = rest.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (codeMatch) {
      return { brand: brandMatch[1], name: codeMatch[1]!.trim(), code: codeMatch[2] };
    }
    return { brand: brandMatch[1], name: rest.trim() };
  });
}

export function formatColorsForForm(colors: unknown): string {
  return asColorList(colors)
    .map((entry) => {
      const label = entry.brand ? `${entry.brand}: ${entry.name}` : entry.name;
      return entry.code ? `${label} (${entry.code})` : label;
    })
    .join("\n");
}

export function parseFilamentsFromForm(raw: string): WorkshopFilamentEntry[] {
  return splitLines(raw).map((line) => {
    const [material, brand, color, spool] = line.split("|").map((part) => part.trim());
    return {
      material: material || line,
      brand: brand || undefined,
      color: color || undefined,
      spool: spool || undefined,
    };
  });
}

export function formatFilamentsForForm(filaments: unknown): string {
  return asFilamentList(filaments)
    .map((entry) => [entry.material, entry.brand, entry.color, entry.spool].filter(Boolean).join(" | "))
    .join("\n");
}

export function parseLinksFromForm(raw: string): WorkshopLinkEntry[] {
  return splitLines(raw).map((line) => {
    const [label, url, kind] = line.split("|").map((part) => part.trim());
    if (url) {
      return {
        label: label || url,
        url,
        kind: (kind as WorkshopLinkEntry["kind"]) || undefined,
      };
    }
    return { label: line, url: line };
  });
}

export function formatLinksForForm(links: unknown): string {
  return asLinkList(links)
    .map((entry) => [entry.label, entry.url, entry.kind].filter(Boolean).join(" | "))
    .join("\n");
}

export function parsePhotosFromForm(raw: string): WorkshopPhotoEntry[] {
  return splitLines(raw).map((line) => {
    const [url, caption] = line.split("|").map((part) => part.trim());
    return { url: url || line, caption: caption || undefined };
  });
}

export function formatPhotosForForm(photos: unknown): string {
  return asPhotoList(photos)
    .map((entry) => (entry.caption ? `${entry.url} | ${entry.caption}` : entry.url))
    .join("\n");
}

export function parseChecklistFromForm(raw: string): WorkshopChecklistItem[] {
  return splitLines(raw).map((line) => {
    const checked = /^\[x\]/i.test(line) || /^✓/.test(line);
    const item = line.replace(/^\[[ x]\]\s*/i, "").replace(/^✓\s*/, "").trim();
    return { item, checked };
  });
}

export function formatChecklistForForm(items: unknown): string {
  return asChecklist(items)
    .map((entry) => `${entry.checked ? "[x]" : "[ ]"} ${entry.item}`)
    .join("\n");
}
