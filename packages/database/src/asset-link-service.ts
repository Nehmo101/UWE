import type { AdminLinkSourceType, Asset, Prisma } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { linkAssetToPage, listAssetsForPage } from "./asset-repository";

/** Unified asset link targets across world pages and daily-admin entities. */
export type AssetLinkTargetType =
  | "page"
  | "workshop_project"
  | "capture"
  | "hardware_device"
  | "contract_expense";

export const ASSET_LINK_TARGET_LABELS: Record<AssetLinkTargetType, string> = {
  page: "Seite",
  workshop_project: "Werkstatt-Projekt",
  capture: "Capture",
  hardware_device: "Hardware",
  contract_expense: "Vertrag/Ausgabe",
};

const ADMIN_SOURCE_TYPES = new Set<AssetLinkTargetType>([
  "workshop_project",
  "capture",
  "hardware_device",
  "contract_expense",
]);

function toAdminSourceType(targetType: AssetLinkTargetType): AdminLinkSourceType {
  return targetType as AdminLinkSourceType;
}

export interface AssetLinkRecord {
  assetId: string;
  targetType: AssetLinkTargetType;
  targetId: string;
  relationType: string;
  label: string | null;
  createdAt: Date;
}

export interface LinkAssetInput {
  assetId: string;
  targetType: AssetLinkTargetType;
  targetId: string;
  relationType?: string;
  label?: string | null;
}

export async function linkAssetToTarget(db: PrismaClient, input: LinkAssetInput) {
  if (input.targetType === "page") {
    await linkAssetToPage(db, input.assetId, input.targetId);
    return { assetId: input.assetId, targetType: input.targetType, targetId: input.targetId };
  }

  const existing = await db.adminEntityLink.findFirst({
    where: {
      sourceType: toAdminSourceType(input.targetType),
      sourceId: input.targetId,
      targetType: "asset",
      targetId: input.assetId,
    },
  });

  if (existing) {
    return existing;
  }

  return db.adminEntityLink.create({
    data: {
      sourceType: toAdminSourceType(input.targetType),
      sourceId: input.targetId,
      targetType: "asset",
      targetId: input.assetId,
      relationType: input.relationType ?? "media",
      label: input.label ?? undefined,
    },
  });
}

export async function unlinkAssetFromTarget(
  db: PrismaClient,
  assetId: string,
  targetType: AssetLinkTargetType,
  targetId: string,
) {
  if (targetType === "page") {
    return db.assetPageLink.deleteMany({ where: { assetId, pageId: targetId } });
  }

  return db.adminEntityLink.deleteMany({
    where: {
      sourceType: toAdminSourceType(targetType),
      sourceId: targetId,
      targetType: "asset",
      targetId: assetId,
    },
  });
}

export async function listAssetsForTarget(
  db: PrismaClient,
  targetType: AssetLinkTargetType,
  targetId: string,
): Promise<Asset[]> {
  if (targetType === "page") {
    return listAssetsForPage(db, targetId);
  }

  const links = await db.adminEntityLink.findMany({
    where: {
      sourceType: toAdminSourceType(targetType),
      sourceId: targetId,
      targetType: "asset",
    },
    orderBy: { createdAt: "desc" },
  });

  if (links.length === 0) return [];

  const assetIds = links.map((link) => link.targetId);
  return db.asset.findMany({
    where: { id: { in: assetIds } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listAssetLinksForAsset(db: PrismaClient, assetId: string): Promise<AssetLinkRecord[]> {
  const [pageLinks, adminLinks] = await Promise.all([
    db.assetPageLink.findMany({
      where: { assetId },
      orderBy: { createdAt: "desc" },
    }),
    db.adminEntityLink.findMany({
      where: { targetType: "asset", targetId: assetId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const records: AssetLinkRecord[] = [
    ...pageLinks.map((link) => ({
      assetId,
      targetType: "page" as const,
      targetId: link.pageId,
      relationType: "page_link",
      label: null,
      createdAt: link.createdAt,
    })),
    ...adminLinks
      .filter((link) => ADMIN_SOURCE_TYPES.has(link.sourceType as AssetLinkTargetType))
      .map((link) => ({
        assetId,
        targetType: link.sourceType as AssetLinkTargetType,
        targetId: link.sourceId,
        relationType: link.relationType,
        label: link.label,
        createdAt: link.createdAt,
      })),
  ];

  return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function adoptAssetToTarget(
  db: PrismaClient,
  input: LinkAssetInput & { contentBlockId?: string | null },
) {
  await linkAssetToTarget(db, input);

  if (input.targetType === "page" && input.contentBlockId) {
    await db.contentBlock.update({
      where: { id: input.contentBlockId },
      data: { assetId: input.assetId },
    });
  }

  if (input.targetType === "workshop_project") {
    const project = await db.workshopProject.findUnique({ where: { id: input.targetId } });
    if (project) {
      const gallery = Array.isArray(project.imageGallery) ? [...(project.imageGallery as string[])] : [];
      if (!gallery.includes(input.assetId)) {
        gallery.unshift(input.assetId);
        await db.workshopProject.update({
          where: { id: input.targetId },
          data: { imageGallery: gallery as Prisma.InputJsonValue },
        });
      }
    }
  }

  if (input.targetType === "capture") {
    await db.captureEntry.update({
      where: { id: input.targetId },
      data: { status: "linked" },
    });
  }

  return listAssetLinksForAsset(db, input.assetId);
}

export async function syncImageStudioProjectLinksToAsset(
  db: PrismaClient,
  projectId: string,
  assetId: string,
) {
  const project = await db.imageStudioProject.findUnique({
    where: { id: projectId },
    include: { links: true },
  });

  if (!project) return [];

  const results: AssetLinkRecord[] = [];

  for (const link of project.links) {
    if (link.targetType === "page" || link.targetType === "handout") {
      await linkAssetToTarget(db, {
        assetId,
        targetType: "page",
        targetId: link.targetId,
        relationType: "image_studio",
      });
    } else if (
      link.targetType === "workshop_project" ||
      link.targetType === "capture" ||
      link.targetType === "hardware_device" ||
      link.targetType === "contract_expense"
    ) {
      await linkAssetToTarget(db, {
        assetId,
        targetType: link.targetType,
        targetId: link.targetId,
        relationType: "image_studio",
      });
    } else if (link.targetType === "asset") {
      await db.asset.update({
        where: { id: assetId },
        data: {
          metadata: {
            derivedFromAssetId: link.targetId,
            source: "image_studio_variant",
          },
        },
      });
    }
    results.push({
      assetId,
      targetType:
        link.targetType === "handout"
          ? "page"
          : (link.targetType as AssetLinkTargetType),
      targetId: link.targetId,
      relationType: "image_studio",
      label: null,
      createdAt: new Date(),
    });
  }

  return results;
}
