import { stripDmSections } from "@uwe/auth/dm-section";
import type { ContentBlock, ContentBlockType, Page } from "./generated/prisma/client";

/** Admin / internal metadata keys stripped from player responses. */
const ADMIN_METADATA_KEYS = new Set([
  "internalId",
  "internal_id",
  "ownerId",
  "owner_id",
  "adminNotes",
  "admin_notes",
  "dmNotes",
  "dm_notes",
  "auditLog",
  "audit_log",
  "createdBy",
  "created_by",
  "updatedBy",
  "updated_by",
]);

function stripAdminMetadata(metadata: unknown): unknown {
  if (metadata === null || metadata === undefined) {
    return metadata;
  }

  if (Array.isArray(metadata)) {
    return metadata.map(stripAdminMetadata);
  }

  if (typeof metadata === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
      if (ADMIN_METADATA_KEYS.has(key)) {
        continue;
      }
      result[key] = stripAdminMetadata(value);
    }
    return result;
  }

  return metadata;
}

export interface SanitizedContentBlock {
  id: string;
  type: ContentBlockType;
  sortOrder: number;
  content: string;
  assetId: string | null;
  metadata: unknown;
}

export interface SanitizedPage {
  id: string;
  worldId: string;
  campaignId: string | null;
  title: string;
  slug: string;
  type: Page["type"];
  summary: string | null;
  tags: string[];
  aliases: string[];
  contentBlocks: SanitizedContentBlock[];
}

export interface SanitizeForPlayerOptions {
  tags?: string[];
  aliases?: string[];
}

/**
 * Strips internal IDs and admin metadata from page content before it is
 * returned through player APIs or previews.
 *
 * Ganze Blöcke werden hier nicht mehr gefiltert: die Sichtbarkeit pro Element
 * ist weg, wer der Welt zugeordnet ist, sieht jeden Block jeder Seite darin.
 * Was bleibt, ist die Buchhaltung, die den Server nie verlassen sollte — und
 * der DM-Bereich mitten im Text (`:::dm … :::`), der hier bedingungslos fällt:
 * Die Funktion heißt „für Spieler", also gibt es hier keinen Fall, in dem er
 * bleiben dürfte.
 */
export function sanitizeForPlayer(
  page: Page & { contentBlocks: ContentBlock[] },
  options?: SanitizeForPlayerOptions,
): SanitizedPage {
  return {
    id: page.id,
    worldId: page.worldId,
    campaignId: page.campaignId,
    title: page.title,
    slug: page.slug,
    type: page.type,
    summary: page.summary === null ? null : stripDmSections(page.summary),
    tags: options?.tags ?? [],
    aliases: options?.aliases ?? [],
    contentBlocks: page.contentBlocks.map((block) => ({
      id: block.id,
      type: block.type,
      sortOrder: block.sortOrder,
      content: stripDmSections(block.content),
      assetId: block.assetId,
      metadata: stripAdminMetadata(block.metadata),
    })),
  };
}

/**
 * The content-block columns the search index actually reads. Loading only
 * these (instead of the whole `ContentBlock` row) keeps the search load path
 * lean. A full `ContentBlock` is structurally assignable to this subset, so
 * existing callers that pass complete rows still type-check.
 */
export type SearchIndexContentBlock = Pick<
  ContentBlock,
  "id" | "pageId" | "content" | "type" | "sortOrder"
>;

export interface SearchIndexPageInput {
  id: string;
  title: string;
  slug: string;
  type: Page["type"];
  summary: string | null;
  tags: unknown;
  aliases: unknown;
  canonicalStatus: Page["canonicalStatus"];
  questStatus?: Page["questStatus"];
  contentBlocks: SearchIndexContentBlock[];
  world: { slug: string; name: string };
  campaign: { name: string } | null;
}

export type SearchIndexScope = "public" | "studio";
