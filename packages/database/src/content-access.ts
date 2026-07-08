import type {
  ContentBlock,
  ContentBlockType,
  Page,
  PublishStatus,
  Visibility,
} from "./generated/prisma/client";
import {
  detectPrivateReferences,
  formatPrivateReferenceWarning,
  isBlockPlayerExposable,
  isDmOnlyVisibility,
  isPagePlayerExposable,
  isPlayerExposableContent,
  isPlayerPortalVisibility,
  isPublishedContentStatus,
  isSecretVisibleToPlayer,
  mapPublishStatusToContentStatus,
  maskSecretsInUi,
  DEFAULT_SECRET_PLACEHOLDER,
  PLAYER_PORTAL_VISIBILITIES,
  type ContentAccessFields,
  type ContentBlockAccessFields,
  type ContentStatus,
  type ContentVisibility,
  type MaskedContent,
  type MaskSecretsOptions,
  type PrivateReferenceTarget,
  type RevealState,
  type SecretLevel,
} from "@uwe/auth/content-access";

export {
  detectPrivateReferences,
  formatPrivateReferenceWarning,
  isBlockPlayerExposable,
  isDmOnlyVisibility,
  isPagePlayerExposable,
  isPlayerExposableContent,
  isPlayerPortalVisibility,
  isPublishedContentStatus,
  isSecretVisibleToPlayer,
  mapPublishStatusToContentStatus,
  maskSecretsInUi,
  DEFAULT_SECRET_PLACEHOLDER,
  PLAYER_PORTAL_VISIBILITIES,
  type ContentAccessFields,
  type ContentBlockAccessFields,
  type ContentStatus,
  type ContentVisibility,
  type MaskedContent,
  type MaskSecretsOptions,
  type PrivateReferenceTarget,
  type RevealState,
  type SecretLevel,
};

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
  visibility: Visibility;
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
  visibility: Visibility;
  publishStatus: PublishStatus;
  tags: string[];
  aliases: string[];
  contentBlocks: SanitizedContentBlock[];
}

export interface SanitizeForPlayerOptions {
  tags?: string[];
  aliases?: string[];
}

/**
 * Removes DM notes, hidden secrets, internal IDs, and admin metadata from
 * page content before it is returned through player APIs or previews.
 */
export function sanitizeForPlayer(
  page: Page & { contentBlocks: ContentBlock[] },
  options?: SanitizeForPlayerOptions,
): SanitizedPage {
  const exposableBlocks = page.contentBlocks
    .filter((block) => isBlockPlayerExposable(block))
    .map((block) => ({
      id: block.id,
      type: block.type,
      sortOrder: block.sortOrder,
      content: block.content,
      visibility: block.visibility,
      assetId: block.assetId,
      metadata: stripAdminMetadata(block.metadata),
    }));

  return {
    id: page.id,
    worldId: page.worldId,
    campaignId: page.campaignId,
    title: page.title,
    slug: page.slug,
    type: page.type,
    summary: page.summary,
    visibility: page.visibility,
    publishStatus: page.publishStatus,
    tags: options?.tags ?? [],
    aliases: options?.aliases ?? [],
    contentBlocks: exposableBlocks,
  };
}

/**
 * The content-block columns the search index and its authz filters actually
 * read. Loading only these (instead of the whole `ContentBlock` row) keeps the
 * search load path lean. A full `ContentBlock` is structurally assignable to
 * this subset, so existing callers that pass complete rows still type-check.
 */
export type SearchIndexContentBlock = Pick<
  ContentBlock,
  "id" | "pageId" | "content" | "visibility" | "type" | "sortOrder" | "secretLevel" | "revealState"
>;

export interface SearchIndexPageInput extends ContentAccessFields {
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
  secretLevel?: SecretLevel | null;
  revealState?: RevealState | null;
}

export type SearchIndexScope = "public" | "studio";
