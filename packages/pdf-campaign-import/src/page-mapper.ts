import type { CreatePageInput } from "@uwe/database/server";
import type { ExtractedCampaignEntity } from "./entity-schema";
import { kindToPageType } from "./kind-page-type";

export interface CampaignPageMappingContext {
  worldId: string;
  campaignId: string;
  slug: string;
  importJobId: string;
  sourceFile: string;
  /**
   * Titel des Bandes, aus dem der Eintrag stammt — bei fremden Kampagnenbüchern
   * der einzige Weg, später noch zu erkennen, was eigenes Material ist und was
   * nicht. Ohne Angabe wird der Dateiname verwendet.
   */
  sourceTitle?: string;
  /**
   * `third_party` markiert lizenziertes Fremdmaterial. Das ist keine technische
   * Sperre — Sichtbarkeit hängt in UWE allein an der Welt-Zuordnung —, sondern
   * ein sichtbarer Hinweis auf der Seite, damit fremdes und eigenes Material
   * nach Monaten noch unterscheidbar bleiben.
   */
  licence?: "own" | "third_party";
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
          sourceTitle: context.sourceTitle?.trim() || context.sourceFile,
          licence: context.licence ?? "own",
          extractedKind: entity.kind,
          aiRoute: "local_engine",
        },
      },
    ],
  };
}
