import type { MarkdownImportPreviewItem } from "@uwe/database/import-constants";
import type { ExtractedCampaignEntity } from "./entity-schema";
import { kindToPageType } from "./kind-page-type";

export interface CampaignImportPreview {
  items: MarkdownImportPreviewItem[];
  entities: ExtractedCampaignEntity[];
  totalDocuments: number;
  errors: string[];
  canExecute: boolean;
}

function excerpt(entity: ExtractedCampaignEntity): string {
  const value = entity.summary?.trim() || entity.body.trim();
  return value.replace(/\s+/g, " ").slice(0, 240);
}

export function buildCampaignPreview(
  entities: readonly ExtractedCampaignEntity[],
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
    canExecute: copiedEntities.length > 0,
  };
}
