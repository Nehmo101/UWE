import type { PrismaClient } from "@uwe/database/server";
import { sanitizeBackupData } from "./sanitize";
import type {
  BackupAssetPageLinkRecord,
  BackupAssetRecord,
  BackupCampaignRecord,
  BackupContentBlockRecord,
  BackupData,
  BackupGameSessionPageLinkRecord,
  BackupGameSessionRecord,
  BackupLabelRecord,
  BackupLabelTemplateRecord,
  BackupPrintListItemRecord,
  BackupPrintListRecord,
  BackupPageLinkRecord,
  BackupPagePlayerAccessRecord,
  BackupPageRecord,
  BackupSessionUnlockRecord,
  BackupSoundboardButtonPageLinkRecord,
  BackupSoundboardButtonRecord,
  BackupStats,
  BackupType,
  BackupUserRecord,
  BackupWorldMembershipRecord,
  BackupWorldRecord,
} from "./types";

export interface CollectScope {
  type: BackupType;
  worldSlug?: string;
  campaignSlug?: string;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function collectStats(data: BackupData): BackupStats {
  return {
    worlds: data.worlds.length,
    campaigns: data.campaigns.length,
    pages: data.pages.length,
    contentBlocks: data.contentBlocks.length,
    pageLinks: data.pageLinks.length,
    assets: data.assets.length,
    gameSessions: data.gameSessions.length,
    labels: data.labels.length,
    labelTemplates: data.labelTemplates.length,
    printLists: data.printLists.length,
    soundboardButtons: data.soundboardButtons.length,
  };
}

async function resolveScopeIds(
  db: PrismaClient,
  scope: CollectScope,
): Promise<{ worldIds: string[]; campaignIds: string[] }> {
  if (scope.type === "full") {
    const worlds = await db.world.findMany({ select: { id: true } });
    const campaigns = await db.campaign.findMany({ select: { id: true } });
    return {
      worldIds: worlds.map((world) => world.id),
      campaignIds: campaigns.map((campaign) => campaign.id),
    };
  }

  if (!scope.worldSlug) {
    throw new Error("worldSlug ist für Welt- und Kampagnen-Backups erforderlich.");
  }

  const world = await db.world.findUnique({ where: { slug: scope.worldSlug } });
  if (!world) {
    throw new Error(`Welt „${scope.worldSlug}" wurde nicht gefunden.`);
  }

  if (scope.type === "world") {
    const campaigns = await db.campaign.findMany({
      where: { worldId: world.id },
      select: { id: true },
    });
    return {
      worldIds: [world.id],
      campaignIds: campaigns.map((campaign) => campaign.id),
    };
  }

  if (!scope.campaignSlug) {
    throw new Error("campaignSlug ist für Kampagnen-Backups erforderlich.");
  }

  const campaign = await db.campaign.findFirst({
    where: { worldId: world.id, slug: scope.campaignSlug },
    select: { id: true },
  });
  if (!campaign) {
    throw new Error(
      `Kampagne „${scope.campaignSlug}" in Welt „${scope.worldSlug}" wurde nicht gefunden.`,
    );
  }

  return {
    worldIds: [world.id],
    campaignIds: [campaign.id],
  };
}

async function collectPageIds(
  db: PrismaClient,
  scope: CollectScope,
  worldIds: string[],
  campaignIds: string[],
): Promise<Set<string>> {
  const pageIds = new Set<string>();

  if (scope.type === "full" || scope.type === "world") {
    const pages = await db.page.findMany({
      where: { worldId: { in: worldIds } },
      select: { id: true },
    });
    for (const page of pages) {
      pageIds.add(page.id);
    }
    return pageIds;
  }

  const rootPages = await db.page.findMany({
    where: { campaignId: { in: campaignIds } },
    select: { id: true },
  });
  for (const page of rootPages) {
    pageIds.add(page.id);
  }

  let changed = true;
  while (changed) {
    changed = false;
    const children = await db.page.findMany({
      where: {
        worldId: { in: worldIds },
        parentPageId: { in: [...pageIds] },
      },
      select: { id: true },
    });
    for (const child of children) {
      if (!pageIds.has(child.id)) {
        pageIds.add(child.id);
        changed = true;
      }
    }
  }

  const sessionLinks = await db.gameSessionPageLink.findMany({
    where: {
      gameSession: { campaignId: { in: campaignIds } },
    },
    select: { pageId: true },
  });
  for (const link of sessionLinks) {
    pageIds.add(link.pageId);
  }

  return pageIds;
}

export async function collectBackupData(
  db: PrismaClient,
  scope: CollectScope,
): Promise<{ data: BackupData; stats: BackupStats }> {
  const { worldIds, campaignIds } = await resolveScopeIds(db, scope);
  const pageIds = await collectPageIds(db, scope, worldIds, campaignIds);

  const worlds = await db.world.findMany({
    where: { id: { in: worldIds } },
  });

  const campaigns =
    scope.type === "campaign"
      ? await db.campaign.findMany({ where: { id: { in: campaignIds } } })
      : await db.campaign.findMany({ where: { worldId: { in: worldIds } } });

  const pages = await db.page.findMany({
    where: { id: { in: [...pageIds] } },
  });

  const contentBlocks = await db.contentBlock.findMany({
    where: { pageId: { in: [...pageIds] } },
  });

  const pageLinks = await db.pageLink.findMany({
    where: {
      sourcePageId: { in: [...pageIds] },
      targetPageId: { in: [...pageIds] },
    },
  });

  const assets =
    scope.type === "campaign"
      ? await db.asset.findMany({
          where: {
            OR: [
              { campaignId: { in: campaignIds } },
              { id: { in: contentBlocks.map((block) => block.assetId).filter(Boolean) as string[] } },
              {
                id: {
                  in: (
                    await db.soundboardButton.findMany({
                      where: { campaignId: { in: campaignIds } },
                      select: { assetId: true },
                    })
                  )
                    .map((button) => button.assetId)
                    .filter(Boolean) as string[],
                },
              },
            ],
          },
        })
      : await db.asset.findMany({ where: { worldId: { in: worldIds } } });

  const assetIds = assets.map((asset) => asset.id);

  const assetPageLinks = await db.assetPageLink.findMany({
    where: {
      assetId: { in: assetIds },
      pageId: { in: [...pageIds] },
    },
  });

  const gameSessions =
    scope.type === "campaign"
      ? await db.gameSession.findMany({ where: { campaignId: { in: campaignIds } } })
      : await db.gameSession.findMany({ where: { worldId: { in: worldIds } } });

  const gameSessionIds = gameSessions.map((session) => session.id);

  const gameSessionPageLinks = await db.gameSessionPageLink.findMany({
    where: {
      gameSessionId: { in: gameSessionIds },
      pageId: { in: [...pageIds] },
    },
  });

  const labelTemplates = await db.labelTemplate.findMany({
    where: {
      OR: [{ worldId: { in: worldIds } }, { worldId: null, isSystem: true }],
    },
  });

  const labels =
    scope.type === "campaign"
      ? await db.label.findMany({ where: { campaignId: { in: campaignIds } } })
      : await db.label.findMany({ where: { worldId: { in: worldIds } } });

  const printLists =
    scope.type === "campaign"
      ? await db.printList.findMany({ where: { campaignId: { in: campaignIds } } })
      : await db.printList.findMany({ where: { worldId: { in: worldIds } } });

  const printListIds = printLists.map((list) => list.id);

  const printListItems = await db.printListItem.findMany({
    where: { printListId: { in: printListIds } },
  });

  const soundboardButtons =
    scope.type === "campaign"
      ? await db.soundboardButton.findMany({ where: { campaignId: { in: campaignIds } } })
      : await db.soundboardButton.findMany({ where: { worldId: { in: worldIds } } });

  const soundboardButtonIds = soundboardButtons.map((button) => button.id);

  const soundboardButtonPageLinks = await db.soundboardButtonPageLink.findMany({
    where: {
      soundboardButtonId: { in: soundboardButtonIds },
      pageId: { in: [...pageIds] },
    },
  });

  const worldMemberships = await db.worldMembership.findMany({
    where: { worldId: { in: worldIds } },
  });

  const pagePlayerAccess = await db.pagePlayerAccess.findMany({
    where: { pageId: { in: [...pageIds] } },
  });

  const sessionUnlocks = await db.sessionUnlock.findMany({
    where: { pageId: { in: [...pageIds] } },
  });

  const userIds = new Set<string>();
  for (const membership of worldMemberships) userIds.add(membership.userId);
  for (const access of pagePlayerAccess) userIds.add(access.userId);
  for (const unlock of sessionUnlocks) userIds.add(unlock.userId);

  const users = await db.user.findMany({
    where: { id: { in: [...userIds] } },
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
    },
  });

  const data: BackupData = sanitizeBackupData({
    worlds: worlds.map(
      (world): BackupWorldRecord => ({
        id: world.id,
        name: world.name,
        slug: world.slug,
        description: world.description,
        guestModeEnabled: world.guestModeEnabled,
        createdAt: world.createdAt.toISOString(),
        updatedAt: world.updatedAt.toISOString(),
      }),
    ),
    campaigns: campaigns.map(
      (campaign): BackupCampaignRecord => ({
        id: campaign.id,
        worldId: campaign.worldId,
        name: campaign.name,
        slug: campaign.slug,
        description: campaign.description,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
      }),
    ),
    pages: pages.map(
      (page): BackupPageRecord => ({
        id: page.id,
        worldId: page.worldId,
        campaignId: page.campaignId,
        parentPageId: page.parentPageId,
        title: page.title,
        slug: page.slug,
        type: page.type,
        summary: page.summary,
        visibility: page.visibility,
        publishStatus: page.publishStatus,
        canonicalStatus: page.canonicalStatus,
        prepStatus: page.prepStatus,
        tags: page.tags,
        aliases: page.aliases,
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
      }),
    ),
    contentBlocks: contentBlocks.map(
      (block): BackupContentBlockRecord => ({
        id: block.id,
        pageId: block.pageId,
        assetId: block.assetId,
        type: block.type,
        sortOrder: block.sortOrder,
        content: block.content,
        visibility: block.visibility,
        metadata: block.metadata,
        createdAt: block.createdAt.toISOString(),
        updatedAt: block.updatedAt.toISOString(),
      }),
    ),
    pageLinks: pageLinks.map(
      (link): BackupPageLinkRecord => ({
        id: link.id,
        sourcePageId: link.sourcePageId,
        targetPageId: link.targetPageId,
        relationType: link.relationType,
        label: link.label,
        createdAt: link.createdAt.toISOString(),
      }),
    ),
    assets: assets.map(
      (asset): BackupAssetRecord => ({
        id: asset.id,
        worldId: asset.worldId,
        campaignId: asset.campaignId,
        title: asset.title,
        description: asset.description,
        type: asset.type,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
        size: asset.size,
        visibility: asset.visibility,
        tags: asset.tags,
        metadata: asset.metadata,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
      }),
    ),
    assetPageLinks: assetPageLinks.map(
      (link): BackupAssetPageLinkRecord => ({
        id: link.id,
        assetId: link.assetId,
        pageId: link.pageId,
        createdAt: link.createdAt.toISOString(),
      }),
    ),
    gameSessions: gameSessions.map(
      (session): BackupGameSessionRecord => ({
        id: session.id,
        worldId: session.worldId,
        campaignId: session.campaignId,
        title: session.title,
        sessionNumber: session.sessionNumber,
        date: toIso(session.date),
        status: session.status,
        summaryDm: session.summaryDm,
        summaryPlayer: session.summaryPlayer,
        notes: session.notes,
        openPlots: session.openPlots,
        playerDecisions: session.playerDecisions,
        recapPublished: session.recapPublished,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      }),
    ),
    gameSessionPageLinks: gameSessionPageLinks.map(
      (link): BackupGameSessionPageLinkRecord => ({
        id: link.id,
        gameSessionId: link.gameSessionId,
        pageId: link.pageId,
        createdAt: link.createdAt.toISOString(),
      }),
    ),
    labelTemplates: labelTemplates.map(
      (template): BackupLabelTemplateRecord => ({
        id: template.id,
        worldId: template.worldId,
        name: template.name,
        slug: template.slug,
        description: template.description,
        layoutSettings: template.layoutSettings,
        isSystem: template.isSystem,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      }),
    ),
    labels: labels.map(
      (label): BackupLabelRecord => ({
        id: label.id,
        worldId: label.worldId,
        campaignId: label.campaignId,
        title: label.title,
        sourceType: label.sourceType,
        sourceId: label.sourceId,
        templateId: label.templateId,
        content: label.content,
        layoutSettings: label.layoutSettings,
        printStatus: label.printStatus,
        createdAt: label.createdAt.toISOString(),
        updatedAt: label.updatedAt.toISOString(),
      }),
    ),
    printLists: printLists.map(
      (list): BackupPrintListRecord => ({
        id: list.id,
        worldId: list.worldId,
        campaignId: list.campaignId,
        name: list.name,
        description: list.description,
        status: list.status,
        forNextSession: list.forNextSession,
        createdAt: list.createdAt.toISOString(),
        updatedAt: list.updatedAt.toISOString(),
      }),
    ),
    printListItems: printListItems.map(
      (item): BackupPrintListItemRecord => ({
        id: item.id,
        printListId: item.printListId,
        labelId: item.labelId,
        copies: item.copies,
        sortOrder: item.sortOrder,
      }),
    ),
    soundboardButtons: soundboardButtons.map(
      (button): BackupSoundboardButtonRecord => ({
        id: button.id,
        worldId: button.worldId,
        campaignId: button.campaignId,
        title: button.title,
        sourceType: button.sourceType,
        sourceUrl: button.sourceUrl,
        assetId: button.assetId,
        thumbnail: button.thumbnail,
        volume: button.volume,
        loop: button.loop,
        tags: button.tags,
        visibility: button.visibility,
        sortOrder: button.sortOrder,
        createdAt: button.createdAt.toISOString(),
        updatedAt: button.updatedAt.toISOString(),
      }),
    ),
    soundboardButtonPageLinks: soundboardButtonPageLinks.map(
      (link): BackupSoundboardButtonPageLinkRecord => ({
        id: link.id,
        soundboardButtonId: link.soundboardButtonId,
        pageId: link.pageId,
        createdAt: link.createdAt.toISOString(),
      }),
    ),
    worldMemberships: worldMemberships.map(
      (membership): BackupWorldMembershipRecord => ({
        id: membership.id,
        userId: membership.userId,
        worldId: membership.worldId,
        role: membership.role,
        characterName: membership.characterName,
        createdAt: membership.createdAt.toISOString(),
        updatedAt: membership.updatedAt.toISOString(),
      }),
    ),
    pagePlayerAccess: pagePlayerAccess.map(
      (access): BackupPagePlayerAccessRecord => ({
        id: access.id,
        pageId: access.pageId,
        userId: access.userId,
      }),
    ),
    sessionUnlocks: sessionUnlocks.map(
      (unlock): BackupSessionUnlockRecord => ({
        id: unlock.id,
        pageId: unlock.pageId,
        userId: unlock.userId,
        unlockedAt: unlock.unlockedAt.toISOString(),
        sessionLabel: unlock.sessionLabel,
      }),
    ),
    users: users.map(
      (user): BackupUserRecord => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      }),
    ),
  });

  return { data, stats: collectStats(data) };
}

export { collectStats };
