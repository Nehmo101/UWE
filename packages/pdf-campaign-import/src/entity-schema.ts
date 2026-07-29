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
  /**
   * PDF-Seiten, aus denen der Chunk stammte, der diese Entität ergab. Nur beim
   * OCR-Pfad gesetzt (der Textlayer kennt keine Seitengrenzen). Dient dazu, die
   * auf denselben Seiten erkannten Abbildungen der richtigen Wiki-Seite
   * anzuhängen — nicht vom Modell befüllt, sondern aus den Seiten-Markern.
   */
  sourcePages?: number[];
}
