import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@uwe/database/server";
import { createSettingsService } from "@uwe/database/server";
import { extractBackupAssets } from "./archive";
import { previewRestore } from "./restore-preview";
import type {
  BackupBundle,
  RestoreExecuteOptions,
  RestoreExecuteResult,
} from "./types";

function remapId(idMap: Map<string, string>, oldId: string): string {
  if (!idMap.has(oldId)) {
    idMap.set(oldId, randomUUID());
  }
  return idMap.get(oldId)!;
}

function resolveUniqueSlug(baseSlug: string, taken: Set<string>): string {
  if (!taken.has(baseSlug)) return baseSlug;
  let index = 2;
  while (taken.has(`${baseSlug}-${index}`)) {
    index++;
  }
  return `${baseSlug}-${index}`;
}

export async function executeRestore(
  db: PrismaClient,
  bundle: BackupBundle,
  options: RestoreExecuteOptions,
  zipBuffer?: Buffer,
  uploadsRoot?: string,
): Promise<RestoreExecuteResult> {
  if (!options.confirmed) {
    throw new Error("Restore erfordert confirmed: true.");
  }

  const preview = await previewRestore(db, bundle, options.targetWorldSlug);
  const beforeCounts = await db.world.count();

  const result: RestoreExecuteResult = {
    preview,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    items: [],
    errors: [],
  };

  const idMap = new Map<string, string>();
  const takenWorldSlugs = new Set(
    (await db.world.findMany({ select: { slug: true } })).map((world) => world.slug),
  );
  const takenPageSlugsByWorld = new Map<string, Set<string>>();

  for (const world of bundle.data.worlds) {
    const existing = await db.world.findUnique({ where: { slug: world.slug } });

    if (existing) {
      if (options.skipExisting) {
        idMap.set(world.id, existing.id);
        result.skipped++;
        result.items.push({
          entityType: "world",
          identifier: world.slug,
          status: "skipped",
        });
        continue;
      }

      if (options.allowUpdates) {
        await db.world.update({
          where: { id: existing.id },
          data: {
            name: world.name,
            description: world.description,
            guestModeEnabled: world.guestModeEnabled,
          },
        });
        idMap.set(world.id, existing.id);
        result.updated++;
        result.items.push({
          entityType: "world",
          identifier: world.slug,
          status: "updated",
        });
        continue;
      }

      if (options.autoResolveSlugConflicts) {
        const slug = resolveUniqueSlug(world.slug, takenWorldSlugs);
        takenWorldSlugs.add(slug);
        await db.world.create({
          data: {
            id: remapId(idMap, world.id),
            name: world.name,
            slug,
            description: world.description,
            guestModeEnabled: world.guestModeEnabled,
          },
        });
        result.created++;
        result.items.push({
          entityType: "world",
          identifier: slug,
          status: "created",
        });
        continue;
      }

      result.failed++;
      result.errors.push(`Welt-Konflikt: ${world.slug}`);
      result.items.push({
        entityType: "world",
        identifier: world.slug,
        status: "failed",
        error: "Welt existiert bereits.",
      });
      continue;
    }

    const newId = remapId(idMap, world.id);
    takenWorldSlugs.add(world.slug);
    await db.world.create({
      data: {
        id: newId,
        name: world.name,
        slug: world.slug,
        description: world.description,
        guestModeEnabled: world.guestModeEnabled,
      },
    });
    result.created++;
    result.items.push({
      entityType: "world",
      identifier: world.slug,
      status: "created",
    });
  }

  for (const campaign of bundle.data.campaigns) {
    const worldId = idMap.get(campaign.worldId);
    if (!worldId) {
      result.failed++;
      result.errors.push(`Kampagne ohne Welt: ${campaign.slug}`);
      continue;
    }

    const existing = await db.campaign.findFirst({
      where: { worldId, slug: campaign.slug },
    });

    if (existing) {
      idMap.set(campaign.id, existing.id);
      result.skipped++;
      result.items.push({
        entityType: "campaign",
        identifier: campaign.slug,
        status: "skipped",
      });
      continue;
    }

    await db.campaign.create({
      data: {
        id: remapId(idMap, campaign.id),
        worldId,
        name: campaign.name,
        slug: campaign.slug,
        description: campaign.description,
      },
    });
    result.created++;
    result.items.push({
      entityType: "campaign",
      identifier: campaign.slug,
      status: "created",
    });
  }

  for (const template of bundle.data.labelTemplates) {
    if (template.isSystem && !template.worldId) {
      const existing = await db.labelTemplate.findFirst({
        where: { slug: template.slug, worldId: null },
      });
      if (existing) {
        idMap.set(template.id, existing.id);
        continue;
      }
    }

    const worldId = template.worldId ? idMap.get(template.worldId) ?? null : null;
    const existing = await db.labelTemplate.findFirst({
      where: {
        slug: template.slug,
        worldId,
      },
    });

    if (existing) {
      idMap.set(template.id, existing.id);
      continue;
    }

    await db.labelTemplate.create({
      data: {
        id: remapId(idMap, template.id),
        worldId,
        name: template.name,
        slug: template.slug,
        description: template.description,
        layoutSettings: template.layoutSettings as object,
        isSystem: template.isSystem,
      },
    });
  }

  const sortedPages = [...bundle.data.pages].sort((a, b) => {
    if (!a.parentPageId && b.parentPageId) return -1;
    if (a.parentPageId && !b.parentPageId) return 1;
    return 0;
  });

  for (const page of sortedPages) {
    const worldId = idMap.get(page.worldId);
    if (!worldId) continue;

    if (!takenPageSlugsByWorld.has(worldId)) {
      takenPageSlugsByWorld.set(
        worldId,
        new Set(
          (
            await db.page.findMany({
              where: { worldId },
              select: { slug: true },
            })
          ).map((entry) => entry.slug),
        ),
      );
    }

    const takenSlugs = takenPageSlugsByWorld.get(worldId)!;
    const existing = await db.page.findFirst({ where: { worldId, slug: page.slug } });

    if (existing) {
      if (options.allowUpdates) {
        await db.page.update({
          where: { id: existing.id },
          data: {
            title: page.title,
            summary: page.summary,
            visibility: page.visibility as never,
            publishStatus: page.publishStatus as never,
            canonicalStatus: page.canonicalStatus as never,
            prepStatus: page.prepStatus as never,
            tags: page.tags as never,
            aliases: page.aliases as never,
          },
        });
        idMap.set(page.id, existing.id);
        result.updated++;
        continue;
      }

      if (options.autoResolveSlugConflicts) {
        const slug = resolveUniqueSlug(page.slug, takenSlugs);
        takenSlugs.add(slug);
        await db.page.create({
          data: {
            id: remapId(idMap, page.id),
            worldId,
            campaignId: page.campaignId ? idMap.get(page.campaignId) ?? null : null,
            parentPageId: page.parentPageId ? idMap.get(page.parentPageId) ?? null : null,
            title: page.title,
            slug,
            type: page.type as never,
            summary: page.summary,
            visibility: page.visibility as never,
            publishStatus: page.publishStatus as never,
            canonicalStatus: page.canonicalStatus as never,
            prepStatus: page.prepStatus as never,
            tags: page.tags as never,
            aliases: page.aliases as never,
          },
        });
        result.created++;
        continue;
      }

      idMap.set(page.id, existing.id);
      result.skipped++;
      continue;
    }

    takenSlugs.add(page.slug);
    await db.page.create({
      data: {
        id: remapId(idMap, page.id),
        worldId,
        campaignId: page.campaignId ? idMap.get(page.campaignId) ?? null : null,
        parentPageId: page.parentPageId ? idMap.get(page.parentPageId) ?? null : null,
        title: page.title,
        slug: page.slug,
        type: page.type as never,
        summary: page.summary,
        visibility: page.visibility as never,
        publishStatus: page.publishStatus as never,
        canonicalStatus: page.canonicalStatus as never,
        prepStatus: page.prepStatus as never,
        tags: page.tags as never,
        aliases: page.aliases as never,
      },
    });
    result.created++;
  }

  for (const block of bundle.data.contentBlocks) {
    const pageId = idMap.get(block.pageId);
    if (!pageId) continue;

    const existing = await db.contentBlock.findUnique({ where: { id: block.id } });
    if (existing) continue;

    await db.contentBlock.create({
      data: {
        id: remapId(idMap, block.id),
        pageId,
        assetId: block.assetId ? idMap.get(block.assetId) ?? null : null,
        type: block.type as never,
        sortOrder: block.sortOrder,
        content: block.content,
        visibility: block.visibility as never,
        metadata: block.metadata as never,
      },
    });
  }

  for (const link of bundle.data.pageLinks) {
    const sourcePageId = idMap.get(link.sourcePageId);
    const targetPageId = idMap.get(link.targetPageId);
    if (!sourcePageId || !targetPageId) continue;

    await db.pageLink.create({
      data: {
        id: remapId(idMap, link.id),
        sourcePageId,
        targetPageId,
        relationType: link.relationType,
        label: link.label,
      },
    });
  }

  for (const asset of bundle.data.assets) {
    const worldId = idMap.get(asset.worldId);
    if (!worldId) continue;

    const existing = await db.asset.findUnique({ where: { id: asset.id } });
    if (existing) {
      idMap.set(asset.id, existing.id);
      continue;
    }

    await db.asset.create({
      data: {
        id: remapId(idMap, asset.id),
        worldId,
        campaignId: asset.campaignId ? idMap.get(asset.campaignId) ?? null : null,
        title: asset.title,
        description: asset.description,
        type: asset.type as never,
        storageKey: asset.storageKey.replace(asset.worldId, worldId),
        mimeType: asset.mimeType,
        size: asset.size,
        visibility: asset.visibility as never,
        tags: asset.tags as never,
        metadata: asset.metadata as never,
      },
    });
    result.created++;
  }

  if (zipBuffer && uploadsRoot) {
    try {
      extractBackupAssets(zipBuffer, uploadsRoot, idMap);
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : "Asset-Wiederherstellung fehlgeschlagen.",
      );
    }
  }

  for (const link of bundle.data.assetPageLinks) {
    const assetId = idMap.get(link.assetId);
    const pageId = idMap.get(link.pageId);
    if (!assetId || !pageId) continue;

    await db.assetPageLink.create({
      data: {
        id: remapId(idMap, link.id),
        assetId,
        pageId,
      },
    });
  }

  for (const session of bundle.data.gameSessions) {
    const worldId = idMap.get(session.worldId);
    if (!worldId) continue;

    await db.gameSession.create({
      data: {
        id: remapId(idMap, session.id),
        worldId,
        campaignId: session.campaignId ? idMap.get(session.campaignId) ?? null : null,
        title: session.title,
        sessionNumber: session.sessionNumber,
        date: session.date ? new Date(session.date) : null,
        status: session.status as never,
        summaryDm: session.summaryDm,
        summaryPlayer: session.summaryPlayer,
        notes: session.notes,
        openPlots: session.openPlots,
        playerDecisions: session.playerDecisions,
        recapPublished: session.recapPublished,
      },
    });
  }

  for (const link of bundle.data.gameSessionPageLinks) {
    const gameSessionId = idMap.get(link.gameSessionId);
    const pageId = idMap.get(link.pageId);
    if (!gameSessionId || !pageId) continue;

    await db.gameSessionPageLink.create({
      data: {
        id: remapId(idMap, link.id),
        gameSessionId,
        pageId,
      },
    });
  }

  for (const label of bundle.data.labels) {
    const worldId = idMap.get(label.worldId);
    const templateId = idMap.get(label.templateId);
    if (!worldId || !templateId) continue;

    await db.label.create({
      data: {
        id: remapId(idMap, label.id),
        worldId,
        campaignId: label.campaignId ? idMap.get(label.campaignId) ?? null : null,
        title: label.title,
        sourceType: label.sourceType as never,
        sourceId: label.sourceId ? idMap.get(label.sourceId) ?? label.sourceId : null,
        templateId,
        content: label.content as never,
        layoutSettings: label.layoutSettings as never,
        printStatus: (label.printStatus as never) ?? "open",
      },
    });
  }

  for (const list of bundle.data.printLists ?? []) {
    const worldId = idMap.get(list.worldId);
    if (!worldId) continue;

    await db.printList.create({
      data: {
        id: remapId(idMap, list.id),
        worldId,
        campaignId: list.campaignId ? idMap.get(list.campaignId) ?? null : null,
        name: list.name,
        description: list.description,
        status: list.status as never,
        forNextSession: list.forNextSession,
      },
    });
  }

  for (const item of bundle.data.printListItems ?? []) {
    const printListId = idMap.get(item.printListId);
    const labelId = idMap.get(item.labelId);
    if (!printListId || !labelId) continue;

    await db.printListItem.create({
      data: {
        id: remapId(idMap, item.id),
        printListId,
        labelId,
        copies: item.copies,
        sortOrder: item.sortOrder,
      },
    });
  }

  for (const button of bundle.data.soundboardButtons) {
    const worldId = idMap.get(button.worldId);
    if (!worldId) continue;

    await db.soundboardButton.create({
      data: {
        id: remapId(idMap, button.id),
        worldId,
        campaignId: button.campaignId ? idMap.get(button.campaignId) ?? null : null,
        title: button.title,
        sourceType: button.sourceType as never,
        sourceUrl: button.sourceUrl,
        assetId: button.assetId ? idMap.get(button.assetId) ?? null : null,
        thumbnail: button.thumbnail,
        volume: button.volume,
        loop: button.loop,
        tags: button.tags as never,
        visibility: button.visibility as never,
        sortOrder: button.sortOrder,
      },
    });
  }

  for (const link of bundle.data.soundboardButtonPageLinks) {
    const soundboardButtonId = idMap.get(link.soundboardButtonId);
    const pageId = idMap.get(link.pageId);
    if (!soundboardButtonId || !pageId) continue;

    await db.soundboardButtonPageLink.create({
      data: {
        id: remapId(idMap, link.id),
        soundboardButtonId,
        pageId,
      },
    });
  }

  const afterCounts = await db.world.count();
  if (afterCounts === beforeCounts && result.created === 0 && result.updated === 0) {
    result.errors.push("Es wurden keine Daten wiederhergestellt.");
  }

  if (
    options.restoreSettings !== false &&
    bundle.manifest.type === "full" &&
    bundle.settings
  ) {
    const settingsService = createSettingsService(db);
    const stored = bundle.settings;
    await settingsService.updateSettings({
      app: stored.app as never,
      worlds: stored.worlds as never,
      campaigns: stored.campaigns as never,
      portal: stored.portal as never,
      ai: stored.ai as never,
      mail: stored.mail as never,
      storage: stored.storage as never,
      backup: stored.backup as never,
      privacy: stored.privacy as never,
    });
    result.updated++;
    result.items.push({
      entityType: "settings",
      identifier: "system",
      status: "updated",
    });
  }

  return result;
}

export async function previewRestoreOnly(
  db: PrismaClient,
  bundle: BackupBundle,
  targetWorldSlug?: string,
) {
  return previewRestore(db, bundle, targetWorldSlug);
}
