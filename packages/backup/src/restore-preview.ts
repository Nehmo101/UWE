import type { PrismaClient } from "@uwe/database/server";
import type { BackupBundle, RestorePreview, RestorePreviewItem } from "./types";

function pushItem(
  items: RestorePreviewItem[],
  entityType: string,
  identifier: string,
  status: RestorePreviewItem["status"],
  message?: string,
): void {
  items.push({ entityType, identifier, status, message });
}

export async function previewRestore(
  db: PrismaClient,
  bundle: BackupBundle,
  targetWorldSlug?: string,
): Promise<RestorePreview> {
  const items: RestorePreviewItem[] = [];
  const warnings: string[] = [];
  const missingAssets: string[] = [];

  for (const world of bundle.data.worlds) {
    const existing = await db.world.findUnique({ where: { slug: world.slug } });
    if (existing) {
      pushItem(
        items,
        "world",
        world.slug,
        targetWorldSlug && targetWorldSlug !== world.slug ? "conflict" : "duplicate",
        existing.id === world.id
          ? "Welt existiert bereits mit gleicher ID."
          : "Welt-Slug existiert bereits.",
      );
    } else {
      pushItem(items, "world", world.slug, "new");
    }
  }

  for (const campaign of bundle.data.campaigns) {
    const world = bundle.data.worlds.find((entry) => entry.id === campaign.worldId);
    const worldSlug = world?.slug ?? "unknown";
    const existingWorld = world
      ? await db.world.findUnique({ where: { slug: world.slug } })
      : null;
    const existingCampaign =
      existingWorld &&
      (await db.campaign.findFirst({
        where: { worldId: existingWorld.id, slug: campaign.slug },
      }));

    if (existingCampaign) {
      pushItem(items, "campaign", `${worldSlug}/${campaign.slug}`, "duplicate");
    } else {
      pushItem(items, "campaign", `${worldSlug}/${campaign.slug}`, "new");
    }
  }

  for (const page of bundle.data.pages) {
    const world = bundle.data.worlds.find((entry) => entry.id === page.worldId);
    const existingWorld = world
      ? await db.world.findUnique({ where: { slug: world.slug } })
      : null;
    const existingPage =
      existingWorld &&
      (await db.page.findFirst({
        where: { worldId: existingWorld.id, slug: page.slug },
      }));

    if (existingPage) {
      pushItem(items, "page", `${world?.slug ?? "?"}/${page.slug}`, "conflict");
    } else {
      pushItem(items, "page", `${world?.slug ?? "?"}/${page.slug}`, "new");
    }
  }

  for (const asset of bundle.data.assets) {
    const expectedPath = `assets/${asset.storageKey}`;
    if (!bundle.manifest.assetFiles.includes(expectedPath)) {
      missingAssets.push(asset.storageKey);
      pushItem(items, "asset", asset.storageKey, "warning", "Asset-Datei fehlt im Backup.");
    } else {
      pushItem(items, "asset", asset.storageKey, "new");
    }
  }

  if (bundle.manifest.includesAuthSessions) {
    warnings.push("Auth-Sessions werden beim Restore nicht importiert.");
  }

  warnings.push("Passwörter und API-Keys werden nicht aus Backups wiederhergestellt.");

  const conflicts = items.filter((item) => item.status === "conflict");
  const stats = {
    new: items.filter((item) => item.status === "new").length,
    conflict: conflicts.length,
    duplicate: items.filter((item) => item.status === "duplicate").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    warnings: items.filter((item) => item.status === "warning").length,
  };

  return {
    manifest: bundle.manifest,
    items,
    conflicts,
    stats,
    assetCount: bundle.data.assets.length,
    missingAssets,
    warnings,
  };
}

export async function countDatabaseRows(db: PrismaClient): Promise<Record<string, number>> {
  const [worlds, pages, assets] = await Promise.all([
    db.world.count(),
    db.page.count(),
    db.asset.count(),
  ]);

  return { worlds, pages, assets };
}
