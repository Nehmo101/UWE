import type {
  Asset,
  ContentBlock,
  Label,
  LabelSourceType,
  LabelTemplate,
  Page,
  Prisma,
} from "./generated/prisma/client";
import { createPrismaClient, prisma, type PrismaClient } from "./client";
import { combineBlockContent } from "./page-service";
import {
  filterBlocksForContext,
  type AccessContext,
} from "./permissions";
import type { PageWithBlocks } from "./repository";

export type {
  Label,
  LabelSourceType,
  LabelTemplate,
} from "./generated/prisma/client";

export {
  LabelSourceType as LabelSourceTypeEnum,
} from "./generated/prisma/client";

export const LABEL_SOURCE_TYPE_LABELS: Record<LabelSourceType, string> = {
  page: "Seite",
  dungeon_room: "Dungeon-Raum",
  content_block: "Inhaltsblock",
  asset: "Asset",
  manual: "Manuell",
};

export type LabelLayoutMode = "image_text" | "text_only" | "image_only";

export interface LabelLayoutSettings {
  mode: LabelLayoutMode;
  truncateToPage: boolean;
  truncateLongWords: boolean;
  maxChars?: number;
  maxWordLength?: number;
  widthInches: number;
  heightInches: number;
}

export interface LabelContentData {
  title: string;
  text: string;
  summary?: string;
  imageAssetId?: string | null;
  imageMimeType?: string | null;
  sourceTitle?: string;
  containsDmOnly?: boolean;
  dmOnlyBlockCount?: number;
  /** Placeholder for future AI image generation */
  aiImagePlaceholder?: string;
  /** Placeholder for future AI text generation */
  aiTextPlaceholder?: string;
}

export interface CreateLabelInput {
  worldId: string;
  campaignId?: string | null;
  title: string;
  sourceType: LabelSourceType;
  sourceId?: string | null;
  templateId: string;
  content: LabelContentData;
  layoutSettings?: LabelLayoutSettings;
}

export interface UpdateLabelInput {
  title?: string;
  campaignId?: string | null;
  templateId?: string;
  content?: LabelContentData;
  layoutSettings?: LabelLayoutSettings;
}

export interface CreateLabelFromSourceInput {
  worldId: string;
  campaignId?: string | null;
  sourceType: LabelSourceType;
  sourceId: string;
  templateId: string;
  title?: string;
  includeDmOnly?: boolean;
  layoutSettings?: Partial<LabelLayoutSettings>;
}

export type LabelWithRelations = Prisma.LabelGetPayload<{
  include: { template: true; campaign: true };
}>;

const DEFAULT_LAYOUT: LabelLayoutSettings = {
  mode: "image_text",
  truncateToPage: true,
  truncateLongWords: true,
  maxChars: 800,
  maxWordLength: 24,
  widthInches: 6,
  heightInches: 4,
};

const PLAYER_BLOCK_TYPES = new Set([
  "rich_text",
  "html",
  "player_text",
  "handout",
  "statblock",
  "image",
  "gallery",
  "timeline",
  "relation",
]);

const DM_ONLY_BLOCK_TYPES = new Set(["gm_note", "ai_summary"]);

function parseLayoutSettings(raw: unknown): LabelLayoutSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_LAYOUT };
  }

  const value = raw as Partial<LabelLayoutSettings>;
  return {
    mode: value.mode ?? DEFAULT_LAYOUT.mode,
    truncateToPage: value.truncateToPage ?? DEFAULT_LAYOUT.truncateToPage,
    truncateLongWords: value.truncateLongWords ?? DEFAULT_LAYOUT.truncateLongWords,
    maxChars: value.maxChars ?? DEFAULT_LAYOUT.maxChars,
    maxWordLength: value.maxWordLength ?? DEFAULT_LAYOUT.maxWordLength,
    widthInches: value.widthInches ?? DEFAULT_LAYOUT.widthInches,
    heightInches: value.heightInches ?? DEFAULT_LAYOUT.heightInches,
  };
}

function parseContentData(raw: unknown): LabelContentData {
  if (!raw || typeof raw !== "object") {
    return { title: "", text: "" };
  }

  const value = raw as Partial<LabelContentData>;
  return {
    title: value.title ?? "",
    text: value.text ?? "",
    summary: value.summary,
    imageAssetId: value.imageAssetId ?? null,
    imageMimeType: value.imageMimeType ?? null,
    sourceTitle: value.sourceTitle,
    containsDmOnly: value.containsDmOnly ?? false,
    dmOnlyBlockCount: value.dmOnlyBlockCount ?? 0,
    aiImagePlaceholder: value.aiImagePlaceholder,
    aiTextPlaceholder: value.aiTextPlaceholder,
  };
}

export function normalizeLabel(label: Label): Label & {
  content: LabelContentData;
  layoutSettings: LabelLayoutSettings;
} {
  return {
    ...label,
    content: parseContentData(label.content),
    layoutSettings: parseLayoutSettings(label.layoutSettings),
  } as Label & {
    content: LabelContentData;
    layoutSettings: LabelLayoutSettings;
  };
}

function toJsonContent(content: LabelContentData): Prisma.InputJsonValue {
  return content as unknown as Prisma.InputJsonValue;
}

function toJsonLayout(settings: LabelLayoutSettings): Prisma.InputJsonValue {
  return settings as unknown as Prisma.InputJsonValue;
}

function truncateText(text: string, settings: LabelLayoutSettings): string {
  let result = text.trim();

  if (settings.truncateLongWords && settings.maxWordLength) {
    result = result
      .split(/\s+/)
      .map((word) =>
        word.length > settings.maxWordLength!
          ? `${word.slice(0, settings.maxWordLength! - 1)}…`
          : word,
      )
      .join(" ");
  }

  if (settings.truncateToPage && settings.maxChars && result.length > settings.maxChars) {
    result = `${result.slice(0, settings.maxChars - 1).trim()}…`;
  }

  return result;
}

export function applyLayoutToContent(
  content: LabelContentData,
  settings: LabelLayoutSettings,
): LabelContentData {
  const text =
    settings.mode === "image_only"
      ? ""
      : truncateText(content.text || content.summary || "", settings);

  return {
    ...content,
    text,
    imageAssetId: settings.mode === "text_only" ? null : content.imageAssetId,
  };
}

function stripWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) =>
    label?.trim() || target.trim(),
  );
}

function extractBlocksForLabel(
  blocks: ContentBlock[],
  includeDmOnly: boolean,
): { text: string; imageAssetId: string | null; imageMimeType: string | null; dmOnlyCount: number } {
  const context: AccessContext = includeDmOnly ? "dm" : "portal";
  const visibleBlocks = filterBlocksForContext(blocks, context).filter((block) => {
    if (DM_ONLY_BLOCK_TYPES.has(block.type) && !includeDmOnly) {
      return false;
    }
    return PLAYER_BLOCK_TYPES.has(block.type) || (includeDmOnly && block.type === "gm_note");
  });

  const dmOnlyCount = blocks.filter(
    (block) => block.visibility === "dm_only" || DM_ONLY_BLOCK_TYPES.has(block.type),
  ).length;

  const textBlocks = visibleBlocks.filter(
    (block) => block.type !== "image" && block.type !== "gallery" && block.type !== "map",
  );
  const text = stripWikiLinks(combineBlockContent(textBlocks));

  const imageBlock = visibleBlocks.find(
    (block) =>
      (block.type === "image" || block.type === "gallery" || block.type === "map") && block.assetId,
  );

  return {
    text,
    imageAssetId: imageBlock?.assetId ?? null,
    imageMimeType: null,
    dmOnlyCount,
  };
}

async function resolveAssetImage(
  db: PrismaClient,
  assetId: string | null,
): Promise<{ assetId: string | null; mimeType: string | null }> {
  if (!assetId) return { assetId: null, mimeType: null };

  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset) return { assetId: null, mimeType: null };

  if (asset.mimeType?.startsWith("image/")) {
    return { assetId: asset.id, mimeType: asset.mimeType };
  }

  return { assetId: null, mimeType: null };
}

export async function buildLabelContentFromPage(
  db: PrismaClient,
  page: PageWithBlocks,
  options: { includeDmOnly?: boolean; imageAssetId?: string | null } = {},
): Promise<LabelContentData> {
  const includeDmOnly = options.includeDmOnly ?? false;
  const extracted = extractBlocksForLabel(page.contentBlocks, includeDmOnly);
  const image = await resolveAssetImage(
    db,
    options.imageAssetId ?? extracted.imageAssetId,
  );

  const summary = page.summary?.trim() || undefined;
  const text = extracted.text || summary || page.title;

  return {
    title: page.title,
    text,
    summary,
    imageAssetId: image.assetId,
    imageMimeType: image.mimeType,
    sourceTitle: page.title,
    containsDmOnly: !includeDmOnly && extracted.dmOnlyCount > 0,
    dmOnlyBlockCount: extracted.dmOnlyCount,
    aiImagePlaceholder: "[AI-Bild Platzhalter — später verfügbar]",
    aiTextPlaceholder: "[AI-Text Platzhalter — später verfügbar]",
  };
}

export async function buildLabelContentFromBlock(
  db: PrismaClient,
  block: ContentBlock & { page?: Page; asset?: Asset | null },
  options: { includeDmOnly?: boolean } = {},
): Promise<LabelContentData> {
  const includeDmOnly = options.includeDmOnly ?? false;

  if (!includeDmOnly && (block.visibility === "dm_only" || DM_ONLY_BLOCK_TYPES.has(block.type))) {
    return {
      title: block.page?.title ?? "Block",
      text: "",
      sourceTitle: block.page?.title,
      containsDmOnly: true,
      dmOnlyBlockCount: 1,
    };
  }

  const text = stripWikiLinks(block.content.trim());
  const image = await resolveAssetImage(db, block.assetId);

  return {
    title: block.page?.title ?? "Inhaltsblock",
    text,
    imageAssetId: image.assetId,
    imageMimeType: image.mimeType,
    sourceTitle: block.page?.title,
    containsDmOnly: block.visibility === "dm_only",
    dmOnlyBlockCount: block.visibility === "dm_only" ? 1 : 0,
    aiImagePlaceholder: "[AI-Bild Platzhalter — später verfügbar]",
    aiTextPlaceholder: "[AI-Text Platzhalter — später verfügbar]",
  };
}

export async function buildLabelContentFromAsset(asset: Asset): Promise<LabelContentData> {
  const isImage = asset.mimeType?.startsWith("image/") ?? false;

  return {
    title: asset.title,
    text: asset.description?.trim() || asset.title,
    summary: asset.description ?? undefined,
    imageAssetId: isImage ? asset.id : null,
    imageMimeType: isImage ? asset.mimeType : null,
    sourceTitle: asset.title,
    containsDmOnly: asset.visibility === "dm_only",
    dmOnlyBlockCount: asset.visibility === "dm_only" ? 1 : 0,
    aiImagePlaceholder: "[AI-Bild Platzhalter — später verfügbar]",
    aiTextPlaceholder: "[AI-Text Platzhalter — später verfügbar]",
  };
}

export function assertPlayerSafeExport(
  content: LabelContentData,
  includeDmOnly: boolean,
): { allowed: boolean; reason?: string } {
  if (includeDmOnly) {
    return { allowed: true };
  }

  if (content.containsDmOnly || (content.dmOnlyBlockCount ?? 0) > 0) {
    return {
      allowed: false,
      reason:
        "Dieses Label enthält DM-only Inhalte. Bitte bestätigen Sie bewusst den Export mit DM-Inhalten.",
    };
  }

  return { allowed: true };
}

export class LabelService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listTemplates(worldId?: string | null): Promise<LabelTemplate[]> {
    return this.db.labelTemplate.findMany({
      where: {
        OR: [{ worldId: null }, ...(worldId ? [{ worldId }] : [])],
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }

  async getTemplateById(templateId: string): Promise<LabelTemplate | null> {
    return this.db.labelTemplate.findUnique({ where: { id: templateId } });
  }

  async getDefaultTemplate(): Promise<LabelTemplate> {
    const template = await this.db.labelTemplate.findFirst({
      where: { slug: "standard-6x4", worldId: null },
    });

    if (!template) {
      throw new Error("System label template 'standard-6x4' not found. Run migrations.");
    }

    return template;
  }

  async listLabelsByWorld(worldSlug: string): Promise<LabelWithRelations[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.label.findMany({
      where: { worldId: world.id },
      include: { template: true, campaign: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getLabelById(labelId: string): Promise<LabelWithRelations | null> {
    return this.db.label.findUnique({
      where: { id: labelId },
      include: { template: true, campaign: true },
    });
  }

  async createLabel(input: CreateLabelInput): Promise<LabelWithRelations> {
    const template = await this.getTemplateById(input.templateId);
    const layoutSettings = {
      ...parseLayoutSettings(template?.layoutSettings),
      ...input.layoutSettings,
    };
    const content = applyLayoutToContent(input.content, layoutSettings);

    return this.db.label.create({
      data: {
        worldId: input.worldId,
        campaignId: input.campaignId ?? null,
        title: input.title,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        templateId: input.templateId,
        content: toJsonContent(content),
        layoutSettings: toJsonLayout(layoutSettings),
      },
      include: { template: true, campaign: true },
    });
  }

  async updateLabel(labelId: string, input: UpdateLabelInput): Promise<LabelWithRelations> {
    const existing = await this.getLabelById(labelId);
    if (!existing) {
      throw new Error("Label not found");
    }

    const layoutSettings = input.layoutSettings
      ? { ...parseLayoutSettings(existing.layoutSettings), ...input.layoutSettings }
      : parseLayoutSettings(existing.layoutSettings);

    const content = input.content
      ? applyLayoutToContent(input.content, layoutSettings)
      : applyLayoutToContent(parseContentData(existing.content), layoutSettings);

    let templateId = existing.templateId;
    if (input.templateId) {
      templateId = input.templateId;
    }

    return this.db.label.update({
      where: { id: labelId },
      data: {
        title: input.title,
        campaignId: input.campaignId,
        templateId,
        content: toJsonContent(content),
        layoutSettings: toJsonLayout(layoutSettings),
      },
      include: { template: true, campaign: true },
    });
  }

  async duplicateLabel(labelId: string): Promise<LabelWithRelations> {
    const label = await this.getLabelById(labelId);
    if (!label) {
      throw new Error("Label not found");
    }

    return this.createLabel({
      worldId: label.worldId,
      campaignId: label.campaignId,
      title: `${label.title} (Kopie)`,
      sourceType: label.sourceType,
      sourceId: label.sourceId,
      templateId: label.templateId,
      content: parseContentData(label.content),
      layoutSettings: parseLayoutSettings(label.layoutSettings),
    });
  }

  async deleteLabel(labelId: string): Promise<void> {
    await this.db.label.delete({ where: { id: labelId } });
  }

  async createFromSource(input: CreateLabelFromSourceInput): Promise<LabelWithRelations> {
    const template = await this.getTemplateById(input.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const layoutSettings: LabelLayoutSettings = {
      ...parseLayoutSettings(template.layoutSettings),
      ...input.layoutSettings,
    };

    let content: LabelContentData;
    let sourceType = input.sourceType;
    let title = input.title;

    if (input.sourceType === "page" || input.sourceType === "dungeon_room") {
      const page = await this.db.page.findUnique({
        where: { id: input.sourceId },
        include: { contentBlocks: { orderBy: { sortOrder: "asc" } }, campaign: true },
      });

      if (!page) throw new Error("Page not found");
      if (input.sourceType === "dungeon_room" && page.type !== "room") {
        throw new Error("Source page is not a dungeon room");
      }

      content = await buildLabelContentFromPage(this.db, page, {
        includeDmOnly: input.includeDmOnly,
      });
      title = title || page.title;
      sourceType = page.type === "room" ? "dungeon_room" : "page";
    } else if (input.sourceType === "content_block") {
      const block = await this.db.contentBlock.findUnique({
        where: { id: input.sourceId },
        include: { page: true, asset: true },
      });

      if (!block) throw new Error("Content block not found");
      content = await buildLabelContentFromBlock(this.db, block, {
        includeDmOnly: input.includeDmOnly,
      });
      title = title || `${block.page.title} — Block`;
    } else if (input.sourceType === "asset") {
      const asset = await this.db.asset.findUnique({ where: { id: input.sourceId } });
      if (!asset) throw new Error("Asset not found");
      content = await buildLabelContentFromAsset(asset);
      title = title || asset.title;
    } else {
      throw new Error("Manual labels must be created via createLabel");
    }

    return this.createLabel({
      worldId: input.worldId,
      campaignId: input.campaignId ?? null,
      title: title || "Neues Label",
      sourceType,
      sourceId: input.sourceId,
      templateId: input.templateId,
      content,
      layoutSettings,
    });
  }

  async listSourcePagesForLabels(
    worldSlug: string,
    category?: "dungeon" | "encounter" | "handout" | "all",
  ): Promise<Pick<Page, "id" | "title" | "type" | "slug">[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    const typeFilters: Page["type"][] | undefined =
      category === "dungeon"
        ? ["room", "dungeon", "dungeon_level"]
        : category === "encounter"
          ? ["encounter", "monster"]
          : category === "handout"
            ? ["handout", "item", "quest", "note"]
            : undefined;

    return this.db.page.findMany({
      where: {
        worldId: world.id,
        ...(typeFilters ? { type: { in: typeFilters } } : {}),
      },
      select: { id: true, title: true, type: true, slug: true },
      orderBy: { title: "asc" },
    });
  }

  async listSourceBlocksForLabels(
    worldSlug: string,
  ): Promise<
    { id: string; type: ContentBlock["type"]; pageTitle: string; preview: string; visibility: ContentBlock["visibility"] }[]
  > {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    const blocks = await this.db.contentBlock.findMany({
      where: {
        page: { worldId: world.id },
        type: {
          in: ["handout", "statblock", "rich_text", "player_text", "html", "image"],
        },
      },
      include: { page: { select: { title: true } } },
      orderBy: [{ page: { title: "asc" } }, { sortOrder: "asc" }],
    });

    return blocks.map((block) => ({
      id: block.id,
      type: block.type,
      pageTitle: block.page.title,
      preview: block.content.slice(0, 80),
      visibility: block.visibility,
    }));
  }
}

export function createLabelService(databaseUrl?: string): LabelService {
  if (databaseUrl) {
    return new LabelService(createPrismaClient(databaseUrl));
  }

  return new LabelService();
}
