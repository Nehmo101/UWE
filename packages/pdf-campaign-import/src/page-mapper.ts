import type { CreatePageInput } from "@uwe/database/server";
import type { ExtractedCampaignEntity } from "./entity-schema";
import { kindToPageType } from "./kind-page-type";

export interface CampaignPageMappingContext {
  worldId: string;
  campaignId: string;
  slug: string;
  importJobId: string;
  sourceFile: string;
}

export function entityToCreatePageInput(
  entity: ExtractedCampaignEntity,
  context: CampaignPageMappingContext,
): CreatePageInput {
  return {
    worldId: context.worldId,
    campaignId: context.campaignId,
    title: entity.title,
    slug: context.slug,
    type: kindToPageType(entity.kind),
    summary: entity.summary?.trim() || null,
    tags: entity.tags?.slice() ?? [],
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content: entity.body,
        metadata: {
          source: "pdf-campaign-import",
          importJobId: context.importJobId,
          sourceFile: context.sourceFile,
          extractedKind: entity.kind,
          aiRoute: "local_rtx",
        },
      },
    ],
  };
}
