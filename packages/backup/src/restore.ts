import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@uwe/database/server";
import type { BrainPrismaClient } from "@uwe/database/brain-client";
import { createSettingsService, pickUniqueSlug } from "@uwe/database/server";
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

export async function executeRestore(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
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
    usersNeedingPassword: [],
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
        const slug = pickUniqueSlug(world.slug, takenWorldSlugs);
        takenWorldSlugs.add(slug);
        await db.world.create({
          data: {
            id: remapId(idMap, world.id),
            name: world.name,
            slug,
            description: world.description,
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
        const slug = pickUniqueSlug(page.slug, takenSlugs);
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

  for (const user of bundle.data.users ?? []) {
    const existing = user.email
      ? await db.user.findUnique({ where: { email: user.email } })
      : await db.user.findUnique({ where: { id: user.id } });

    if (existing) {
      idMap.set(user.id, existing.id);
      result.skipped++;
      result.items.push({
        entityType: "user",
        identifier: user.email ?? user.displayName,
        status: "skipped",
      });
      continue;
    }

    await db.user.create({
      data: {
        id: remapId(idMap, user.id),
        displayName: user.displayName,
        email: user.email ?? null,
        isOwner: user.isOwner === true,
        portalAccess: user.portalAccess === true,
        studioAccess: user.studioAccess === true,
        brainAccess: user.brainAccess === true,
        familyAccess: user.familyAccess === true,
        forcePasswordChange: true,
      },
    });
    if (user.email) {
      result.usersNeedingPassword.push(user.email);
    }
    result.created++;
    result.items.push({
      entityType: "user",
      identifier: user.email ?? user.displayName,
      status: "created",
    });
  }

  for (const membership of bundle.data.worldMemberships ?? []) {
    const userId = idMap.get(membership.userId);
    const worldId = idMap.get(membership.worldId);
    if (!userId || !worldId) continue;

    const existing = await db.worldMembership.findFirst({
      where: { userId, worldId },
    });

    if (existing) {
      idMap.set(membership.id, existing.id);
      result.skipped++;
      result.items.push({
        entityType: "worldMembership",
        identifier: `${membership.userId}:${membership.worldId}`,
        status: "skipped",
      });
      continue;
    }

    await db.worldMembership.create({
      data: {
        id: remapId(idMap, membership.id),
        userId,
        worldId,
        characterName: membership.characterName ?? null,
      },
    });
    result.created++;
    result.items.push({
      entityType: "worldMembership",
      identifier: `${userId}:${worldId}`,
      status: "created",
    });
  }



  for (const template of bundle.data.pageTemplates ?? []) {
    if (template.isSystem) continue;

    const existing = await db.pageTemplate.findUnique({ where: { slug: template.slug } });
    if (existing) {
      result.skipped++;
      result.items.push({
        entityType: "pageTemplate",
        identifier: template.slug,
        status: "skipped",
      });
      continue;
    }

    await db.pageTemplate.create({
      data: {
        id: remapId(idMap, template.id),
        slug: template.slug,
        name: template.name,
        description: template.description,
        pageType: template.pageType as never,
        titlePlaceholder: template.titlePlaceholder,
        blocks: template.blocks as never,
        isSystem: false,
        isActive: template.isActive,
      },
    });
    result.created++;
    result.items.push({
      entityType: "pageTemplate",
      identifier: template.slug,
      status: "created",
    });
  }

  for (const note of bundle.data.playerNotes ?? []) {
    const worldId = idMap.get(note.worldId);
    const campaignId = idMap.get(note.campaignId);
    const userId = idMap.get(note.userId);
    if (!worldId || !campaignId || !userId) continue;

    const pageId = note.pageId ? idMap.get(note.pageId) ?? null : null;
    const gameSessionId = note.gameSessionId ? idMap.get(note.gameSessionId) ?? null : null;

    await db.playerNote.create({
      data: {
        id: remapId(idMap, note.id),
        worldId,
        campaignId,
        pageId,
        gameSessionId,
        userId,
        content: note.content,
        status: note.status as never,
      },
    });
    result.created++;
  }

  // Daily Admin OS section is optional — archives created before it existed restore unchanged.
  const dailyAdmin = bundle.data.dailyAdmin;
  if (dailyAdmin) {
    const remapOptional = (oldId: string | null): string | null =>
      oldId ? idMap.get(oldId) ?? null : null;

    for (const entry of dailyAdmin.captureEntries ?? []) {
      const existing = await brainDb.captureEntry.findUnique({ where: { id: entry.id } });
      if (existing) continue;

      await brainDb.captureEntry.create({
        data: {
          id: remapId(idMap, entry.id),
          title: entry.title,
          content: entry.content,
          captureType: entry.captureType as never,
          status: entry.status as never,
          url: entry.url,
          storageKey: entry.storageKey,
          worldId: remapOptional(entry.worldId),
          pageId: remapOptional(entry.pageId),
          metadata: entry.metadata as never,
          capturedAt: new Date(entry.capturedAt),
          triagedAt: entry.triagedAt ? new Date(entry.triagedAt) : null,
        },
      });
      result.created++;
    }

    for (const project of dailyAdmin.personalProjects ?? []) {
      const existing = await brainDb.personalProject.findUnique({ where: { id: project.id } });
      if (existing) continue;

      await brainDb.personalProject.create({
        data: {
          id: remapId(idMap, project.id),
          name: project.name,
          description: project.description,
          status: project.status as never,
          category: project.category as never,
          nextAction: project.nextAction,
          nextActionDate: project.nextActionDate ? new Date(project.nextActionDate) : null,
          notes: project.notes,
          links: project.links as never,
          costCents: project.costCents,
          worldId: remapOptional(project.worldId),
          pageId: remapOptional(project.pageId),
          metadata: project.metadata as never,
        },
      });
      result.created++;
    }

    for (const project of dailyAdmin.workshopProjects ?? []) {
      const existing = await brainDb.workshopProject.findUnique({ where: { id: project.id } });
      if (existing) {
        idMap.set(project.id, existing.id);
        continue;
      }

      await brainDb.workshopProject.create({
        data: {
          id: remapId(idMap, project.id),
          title: project.title,
          projectType: project.projectType as never,
          status: project.status as never,
          description: project.description,
          materialsNeeded: project.materialsNeeded as never,
          materialsUsed: project.materialsUsed as never,
          colorsUsed: project.colorsUsed as never,
          filamentsUsed: project.filamentsUsed as never,
          stlLinks: project.stlLinks as never,
          imageGallery: project.imageGallery as never,
          referenceImages: project.referenceImages as never,
          progressPhotos: project.progressPhotos as never,
          resultPhotos: project.resultPhotos as never,
          costCents: project.costCents,
          nextAction: project.nextAction,
          nextActionDate: project.nextActionDate ? new Date(project.nextActionDate) : null,
          notes: project.notes,
          worldId: remapOptional(project.worldId),
          pageId: remapOptional(project.pageId),
          metadata: project.metadata as never,
        },
      });
      result.created++;
    }

    for (const recipe of dailyAdmin.workshopPaintRecipes ?? []) {
      const existing = await brainDb.workshopPaintRecipe.findUnique({ where: { id: recipe.id } });
      if (existing) continue;

      await brainDb.workshopPaintRecipe.create({
        data: {
          id: remapId(idMap, recipe.id),
          name: recipe.name,
          targetType: recipe.targetType as never,
          primer: recipe.primer,
          basecoat: recipe.basecoat,
          wash: recipe.wash,
          highlights: recipe.highlights,
          colorsUsed: recipe.colorsUsed as never,
          resultPhotoUrl: recipe.resultPhotoUrl,
          rating: recipe.rating,
          notes: recipe.notes,
          workshopProjectId: remapOptional(recipe.workshopProjectId),
        },
      });
      result.created++;
    }

    for (const profile of dailyAdmin.workshopPrintProfiles ?? []) {
      const existing = await brainDb.workshopPrintProfile.findUnique({ where: { id: profile.id } });
      if (existing) continue;

      await brainDb.workshopPrintProfile.create({
        data: {
          id: remapId(idMap, profile.id),
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
          workshopProjectId: remapOptional(profile.workshopProjectId),
        },
      });
      result.created++;
    }

    for (const rental of dailyAdmin.workshopTerrainRentals ?? []) {
      const existing = await brainDb.workshopTerrainRental.findUnique({ where: { id: rental.id } });
      if (existing) continue;

      await brainDb.workshopTerrainRental.create({
        data: {
          id: remapId(idMap, rental.id),
          terrainSetName: rental.terrainSetName,
          boxLabel: rental.boxLabel,
          replacementValueCents: rental.replacementValueCents,
          rentalPriceCents: rental.rentalPriceCents,
          depositCents: rental.depositCents,
          status: rental.status as never,
          damages: rental.damages,
          handoverChecklist: rental.handoverChecklist as never,
          returnChecklist: rental.returnChecklist as never,
          notes: rental.notes,
          workshopProjectId: remapOptional(rental.workshopProjectId),
        },
      });
      result.created++;
    }

    for (const expense of dailyAdmin.contractExpenses ?? []) {
      const existing = await brainDb.contractExpense.findUnique({ where: { id: expense.id } });
      if (existing) continue;

      await brainDb.contractExpense.create({
        data: {
          id: remapId(idMap, expense.id),
          name: expense.name,
          vendor: expense.vendor,
          status: expense.status as never,
          expenseType: expense.expenseType as never,
          source: expense.source as never,
          billingInterval: expense.billingInterval as never,
          categoryLabel: expense.categoryLabel,
          amountCents: expense.amountCents,
          currency: expense.currency,
          billingDay: expense.billingDay,
          startDate: expense.startDate ? new Date(expense.startDate) : null,
          nextPaymentDate: expense.nextPaymentDate ? new Date(expense.nextPaymentDate) : null,
          renewalDate: expense.renewalDate ? new Date(expense.renewalDate) : null,
          cancelByDate: expense.cancelByDate ? new Date(expense.cancelByDate) : null,
          portalUrl: expense.portalUrl,
          notes: expense.notes,
          metadata: expense.metadata as never,
        },
      });
      result.created++;
    }

    for (const device of dailyAdmin.hardwareDevices ?? []) {
      const existing = await brainDb.hardwareDevice.findUnique({ where: { id: device.id } });
      if (existing) continue;

      await brainDb.hardwareDevice.create({
        data: {
          id: remapId(idMap, device.id),
          name: device.name,
          role: device.role,
          status: device.status as never,
          hostname: device.hostname,
          ipAddress: device.ipAddress,
          localUrl: device.localUrl,
          publicUrl: device.publicUrl,
          operatingSystem: device.operatingSystem,
          specs: device.specs as never,
          setupSteps: device.setupSteps as never,
          errorNotes: device.errorNotes,
          notes: device.notes,
          metadata: device.metadata as never,
        },
      });
      result.created++;
    }

    for (const document of dailyAdmin.personalBrainDocuments ?? []) {
      const existing = await brainDb.personalBrainDocument.findUnique({
        where: { id: document.id },
      });
      if (existing) {
        idMap.set(document.id, existing.id);
        continue;
      }

      await brainDb.personalBrainDocument.create({
        data: {
          id: remapId(idMap, document.id),
          title: document.title,
          content: document.content,
          category: document.category,
          tags: document.tags as never,
          metadata: document.metadata as never,
        },
      });
      result.created++;
    }

    for (const chunk of dailyAdmin.personalBrainChunks ?? []) {
      const documentId = idMap.get(chunk.documentId);
      if (!documentId) continue;

      const existing = await brainDb.personalBrainChunk.findUnique({ where: { id: chunk.id } });
      if (existing) continue;

      await brainDb.personalBrainChunk.create({
        data: {
          id: remapId(idMap, chunk.id),
          documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embedding: chunk.embedding as never,
        },
      });
      result.created++;
    }

    for (const fact of dailyAdmin.personalBrainFacts ?? []) {
      const existing = await brainDb.personalBrainFact.findUnique({ where: { id: fact.id } });
      if (existing) continue;

      await brainDb.personalBrainFact.create({
        data: {
          id: remapId(idMap, fact.id),
          factType: fact.factType,
          title: fact.title,
          content: fact.content,
          tags: fact.tags as never,
          metadata: fact.metadata as never,
        },
      });
      result.created++;
    }

    for (const link of dailyAdmin.adminEntityLinks ?? []) {
      const sourceId = idMap.get(link.sourceId);
      const targetId = idMap.get(link.targetId);
      if (!sourceId || !targetId) continue;

      await brainDb.adminEntityLink.create({
        data: {
          id: remapId(idMap, link.id),
          sourceType: link.sourceType as never,
          sourceId,
          targetType: link.targetType as never,
          targetId,
          relationType: link.relationType,
          label: link.label,
        },
      });
      result.created++;
    }
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

  if (
    options.sendPasswordSetupEmails &&
    options.passwordResetRequestUrl &&
    result.usersNeedingPassword.length > 0
  ) {
    const { requestPasswordReset } = await import("@uwe/database/server");
    const headers = new Headers({ "x-forwarded-for": "127.0.0.1" });

    for (const email of result.usersNeedingPassword) {
      try {
        await requestPasswordReset({
          db,
          email,
          request: { headers, url: options.passwordResetRequestUrl },
          surface: "studio",
        });
      } catch (error) {
        result.errors.push(
          `Passwort-Setup-Mail für ${email} fehlgeschlagen: ${
            error instanceof Error ? error.message : "unbekannt"
          }`,
        );
      }
    }
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
