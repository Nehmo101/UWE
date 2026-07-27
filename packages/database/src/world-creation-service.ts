import type { ContentBlockType } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { createAuthService } from "./auth";
import { logAuditEvent } from "./audit-log-service";
import { pickUniqueSlug, slugifyPageTitle } from "./page-templates";
import { createWorldCalendarService } from "./world-calendar-service";
import {
  buildSeedPageBlocks,
  getWorldTemplate,
  resolveWorldTemplateId,
  seedPageDefaults,
  type WorldTemplateId,
} from "./world-templates";

export interface CreateWorldRequest {
  name: string;
  slug?: string;
  description?: string | null;
  guestModeEnabled?: boolean;
  isSandbox?: boolean;
  templateId?: WorldTemplateId | string | null;
}

export interface CreatedWorldResult {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  guestModeEnabled: boolean;
  isSandbox: boolean;
  templateId: WorldTemplateId;
  seededPageCount: number;
  seededCalendar: boolean;
}

export class WorldCreationService {
  constructor(private readonly db: PrismaClient) {}

  async createWorldForUser(
    userId: string,
    input: CreateWorldRequest,
  ): Promise<CreatedWorldResult> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("WORLD_NAME_REQUIRED");
    }

    const templateId = resolveWorldTemplateId(input.templateId);
    const template = getWorldTemplate(templateId);
    if (!template) {
      throw new Error("WORLD_TEMPLATE_INVALID");
    }

    const isSandbox = input.isSandbox ?? false;
    const guestModeEnabled = isSandbox ? false : (input.guestModeEnabled ?? false);

    const existingSlugs = (await this.db.world.findMany({ select: { slug: true } })).map(
      (world) => world.slug,
    );
    const baseSlug = (input.slug?.trim() || slugifyPageTitle(name)).slice(0, 80);
    const slug = pickUniqueSlug(baseSlug || "welt", existingSlugs);

    const world = await this.db.world.create({
      data: {
        name,
        slug,
        description: input.description?.trim() || null,
        guestModeEnabled,
        isSandbox,
      },
    });

    // Membership, template pages and calendar are not created in a single
    // interactive transaction (that would require threading a tx client through
    // several service constructors). Instead, if any step fails, delete the
    // world so callers never see a half-created world with a membership but
    // empty content — the schema's onDelete cascades clean up children.
    let seededPageCount: number;
    let seededCalendar = false;
    try {
      const auth = createAuthService(this.db);
      await auth.createWorldMembership({
        userId,
        worldId: world.id,
        role: "owner",
      });

      seededPageCount = await this.applyWorldTemplate(world.id, template);
      if (template.seedCalendar) {
        await createWorldCalendarService(this.db).upsertForWorld({ worldId: world.id });
        seededCalendar = true;
      }
    } catch (error) {
      await this.db.world.delete({ where: { id: world.id } }).catch((cleanupError) => {
        console.error(
          "[uwe/world-creation] failed to roll back partially created world",
          world.id,
          cleanupError,
        );
      });
      throw error;
    }

    await logAuditEvent(this.db, {
      actorUserId: userId,
      action: "content_created",
      targetType: "world",
      targetId: world.id,
      worldId: world.id,
      metadata: {
        slug: world.slug,
        guestModeEnabled: world.guestModeEnabled,
        isSandbox: world.isSandbox,
        templateId,
        seededPageCount,
        seededCalendar,
      },
    });

    return {
      id: world.id,
      name: world.name,
      slug: world.slug,
      description: world.description,
      guestModeEnabled: world.guestModeEnabled,
      isSandbox: world.isSandbox,
      templateId,
      seededPageCount,
      seededCalendar,
    };
  }

  private async applyWorldTemplate(
    worldId: string,
    template: NonNullable<ReturnType<typeof getWorldTemplate>>,
  ): Promise<number> {
    if (template.seedPages.length === 0) {
      return 0;
    }

    let campaignId: string | null = null;
    if (template.campaign) {
      const campaign = await this.db.campaign.create({
        data: {
          worldId,
          name: template.campaign.name,
          slug: template.campaign.slug,
          description: template.campaign.description ?? null,
        },
      });
      campaignId = campaign.id;
    }

    const existingPageSlugs = new Set<string>();
    let created = 0;

    for (const seed of template.seedPages) {
      const { pageType } = seedPageDefaults(seed);
      const basePageSlug = seed.slug?.trim() || slugifyPageTitle(seed.title);
      const pageSlug = pickUniqueSlug(basePageSlug || "seite", [...existingPageSlugs]);
      existingPageSlugs.add(pageSlug);

      const blocks = buildSeedPageBlocks(seed);
      await this.db.page.create({
        data: {
          worldId,
          campaignId,
          title: seed.title,
          slug: pageSlug,
          type: pageType,
          canonicalStatus: "draft",
          contentBlocks: {
            create: blocks.map((block) => ({
              type: block.type as ContentBlockType,
              sortOrder: block.sortOrder,
              content: block.content,
            })),
          },
        },
      });
      created += 1;
    }

    return created;
  }
}

export function createWorldCreationService(db: PrismaClient): WorldCreationService {
  return new WorldCreationService(db);
}
