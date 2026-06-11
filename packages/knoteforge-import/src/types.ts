import type {
  ContentBlockType,
  PageType,
  Prisma,
  PublishStatus,
  Visibility,
} from "@uwe/database/server";

/** Lifecycle status for each import candidate. */
export type ImportStatus =
  | "new"
  | "update"
  | "duplicate"
  | "conflict"
  | "skipped"
  | "error";

export type ImportFormat = "json" | "markdown" | "html";

export type ConflictKind = "slug" | "title" | "alias" | "asset" | "missing_field";

/** KnoteForge entity types as they may appear in an export file. */
export type KnoteForgeEntityType =
  | "wissenstext"
  | "dungeon"
  | "ebene"
  | "raum"
  | "encounter"
  | "loot"
  | "soundboard_button"
  | "session_notiz"
  | "spieler_notiz"
  | "bild"
  | "handout"
  | "label"
  | string;

export interface KnoteForgeExportWorld {
  name: string;
  slug: string;
  description?: string | null;
}

export interface KnoteForgeExportEntity {
  id?: string;
  type: KnoteForgeEntityType;
  title: string;
  slug?: string;
  summary?: string | null;
  content?: string | null;
  playerContent?: string | null;
  gmContent?: string | null;
  tags?: string[];
  aliases?: string[];
  visibility?: string | null;
  publishStatus?: string | null;
  parentId?: string | null;
  relations?: Array<{
    targetId: string;
    relationType: string;
    label?: string | null;
  }>;
  metadata?: Record<string, unknown>;
}

export interface KnoteForgeExportAsset {
  id?: string;
  filename: string;
  path?: string | null;
  hash?: string | null;
  type?: string | null;
  mimeType?: string | null;
}

/** JSON export schema (v1.0) — decoupled from KnoteForge internals. */
export interface KnoteForgeExport {
  version: string;
  source: "knoteforge";
  exportedAt?: string;
  world?: KnoteForgeExportWorld;
  entities: KnoteForgeExportEntity[];
  assets?: KnoteForgeExportAsset[];
}

/** Format-agnostic bundle produced by any ImportSource parser. */
export interface NormalizedImportBundle {
  version: string;
  source: "knoteforge";
  exportedAt?: string;
  world?: KnoteForgeExportWorld;
  entities: KnoteForgeExportEntity[];
  assets: KnoteForgeExportAsset[];
}

export interface MappedContentBlockDraft {
  type: ContentBlockType;
  sortOrder: number;
  content: string;
  visibility: Visibility;
  metadata?: Prisma.InputJsonValue;
}

export interface MappedPageDraft {
  knoteforgeId?: string;
  knoteforgeType: KnoteForgeEntityType;
  title: string;
  slug: string;
  type: PageType;
  summary?: string | null;
  visibility: Visibility;
  publishStatus: PublishStatus;
  tags: string[];
  aliases: string[];
  contentBlocks: MappedContentBlockDraft[];
  relations: Array<{
    targetKnoteForgeId: string;
    relationType: string;
    label?: string | null;
  }>;
  missingFields: string[];
  warnings: string[];
}

export interface ImportConflict {
  kind: ConflictKind;
  message: string;
  existingPageId?: string;
  existingTitle?: string;
  existingSlug?: string;
  relatedItemId?: string;
}

export interface ImportItemPreview {
  itemId: string;
  knoteforgeId?: string;
  knoteforgeType: KnoteForgeEntityType;
  status: ImportStatus;
  title: string;
  slug: string;
  resolvedSlug: string;
  pageType: PageType;
  blockCount: number;
  missingFields: string[];
  warnings: string[];
  conflicts: ImportConflict[];
  existingPageId?: string;
}

export interface ImportPreviewResult {
  worldSlug: string;
  format: ImportFormat;
  totalEntities: number;
  items: ImportItemPreview[];
  summary: Record<ImportStatus, number>;
  errors: string[];
  canExecute: boolean;
}

export interface ImportExecuteOptions {
  confirmed: boolean;
  /** Only import these item IDs. If omitted, imports all non-skipped/conflict items. */
  itemIds?: string[];
  /** Resolve slug conflicts automatically by appending suffixes. */
  autoResolveSlugConflicts?: boolean;
  /** Update existing pages matched by knoteforgeId. */
  allowUpdates?: boolean;
}

export interface ImportLogEntry {
  timestamp: string;
  itemId?: string;
  title?: string;
  status: ImportStatus;
  message: string;
}

export interface ImportExecuteResult {
  worldSlug: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: Array<{
    itemId: string;
    status: ImportStatus;
    pageId?: string;
    slug?: string;
    error?: string;
  }>;
  log: ImportLogEntry[];
}

export interface ImportOptions {
  worldSlug: string;
  format: ImportFormat;
}
