import type { PrismaClient } from "@uwe/database/server";
import type { BrainPrismaClient } from "@uwe/database/brain-client";
import type { FamilyPrismaClient } from "@uwe/database/family-client";
import { createSettingsService } from "@uwe/database/server";
import { loadInBatches } from "./batch";
import { sanitizeBackupData, sanitizeSettingsForBackup } from "./sanitize";
import type {
  BackupAssetPageLinkRecord,
  BackupAssetRecord,
  BackupCampaignRecord,
  BackupContentBlockRecord,
  BackupDailyAdminData,
  BackupData,
  BackupGameSessionPageLinkRecord,
  BackupGameSessionRecord,
  BackupGameSessionFocusRecord,
  BackupDungeonRecord,
  BackupDocImportSourceRecord,
  BackupDocImportPageBindingRecord,
  BackupLabelRecord,
  BackupLabelTemplateRecord,
  BackupPrintListItemRecord,
  BackupPrintListRecord,
  BackupPageLinkRecord,
  BackupPageRecord,
  BackupPageTemplateRecord,
  BackupPlayerNoteRecord,
  BackupSettingsRecord,
  BackupSoundboardButtonPageLinkRecord,
  BackupSoundboardButtonRecord,
  BackupStats,
  BackupTerraKarteRecord,
  BackupType,
  BackupUserRecord,
  BackupWorldMembershipRecord,
  BackupWorldRecord,
} from "./types";

export interface CollectScope {
  type: BackupType;
  worldSlug?: string;
  campaignSlug?: string;
  includePlayerNotes?: boolean;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function countDailyAdminEntities(dailyAdmin: BackupDailyAdminData | undefined): number {
  if (!dailyAdmin) return 0;
  return Object.values(dailyAdmin).reduce(
    (total, records) => total + (Array.isArray(records) ? records.length : 0),
    0,
  );
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
    pageTemplates: data.pageTemplates?.length ?? 0,
    worldMemberships: data.worldMemberships.length,
    playerNotes: data.playerNotes?.length ?? 0,
    terraKarten: data.terraKarten?.length ?? 0,
    dailyAdminEntities: countDailyAdminEntities(data.dailyAdmin),
  };
}

/** Daily Admin OS data is global (not world-scoped) — collected only for full backups. */
async function collectDailyAdminData(
  brainDb: BrainPrismaClient,
  familyDb: FamilyPrismaClient,
): Promise<BackupDailyAdminData> {
  const [
    captureEntries,
    personalProjects,
    workshopProjects,
    workshopPaintRecipes,
    workshopPrintProfiles,
    workshopTerrainRentals,
    contractExpenses,
    hardwareDevices,
    personalBrainDocuments,
    personalBrainChunks,
    personalBrainFacts,
    adminEntityLinks,
  ] = await Promise.all([
    brainDb.captureEntry.findMany(),
    brainDb.personalProject.findMany(),
    brainDb.workshopProject.findMany(),
    brainDb.workshopPaintRecipe.findMany(),
    brainDb.workshopPrintProfile.findMany(),
    brainDb.workshopTerrainRental.findMany(),
    familyDb.contractExpense.findMany(),
    brainDb.hardwareDevice.findMany(),
    brainDb.personalBrainDocument.findMany(),
    brainDb.personalBrainChunk.findMany(),
    brainDb.personalBrainFact.findMany(),
    brainDb.adminEntityLink.findMany(),
  ]);

  return {
    captureEntries: captureEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      captureType: entry.captureType,
      status: entry.status,
      url: entry.url,
      storageKey: entry.storageKey,
      worldId: entry.worldId,
      pageId: entry.pageId,
      metadata: entry.metadata,
      capturedAt: entry.capturedAt.toISOString(),
      triagedAt: toIso(entry.triagedAt),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
    personalProjects: personalProjects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      category: project.category,
      nextAction: project.nextAction,
      nextActionDate: toIso(project.nextActionDate),
      notes: project.notes,
      links: project.links,
      costCents: project.costCents,
      worldId: project.worldId,
      pageId: project.pageId,
      metadata: project.metadata,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    })),
    workshopProjects: workshopProjects.map((project) => ({
      id: project.id,
      title: project.title,
      projectType: project.projectType,
      status: project.status,
      description: project.description,
      materialsNeeded: project.materialsNeeded,
      materialsUsed: project.materialsUsed,
      colorsUsed: project.colorsUsed,
      filamentsUsed: project.filamentsUsed,
      stlLinks: project.stlLinks,
      imageGallery: project.imageGallery,
      referenceImages: project.referenceImages,
      progressPhotos: project.progressPhotos,
      resultPhotos: project.resultPhotos,
      costCents: project.costCents,
      nextAction: project.nextAction,
      nextActionDate: toIso(project.nextActionDate),
      notes: project.notes,
      worldId: project.worldId,
      pageId: project.pageId,
      metadata: project.metadata,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    })),
    workshopPaintRecipes: workshopPaintRecipes.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      targetType: recipe.targetType,
      primer: recipe.primer,
      basecoat: recipe.basecoat,
      wash: recipe.wash,
      highlights: recipe.highlights,
      colorsUsed: recipe.colorsUsed,
      resultPhotoUrl: recipe.resultPhotoUrl,
      rating: recipe.rating,
      notes: recipe.notes,
      workshopProjectId: recipe.workshopProjectId,
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
    })),
    workshopPrintProfiles: workshopPrintProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      printer: profile.printer,
      nozzle: profile.nozzle,
      filament: profile.filament,
      layerHeight: profile.layerHeight,
      supports: profile.supports,
      result: profile.result,
      errors: profile.errors,
      improvements: profile.improvements,
      notes: profile.notes,
      workshopProjectId: profile.workshopProjectId,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    })),
    workshopTerrainRentals: workshopTerrainRentals.map((rental) => ({
      id: rental.id,
      terrainSetName: rental.terrainSetName,
      boxLabel: rental.boxLabel,
      replacementValueCents: rental.replacementValueCents,
      rentalPriceCents: rental.rentalPriceCents,
      depositCents: rental.depositCents,
      status: rental.status,
      damages: rental.damages,
      handoverChecklist: rental.handoverChecklist,
      returnChecklist: rental.returnChecklist,
      notes: rental.notes,
      workshopProjectId: rental.workshopProjectId,
      createdAt: rental.createdAt.toISOString(),
      updatedAt: rental.updatedAt.toISOString(),
    })),
    contractExpenses: contractExpenses.map((expense) => ({
      id: expense.id,
      name: expense.name,
      vendor: expense.vendor,
      status: expense.status,
      expenseType: expense.expenseType,
      source: expense.source,
      billingInterval: expense.billingInterval,
      categoryLabel: expense.categoryLabel,
      amountCents: expense.amountCents,
      currency: expense.currency,
      billingDay: expense.billingDay,
      startDate: toIso(expense.startDate),
      nextPaymentDate: toIso(expense.nextPaymentDate),
      renewalDate: toIso(expense.renewalDate),
      cancelByDate: toIso(expense.cancelByDate),
      portalUrl: expense.portalUrl,
      notes: expense.notes,
      metadata: expense.metadata,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    })),
    hardwareDevices: hardwareDevices.map((device) => ({
      id: device.id,
      name: device.name,
      role: device.role,
      status: device.status,
      hostname: device.hostname,
      ipAddress: device.ipAddress,
      localUrl: device.localUrl,
      publicUrl: device.publicUrl,
      operatingSystem: device.operatingSystem,
      specs: device.specs,
      setupSteps: device.setupSteps,
      errorNotes: device.errorNotes,
      notes: device.notes,
      metadata: device.metadata,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    })),
    personalBrainDocuments: personalBrainDocuments.map((document) => ({
      id: document.id,
      title: document.title,
      content: document.content,
      category: document.category,
      tags: document.tags,
      metadata: document.metadata,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    })),
    personalBrainChunks: personalBrainChunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: chunk.embedding,
      createdAt: chunk.createdAt.toISOString(),
      updatedAt: chunk.updatedAt.toISOString(),
    })),
    personalBrainFacts: personalBrainFacts.map((fact) => ({
      id: fact.id,
      factType: fact.factType,
      title: fact.title,
      content: fact.content,
      tags: fact.tags,
      metadata: fact.metadata,
      createdAt: fact.createdAt.toISOString(),
      updatedAt: fact.updatedAt.toISOString(),
    })),
    adminEntityLinks: adminEntityLinks.map((link) => ({
      id: link.id,
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      targetType: link.targetType,
      targetId: link.targetId,
      relationType: link.relationType,
      label: link.label,
      createdAt: link.createdAt.toISOString(),
    })),
  };
}

async function resolveScopeIds(
  db: PrismaClient,
  scope: CollectScope,
): Promise<{ worldIds: string[]; campaignIds: string[] }> {
  if (scope.type === "full") {
    const worlds = await db.world.findMany({
      where: { isSandbox: false },
      select: { id: true },
    });
    const campaigns = await db.campaign.findMany({
      where: { world: { isSandbox: false } },
      select: { id: true },
    });
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
  if (world.isSandbox) {
    throw new Error(`Sandbox-Welt „${scope.worldSlug}" ist von Backups ausgeschlossen.`);
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

  let parentIds = [...pageIds];
  while (parentIds.length > 0) {
    const children = await loadInBatches(parentIds, (batch) =>
      db.page.findMany({
        where: {
          worldId: { in: worldIds },
          parentPageId: { in: batch },
        },
        select: { id: true },
      }),
    );
    const nextParentIds: string[] = [];
    for (const child of children) {
      if (!pageIds.has(child.id)) {
        pageIds.add(child.id);
        nextParentIds.push(child.id);
      }
    }
    parentIds = nextParentIds;
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
  brainDb: BrainPrismaClient,
  familyDb: FamilyPrismaClient,
  scope: CollectScope,
): Promise<{ data: BackupData; stats: BackupStats; settings?: BackupSettingsRecord }> {
  const { worldIds, campaignIds } = await resolveScopeIds(db, scope);
  const pageIds = await collectPageIds(db, scope, worldIds, campaignIds);
  const pageIdList = [...pageIds];

  const worlds = await db.world.findMany({
    where: { id: { in: worldIds } },
  });

  const campaigns =
    scope.type === "campaign"
      ? await db.campaign.findMany({ where: { id: { in: campaignIds } } })
      : await db.campaign.findMany({ where: { worldId: { in: worldIds } } });

  const pages = await loadInBatches(pageIdList, (batch) =>
    db.page.findMany({ where: { id: { in: batch } } }),
  );

  const contentBlocks = await loadInBatches(pageIdList, (batch) =>
    db.contentBlock.findMany({ where: { pageId: { in: batch } } }),
  );

  const pageLinks = (
    await loadInBatches(pageIdList, (batch) =>
      db.pageLink.findMany({ where: { sourcePageId: { in: batch } } }),
    )
  ).filter((link) => pageIds.has(link.targetPageId));

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

  const assetPageLinks = await loadInBatches(pageIdList, (batch) =>
    db.assetPageLink.findMany({
      where: { assetId: { in: assetIds }, pageId: { in: batch } },
    }),
  );

  const gameSessions =
    scope.type === "campaign"
      ? await db.gameSession.findMany({ where: { campaignId: { in: campaignIds } } })
      : await db.gameSession.findMany({ where: { worldId: { in: worldIds } } });

  const gameSessionIds = gameSessions.map((session) => session.id);

  const gameSessionPageLinks = await loadInBatches(pageIdList, (batch) =>
    db.gameSessionPageLink.findMany({
      where: { gameSessionId: { in: gameSessionIds }, pageId: { in: batch } },
    }),
  );
  const dungeons = await db.dungeon.findMany({ where: { worldId: { in: worldIds } } });
  const gameSessionFocuses = await db.gameSessionFocus.findMany({
    where: { gameSessionId: { in: gameSessionIds }, pageId: { in: pageIdList } },
  });
  const docImportSources = await db.docImportSource.findMany({ where: { worldId: { in: worldIds } } });
  const sourceIds = docImportSources.map((source) => source.id);
  const docImportPageBindings = await db.docImportPageBinding.findMany({
    where: { sourceId: { in: sourceIds }, pageId: { in: pageIdList } },
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

  const soundboardButtonPageLinks = await loadInBatches(pageIdList, (batch) =>
    db.soundboardButtonPageLink.findMany({
      where: { soundboardButtonId: { in: soundboardButtonIds }, pageId: { in: batch } },
    }),
  );

  const worldMemberships = await db.worldMembership.findMany({
    where: { worldId: { in: worldIds } },
  });



  const userIds = new Set<string>();
  for (const membership of worldMemberships) userIds.add(membership.userId);

  const users = await db.user.findMany({
    where: { id: { in: [...userIds] } },
    select: {
      id: true,
      displayName: true,
      email: true,
      isOwner: true,
      portalAccess: true,
      studioAccess: true,
      brainAccess: true,
      familyAccess: true,
    },
  });

  const pageTemplates =
    scope.type === "full"
      ? await db.pageTemplate.findMany({ where: { isSystem: false } })
      : [];

  /**
   * Terra-Karten (J1). Weltgebunden, deshalb in jedem Backup-Umfang dabei,
   * der Welten mitnimmt — kein Schalter, keine Bedingung. Der Vorgänger stand
   * hier nie, und genau deshalb war sein Löschen unumkehrbar.
   */
  const terraKarten = await db.terraKarte.findMany({
    where: { worldId: { in: worldIds } },
    orderBy: { createdAt: "asc" },
  });

  const playerNotes =
    scope.includePlayerNotes === true
      ? await db.playerNote.findMany({
          where: { worldId: { in: worldIds } },
        })
      : [];

  for (const note of playerNotes) {
    userIds.add(note.userId);
  }

  const usersWithNotes =
    playerNotes.length > 0
      ? await db.user.findMany({
          where: { id: { in: [...userIds] } },
          select: {
            id: true,
            displayName: true,
            email: true,
            isOwner: true,
            portalAccess: true,
            studioAccess: true,
            brainAccess: true,
            familyAccess: true,
          },
        })
      : [];

  const mergedUsers = new Map(users.map((user) => [user.id, user]));
  for (const user of usersWithNotes) {
    mergedUsers.set(user.id, user);
  }

  const dailyAdmin =
    scope.type === "full" ? await collectDailyAdminData(brainDb, familyDb) : undefined;

  const data: BackupData = sanitizeBackupData({
    dailyAdmin,
    worlds: worlds.map(
      (world): BackupWorldRecord => ({
        id: world.id,
        name: world.name,
        slug: world.slug,
        description: world.description,
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
        questStoryArcId: page.questStoryArcId,
        title: page.title,
        slug: page.slug,
        type: page.type,
        summary: page.summary,
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
        storyArcPageId: session.storyArcPageId,
        groupId: session.groupId,
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
        playerVisibleSchedule: session.playerVisibleSchedule,
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
    dungeons: dungeons.map((dungeon): BackupDungeonRecord => ({
      ...dungeon,
      prepStatus: dungeon.prepStatus,
      createdAt: dungeon.createdAt.toISOString(),
      updatedAt: dungeon.updatedAt.toISOString(),
    })),
    gameSessionFocuses: gameSessionFocuses.map((focus): BackupGameSessionFocusRecord => ({
      ...focus,
      createdAt: focus.createdAt.toISOString(),
    })),
    docImportSources: docImportSources.map((source): BackupDocImportSourceRecord => ({
      ...source,
      importedAt: source.importedAt.toISOString(),
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    })),
    docImportPageBindings: docImportPageBindings.map((binding): BackupDocImportPageBindingRecord => ({
      ...binding,
      createdAt: binding.createdAt.toISOString(),
      updatedAt: binding.updatedAt.toISOString(),
    })),
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
        characterName: membership.characterName,
        createdAt: membership.createdAt.toISOString(),
        updatedAt: membership.updatedAt.toISOString(),
      }),
    ),
    users: [...mergedUsers.values()].map(
      (user): BackupUserRecord => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        isOwner: user.isOwner,
        portalAccess: user.portalAccess,
        studioAccess: user.studioAccess,
        brainAccess: user.brainAccess,
        familyAccess: user.familyAccess,
      }),
    ),
    pageTemplates: pageTemplates.map(
      (template): BackupPageTemplateRecord => ({
        id: template.id,
        slug: template.slug,
        name: template.name,
        description: template.description,
        pageType: template.pageType,
        titlePlaceholder: template.titlePlaceholder,
        blocks: template.blocks,
        isSystem: template.isSystem,
        isActive: template.isActive,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      }),
    ),
    terraKarten: terraKarten.map(
      (karte): BackupTerraKarteRecord => ({
        id: karte.id,
        worldId: karte.worldId,
        titel: karte.titel,
        daten: karte.daten,
        version: karte.version,
        // Abnahmezustand und Autor (J5) reisen mit. Ohne sie käme ein noch
        // nicht abgenommener Entwurf nach dem Restore als fertige Weltkarte
        // zurück — der Vorgabewert der Spalte ist `freigegeben`.
        status: karte.status,
        autorUserId: karte.autorUserId,
        autorName: karte.autorName,
        eingereichtAm: karte.eingereichtAm?.toISOString() ?? null,
        entschiedenAm: karte.entschiedenAm?.toISOString() ?? null,
        entschiedenVonUserId: karte.entschiedenVonUserId,
        rueckmeldung: karte.rueckmeldung,
        createdAt: karte.createdAt.toISOString(),
        updatedAt: karte.updatedAt.toISOString(),
      }),
    ),
    playerNotes: playerNotes.map(
      (note): BackupPlayerNoteRecord => ({
        id: note.id,
        worldId: note.worldId,
        campaignId: note.campaignId,
        pageId: note.pageId,
        gameSessionId: note.gameSessionId,
        userId: note.userId,
        content: note.content,
        status: note.status,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      }),
    ),
  });

  let settings: BackupSettingsRecord | undefined;
  if (scope.type === "full") {
    const settingsService = createSettingsService(db);
    const systemSettings = await settingsService.getSettings();
    settings = sanitizeSettingsForBackup(
      systemSettings as unknown as Record<string, unknown>,
    );
  }

  return { data, stats: collectStats(data), settings };
}

export { collectStats };
