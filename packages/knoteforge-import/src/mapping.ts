import type {
  ContentBlockType,
  PageType,
  Prisma,
  PublishStatus,
  Visibility,
} from "@uwe/database/server";
import type {
  KnoteForgeEntityType,
  KnoteForgeExportEntity,
  MappedContentBlockDraft,
  MappedPageDraft,
} from "./types";
import { slugifyTitle } from "./slug";

const KF_IMPORT_TAG_PREFIX = "kf-import:";

export const KNOTEFORGE_TYPE_MAP: Record<string, PageType> = {
  wissenstext: "lore",
  dungeon: "dungeon",
  ebene: "dungeon_level",
  raum: "room",
  encounter: "encounter",
  loot: "item",
  soundboard_button: "sound",
  session_notiz: "session",
  spieler_notiz: "note",
  bild: "map",
  handout: "handout",
  label: "handout",
};

export function mapKnoteForgeTypeToPageType(type: KnoteForgeEntityType): PageType {
  const normalized = type.trim().toLocaleLowerCase("de");
  return KNOTEFORGE_TYPE_MAP[normalized] ?? "note";
}

export function mapVisibility(raw?: string | null): Visibility {
  if (!raw) return "dm_only";
  const v = raw.trim().toLocaleLowerCase("de");
  if (v === "public" || v === "oeffentlich") return "public";
  if (v === "player" || v === "spieler" || v === "player_visible") return "player_visible";
  if (v === "dm" || v === "dm_only" || v === "sl") return "dm_only";
  return "dm_only";
}

export function mapPublishStatus(raw?: string | null): PublishStatus {
  if (!raw) return "draft";
  const v = raw.trim().toLocaleLowerCase("de");
  if (v === "published" || v === "veroeffentlicht") return "published";
  if (v === "internal" || v === "intern") return "internal";
  if (v === "archived" || v === "archiviert") return "archived";
  return "draft";
}

function buildProvenanceMetadata(
  entity: KnoteForgeExportEntity,
  importedAt: string,
): Prisma.InputJsonValue {
  return {
    source: "knoteforge",
    knoteforgeId: entity.id ?? null,
    knoteforgeType: entity.type,
    importedAt,
    ...(entity.metadata ?? {}),
  } as Prisma.InputJsonValue;
}

function buildContentBlocks(
  entity: KnoteForgeExportEntity,
  importedAt: string,
): MappedContentBlockDraft[] {
  const blocks: MappedContentBlockDraft[] = [];
  const visibility = mapVisibility(entity.visibility);
  let sortOrder = 0;

  const pushBlock = (
    type: ContentBlockType,
    content: string,
    blockVisibility: Visibility = visibility,
  ) => {
    if (!content.trim()) return;
    blocks.push({
      type,
      sortOrder: sortOrder++,
      content: content.trim(),
      visibility: blockVisibility,
      metadata: buildProvenanceMetadata(entity, importedAt),
    });
  };

  const normalizedType = entity.type.trim().toLocaleLowerCase("de");

  if (normalizedType === "spieler_notiz" && entity.content) {
    pushBlock("player_text", entity.content, "player_visible");
    return blocks;
  }

  if (normalizedType === "bild") {
    const imagePath =
      (entity.metadata?.path as string | undefined) ??
      (entity.metadata?.filename as string | undefined) ??
      entity.content ??
      "";
    blocks.push({
      type: "image",
      sortOrder: 0,
      content: imagePath,
      visibility,
      metadata: {
        ...(buildProvenanceMetadata(entity, importedAt) as Record<string, unknown>),
        assetType: "image",
      } as Prisma.InputJsonValue,
    });
    return blocks;
  }

  if (normalizedType === "label") {
    blocks.push({
      type: "handout",
      sortOrder: 0,
      content: entity.content ?? entity.title,
      visibility,
      metadata: {
        ...(buildProvenanceMetadata(entity, importedAt) as Record<string, unknown>),
        printable: true,
        assetType: "label",
      } as Prisma.InputJsonValue,
    });
    return blocks;
  }

  if (entity.playerContent) {
    pushBlock("player_text", entity.playerContent, "player_visible");
  }

  if (entity.content) {
    const blockType: ContentBlockType =
      normalizedType === "loot" ? "statblock" : "rich_text";
    pushBlock(blockType, entity.content);
  }

  if (entity.gmContent) {
    pushBlock("gm_note", entity.gmContent, "dm_only");
  }

  if (blocks.length === 0) {
    blocks.push({
      type: "rich_text",
      sortOrder: 0,
      content: "",
      visibility,
      metadata: buildProvenanceMetadata(entity, importedAt),
    });
  }

  return blocks;
}

export function mapEntityToPageDraft(
  entity: KnoteForgeExportEntity,
  importedAt = new Date().toISOString(),
): MappedPageDraft {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!entity.title?.trim()) {
    missingFields.push("title");
  }

  const pageType = mapKnoteForgeTypeToPageType(entity.type);
  if (!KNOTEFORGE_TYPE_MAP[entity.type.trim().toLocaleLowerCase("de")]) {
    warnings.push(`Unbekannter KnoteForge-Typ „${entity.type}" → Page type „${pageType}".`);
  }

  const slug = entity.slug?.trim() || slugifyTitle(entity.title || "import");
  if (!slug) {
    missingFields.push("slug");
  }

  const tags = [...(entity.tags ?? [])];
  if (entity.id) {
    tags.push(`${KF_IMPORT_TAG_PREFIX}${entity.id}`);
  }

  return {
    knoteforgeId: entity.id,
    knoteforgeType: entity.type,
    title: entity.title?.trim() || "Ohne Titel",
    slug,
    type: pageType,
    summary: entity.summary ?? null,
    visibility: mapVisibility(entity.visibility),
    publishStatus: mapPublishStatus(entity.publishStatus),
    tags,
    aliases: entity.aliases ?? [],
    contentBlocks: buildContentBlocks(entity, importedAt),
    relations: (entity.relations ?? []).map((rel) => ({
      targetKnoteForgeId: rel.targetId,
      relationType: rel.relationType,
      label: rel.label ?? null,
    })),
    missingFields,
    warnings,
  };
}

export function isKnoteForgeImportTag(tag: string): boolean {
  return tag.startsWith(KF_IMPORT_TAG_PREFIX);
}

export function knoteforgeIdFromTag(tag: string): string | null {
  if (!isKnoteForgeImportTag(tag)) return null;
  return tag.slice(KF_IMPORT_TAG_PREFIX.length) || null;
}
