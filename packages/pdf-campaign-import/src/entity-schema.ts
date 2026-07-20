export const EXTRACTABLE_KINDS = [
  "npc",
  "location",
  "region",
  "faction",
  "item",
  "quest",
  "encounter",
  "lore",
  "note",
] as const;

export type ExtractedCampaignEntityKind = (typeof EXTRACTABLE_KINDS)[number];

export interface ExtractedCampaignEntity {
  kind: ExtractedCampaignEntityKind;
  title: string;
  summary?: string | null;
  body: string;
  tags?: string[];
}
