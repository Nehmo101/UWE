import type { PrismaClient } from "./client";
import { brainPrisma } from "./brain-client";
import { createActivityLogService } from "./activity-log-service";
import { normalizeLookupKey, parseWikiLinks } from "./page-service";
import { buildPageUrl } from "./page-types";
import { createUndoService } from "./undo-service";
import type { InspectorFixAction } from "./world-inspector";

/**
 * Applies fix actions for Inspector findings.
 *
 * Every fix:
 * - validates that the target belongs to the given world (no cross-world fixes),
 * - snapshots the previous state as an UndoEntry (reversible),
 * - writes an activity log entry referencing the undo entry.
 */

export interface ApplyInspectorFixInput {
  worldSlug: string;
  action: InspectorFixAction;
  pageId?: string;
  /** Broken wikilink target (only for remove_broken_wiki_link). */
  linkTarget?: string;
}

export interface InspectorFixResult {
  ok: boolean;
  message: string;
  undoEntryId?: string;
}

export class InspectorFixService {
  constructor(private readonly db: PrismaClient) {}

  private get undo() {
    return createUndoService(brainPrisma, this.db);
  }

  private get activity() {
    return createActivityLogService(this.db);
  }

  async applyFix(input: ApplyInspectorFixInput): Promise<InspectorFixResult> {
    const world = await this.db.world.findUnique({ where: { slug: input.worldSlug } });
    if (!world) return { ok: false, message: "Welt nicht gefunden." };

    try {
      switch (input.action) {
        case "remove_broken_wiki_link":
          return await this.removeBrokenWikiLink(world, input.pageId, input.linkTarget);
        case "assign_page_campaign":
          return await this.assignPageCampaign(world, input.pageId);
        default:
          return { ok: false, message: `Unbekannte Fix-Aktion: ${input.action}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
      await this.activity.log({
        worldId: world.id,
        worldSlug: world.slug,
        action: "error",
        targetType: "world",
        targetId: world.id,
        targetLabel: world.name,
        summary: `Inspector-Fix „${input.action}“ fehlgeschlagen: ${message}`,
      });
      return { ok: false, message };
    }
  }

  private async getWorldPage(worldId: string, pageId: string | undefined) {
    if (!pageId) return null;
    const page = await this.db.page.findUnique({ where: { id: pageId } });
    if (!page || page.worldId !== worldId) return null;
    return page;
  }

  private async removeBrokenWikiLink(
    world: { id: string; slug: string },
    pageId: string | undefined,
    linkTarget: string | undefined,
  ): Promise<InspectorFixResult> {
    if (!linkTarget) return { ok: false, message: "Link-Ziel fehlt." };

    const page = await this.getWorldPage(world.id, pageId);
    if (!page) return { ok: false, message: "Seite nicht gefunden." };

    const blocks = await this.db.contentBlock.findMany({
      where: { pageId: page.id },
      orderBy: { sortOrder: "asc" },
    });

    const targetKey = normalizeLookupKey(linkTarget);
    const undoEntryIds: string[] = [];
    let replacedCount = 0;

    for (const block of blocks) {
      const links = parseWikiLinks(block.content).filter(
        (link) => normalizeLookupKey(link.target) === targetKey,
      );
      if (links.length === 0) continue;

      const undoEntry = await this.undo.captureBlock(block.id, "block.update");
      undoEntryIds.push(undoEntry.id);

      // Replace from the end so earlier offsets stay valid.
      let content = block.content;
      for (const link of [...links].reverse()) {
        const plainText = link.label ?? link.target;
        content = content.slice(0, link.start) + plainText + content.slice(link.end);
        replacedCount += 1;
      }

      await this.db.contentBlock.update({
        where: { id: block.id },
        data: { content },
      });
    }

    if (replacedCount === 0) {
      return { ok: false, message: `Kein Wikilink auf „${linkTarget}“ gefunden.` };
    }

    const href = buildPageUrl(world.slug, page.type, page.slug);
    await this.activity.log({
      worldId: world.id,
      worldSlug: world.slug,
      action: "inspector_fix_applied",
      targetType: "page",
      targetId: page.id,
      targetLabel: page.title,
      targetHref: href,
      summary: `Inspector-Fix: ${replacedCount} kaputte(r) Wikilink(s) auf „${linkTarget}“ in „${page.title}“ in Text umgewandelt.`,
      details: { fix: "remove_broken_wiki_link", linkTarget, undoEntryIds },
      undoEntryId: undoEntryIds[0],
    });

    return {
      ok: true,
      message: `${replacedCount} Wikilink(s) auf „${linkTarget}“ entfernt.`,
      undoEntryId: undoEntryIds[0],
    };
  }

  private async assignPageCampaign(
    world: { id: string; slug: string },
    pageId: string | undefined,
  ): Promise<InspectorFixResult> {
    const page = await this.getWorldPage(world.id, pageId);
    if (!page) return { ok: false, message: "Seite nicht gefunden." };
    if (page.campaignId) {
      return { ok: true, message: "Seite ist bereits einer Kampagne zugeordnet." };
    }

    const campaigns = await this.db.campaign.findMany({
      where: { worldId: world.id },
      orderBy: { createdAt: "asc" },
    });
    if (campaigns.length !== 1) {
      return {
        ok: false,
        message:
          "Automatische Zuordnung ist nur möglich, wenn die Welt genau eine Kampagne hat.",
      };
    }

    const campaign = campaigns[0];
    const undoEntry = await this.undo.capturePageUpdate(page.id);

    await this.db.page.update({
      where: { id: page.id },
      data: { campaignId: campaign.id },
    });

    const href = buildPageUrl(world.slug, page.type, page.slug);
    await this.activity.log({
      worldId: world.id,
      worldSlug: world.slug,
      action: "inspector_fix_applied",
      targetType: "page",
      targetId: page.id,
      targetLabel: page.title,
      targetHref: href,
      summary: `Inspector-Fix: „${page.title}“ der Kampagne „${campaign.name}“ zugeordnet.`,
      details: { fix: "assign_page_campaign", campaignId: campaign.id },
      undoEntryId: undoEntry.id,
    });

    return {
      ok: true,
      message: `„${page.title}“ ist jetzt der Kampagne „${campaign.name}“ zugeordnet.`,
      undoEntryId: undoEntry.id,
    };
  }
}

export function createInspectorFixService(db: PrismaClient): InspectorFixService {
  return new InspectorFixService(db);
}
