import type { MarkdownImportPreviewItem } from "@uwe/database/import-constants";
import type { ExtractedCampaignEntity } from "./entity-schema";
import { kindToPageType } from "./kind-page-type";

export interface CampaignImportPreview {
  items: MarkdownImportPreviewItem[];
  entities: ExtractedCampaignEntity[];
  totalDocuments: number;
  errors: string[];
  /**
   * Hinweise zum Lauf, die kein Fehler sind — etwa dass die Seiten über OCR
   * gelesen wurden oder wie viele Seiten der Cap abgeschnitten hat. Getrennt
   * von `errors`, weil die UI Fehler rot rendert und ein geglückter OCR-Lauf
   * nicht als Fehlschlag aussehen darf.
   */
  notes: string[];
  canExecute: boolean;
}

/**
 * Client-facing shape of a preview: the full AI-extracted entity bodies are
 * dropped, since the UI renders only `items` (240-char excerpts). Execute paths
 * re-read the entities from the stored job payload, never from the client.
 */
export type CampaignImportPreviewSummary = Omit<CampaignImportPreview, "entities">;

export function toCampaignPreviewSummary(
  preview: CampaignImportPreview,
): CampaignImportPreviewSummary {
  const { entities: _entities, ...summary } = preview;
  return summary;
}

function excerpt(entity: ExtractedCampaignEntity): string {
  const value = entity.summary?.trim() || entity.body.trim();
  return value.replace(/\s+/g, " ").slice(0, 240);
}

export function buildCampaignPreview(
  entities: readonly ExtractedCampaignEntity[],
  notes: readonly string[] = [],
): CampaignImportPreview {
  const copiedEntities = entities.map((entity) => ({ ...entity, tags: entity.tags?.slice() }));
  const items = copiedEntities.map((entity, index) => ({
    itemId: "ent-" + index,
    title: entity.title,
    excerpt: excerpt(entity),
    pageType: kindToPageType(entity.kind),
    category: entity.kind,
    tags: entity.tags,
  }));

  return {
    items,
    entities: copiedEntities,
    totalDocuments: copiedEntities.length,
    errors: [],
    notes: [...notes],
    canExecute: copiedEntities.length > 0,
  };
}
