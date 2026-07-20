import type { PageType } from "@uwe/database/server";

const PAGE_TYPE_BY_KIND: Readonly<Record<string, PageType>> = {
  npc: "npc",
  location: "location",
  region: "region",
  faction: "faction",
  item: "item",
  quest: "quest",
  encounter: "encounter",
  lore: "lore",
  note: "note",
};

export function kindToPageType(kind: string): PageType {
  return PAGE_TYPE_BY_KIND[kind] ?? "lore";
}
