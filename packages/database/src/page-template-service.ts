import type { PrismaClient } from "./client";
import type { PageType, Visibility } from "./generated/prisma/client";
import { PAGE_TEMPLATES, type PageTemplateBlock } from "./page-templates";
import { createActivityLogService } from "./activity-log-service";
import { runSeedOnce } from "./seed-tracker";
import { slugifyDe } from "./slug-utils";

/**
 * DB-backed Quick-Create page templates.
 *
 * The previously code-defined templates (page-templates.ts) are seeded once
 * as system templates (tracked in seed_history, so restarts never duplicate
 * them). Users can create, edit, duplicate and deactivate templates; system
 * templates can be edited and deactivated but not deleted.
 */

export const PAGE_TEMPLATE_SEED_KEY = "page_templates.system";
export const PAGE_TEMPLATE_SEED_VERSION = 1;

export interface PageTemplateView {
  id: string;
  slug: string;
  name: string;
  description: string;
  pageType: PageType;
  defaultVisibility: Visibility;
  titlePlaceholder: string;
  blocks: PageTemplateBlock[];
  isSystem: boolean;
  isActive: boolean;
  updatedAt: Date;
}

export interface PageTemplateInput {
  slug?: string;
  name: string;
  description?: string;
  pageType: PageType;
  defaultVisibility?: Visibility;
  titlePlaceholder?: string;
  blocks: PageTemplateBlock[];
}

const BLOCK_TYPES = new Set([
  "rich_text",
  "html",
  "image",
  "gallery",
  "map",
  "handout",
  "sound",
  "relation",
  "timeline",
  "statblock",
  "gm_note",
  "player_text",
  "ai_summary",
]);

const VISIBILITIES = new Set([
  "dm_only",
  "player_visible",
  "public",
  "specific_players",
  "unlock_after_session",
  "archived",
]);

export function parseTemplateBlocks(value: unknown): PageTemplateBlock[] {
  if (!Array.isArray(value)) {
    throw new Error("Template-Blöcke müssen ein Array sein.");
  }

  return value.map((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      throw new Error(`Block ${index + 1}: ungültiges Format.`);
    }
    const block = raw as Record<string, unknown>;
    const type = String(block.type ?? "");
    const visibility = String(block.visibility ?? "");
    if (!BLOCK_TYPES.has(type)) {
      throw new Error(`Block ${index + 1}: unbekannter Block-Typ „${type}“.`);
    }
    if (!VISIBILITIES.has(visibility)) {
      throw new Error(`Block ${index + 1}: unbekannte Sichtbarkeit „${visibility}“.`);
    }
    return {
      type: type as PageTemplateBlock["type"],
      visibility: visibility as PageTemplateBlock["visibility"],
      content: String(block.content ?? ""),
    };
  });
}

type DbTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string;
  pageType: PageType;
  defaultVisibility: Visibility;
  titlePlaceholder: string;
  blocks: unknown;
  isSystem: boolean;
  isActive: boolean;
  updatedAt: Date;
};

function toView(template: DbTemplate): PageTemplateView {
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    pageType: template.pageType,
    defaultVisibility: template.defaultVisibility,
    titlePlaceholder: template.titlePlaceholder,
    blocks: parseTemplateBlocks(template.blocks),
    isSystem: template.isSystem,
    isActive: template.isActive,
    updatedAt: template.updatedAt,
  };
}

/**
 * Seed the code-defined templates as system templates. Idempotent on two
 * levels: guarded by seed_history *and* per-template upserts by unique slug,
 * so a restart or a race on first start never duplicates templates.
 */
export async function ensureSystemPageTemplates(db: PrismaClient): Promise<{ applied: boolean }> {
  const result = await runSeedOnce(
    db,
    PAGE_TEMPLATE_SEED_KEY,
    PAGE_TEMPLATE_SEED_VERSION,
    async () => {
      for (const template of PAGE_TEMPLATES) {
        await db.pageTemplate.upsert({
          where: { slug: template.id },
          create: {
            slug: template.id,
            name: template.name,
            description: template.description,
            pageType: template.pageType,
            defaultVisibility: template.defaultVisibility,
            titlePlaceholder: template.titlePlaceholder,
            blocks: JSON.parse(JSON.stringify(template.blocks)),
            isSystem: true,
            isActive: true,
          },
          update: {},
        });
      }
      return { templates: PAGE_TEMPLATES.map((template) => template.id) };
    },
  );

  if (result.applied) {
    await createActivityLogService(db).log({
      action: "seed_applied",
      targetType: "system",
      targetLabel: PAGE_TEMPLATE_SEED_KEY,
      targetHref: "/templates",
      summary: `System-Templates in die Datenbank übernommen (Seed ${PAGE_TEMPLATE_SEED_KEY} v${PAGE_TEMPLATE_SEED_VERSION}).`,
      details: { key: PAGE_TEMPLATE_SEED_KEY, version: PAGE_TEMPLATE_SEED_VERSION },
    });
  }

  return result;
}

export class PageTemplateService {
  constructor(private readonly db: PrismaClient) {}

  private get activity() {
    return createActivityLogService(this.db);
  }

  async listTemplates(options: { includeInactive?: boolean } = {}): Promise<PageTemplateView[]> {
    await ensureSystemPageTemplates(this.db);

    const templates = await this.db.pageTemplate.findMany({
      where: options.includeInactive ? undefined : { isActive: true },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    });

    return templates.map(toView);
  }

  /** Resolve a template by DB id or stable slug (legacy `?template=npc` links). */
  async getTemplate(idOrSlug: string | null | undefined): Promise<PageTemplateView | null> {
    if (!idOrSlug) return null;

    await ensureSystemPageTemplates(this.db);

    const template = await this.db.pageTemplate.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });

    return template ? toView(template) : null;
  }

  async createTemplate(input: PageTemplateInput): Promise<PageTemplateView> {
    const blocks = parseTemplateBlocks(input.blocks);
    if (blocks.length === 0) {
      throw new Error("Ein Template braucht mindestens einen Block.");
    }

    const slug = await this.pickUniqueSlug(input.slug || slugifyDe(input.name));

    const template = await this.db.pageTemplate.create({
      data: {
        slug,
        name: input.name,
        description: input.description ?? "",
        pageType: input.pageType,
        defaultVisibility: input.defaultVisibility ?? "dm_only",
        titlePlaceholder: input.titlePlaceholder ?? "",
        blocks: JSON.parse(JSON.stringify(blocks)),
        isSystem: false,
        isActive: true,
      },
    });

    await this.activity.log({
      action: "template_created",
      targetType: "page_template",
      targetId: template.id,
      targetLabel: template.name,
      targetHref: `/templates/${template.id}`,
      summary: `Template „${template.name}“ erstellt.`,
    });

    return toView(template);
  }

  async updateTemplate(id: string, input: Partial<PageTemplateInput>): Promise<PageTemplateView> {
    const existing = await this.db.pageTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error("Template nicht gefunden.");

    const blocks = input.blocks ? parseTemplateBlocks(input.blocks) : undefined;
    if (blocks && blocks.length === 0) {
      throw new Error("Ein Template braucht mindestens einen Block.");
    }

    const template = await this.db.pageTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        pageType: input.pageType,
        defaultVisibility: input.defaultVisibility,
        titlePlaceholder: input.titlePlaceholder,
        blocks: blocks ? JSON.parse(JSON.stringify(blocks)) : undefined,
      },
    });

    await this.activity.log({
      action: "template_updated",
      targetType: "page_template",
      targetId: template.id,
      targetLabel: template.name,
      targetHref: `/templates/${template.id}`,
      summary: `Template „${template.name}“ geändert.`,
    });

    return toView(template);
  }

  async duplicateTemplate(id: string): Promise<PageTemplateView> {
    const existing = await this.db.pageTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error("Template nicht gefunden.");

    const slug = await this.pickUniqueSlug(`${existing.slug}-kopie`);

    const template = await this.db.pageTemplate.create({
      data: {
        slug,
        name: `${existing.name} (Kopie)`,
        description: existing.description,
        pageType: existing.pageType,
        defaultVisibility: existing.defaultVisibility,
        titlePlaceholder: existing.titlePlaceholder,
        blocks: existing.blocks ?? [],
        isSystem: false,
        isActive: true,
      },
    });

    await this.activity.log({
      action: "template_created",
      targetType: "page_template",
      targetId: template.id,
      targetLabel: template.name,
      targetHref: `/templates/${template.id}`,
      summary: `Template „${existing.name}“ dupliziert.`,
    });

    return toView(template);
  }

  async setTemplateActive(id: string, isActive: boolean): Promise<PageTemplateView> {
    const template = await this.db.pageTemplate.update({
      where: { id },
      data: { isActive },
    });

    await this.activity.log({
      action: "template_updated",
      targetType: "page_template",
      targetId: template.id,
      targetLabel: template.name,
      targetHref: `/templates/${template.id}`,
      summary: `Template „${template.name}“ ${isActive ? "aktiviert" : "deaktiviert"}.`,
    });

    return toView(template);
  }

  /** Record that a template was used to create a page (for the activity log). */
  async recordTemplateUsed(
    template: Pick<PageTemplateView, "id" | "name">,
    context: { worldId: string; worldSlug: string; pageTitle: string; pageHref: string },
  ): Promise<void> {
    await this.activity.log({
      worldId: context.worldId,
      worldSlug: context.worldSlug,
      action: "template_used",
      targetType: "page_template",
      targetId: template.id,
      targetLabel: template.name,
      targetHref: context.pageHref,
      summary: `Seite „${context.pageTitle}“ mit Template „${template.name}“ erstellt.`,
    });
  }

  private async pickUniqueSlug(base: string): Promise<string> {
    const safeBase = base || "template";
    const existing = await this.db.pageTemplate.findMany({ select: { slug: true } });
    const taken = new Set(existing.map((template) => template.slug));

    if (!taken.has(safeBase)) return safeBase;
    for (let i = 2; i < 1000; i += 1) {
      const candidate = `${safeBase}-${i}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${safeBase}-${Date.now()}`;
  }
}

export function createPageTemplateService(db: PrismaClient): PageTemplateService {
  return new PageTemplateService(db);
}
