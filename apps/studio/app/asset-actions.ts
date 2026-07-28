"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createAssetAlbumService,
  createImageStudioService,
  getAppRepository,
  parseStringArray,
  prisma,
  proposeTagsForAssets,
  storeAssetTagProposals,
  toPrismaJsonValue,
  type AssetType,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudioAssetEdit, requireStudioContentEdit, requireStudioWorldEdit } from "@/src/lib/authz";

function repo() {
  return getAppRepository();
}

export async function linkAssetToPageAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const assetId = String(formData.get("assetId"));
  const pageId = String(formData.get("pageId"));

  await requireStudioAssetEdit(worldSlug, assetId);
  if (pageId) {
    await requireStudioContentEdit(worldSlug, pageId);
  }

  if (pageId) {
    await repo().linkAssetToPage(assetId, pageId);
  }

  revalidatePath(`/worlds/${worldSlug}/assets`);
  redirect(`/worlds/${worldSlug}/assets?linked=1`);
}

export async function updateAssetAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const assetId = String(formData.get("assetId"));

  await requireStudioAssetEdit(worldSlug, assetId);

  await repo().updateAsset(assetId, {
    title: String(formData.get("title")),
    description: String(formData.get("description") || "") || null,
    type: formData.get("type") as AssetType,
    tags: formData.has("tags")
      ? String(formData.get("tags") || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined,
  });

  revalidatePath(`/worlds/${worldSlug}/assets`);
  redirect(`/worlds/${worldSlug}/assets?saved=1`);
}

export async function createAssetAlbumAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!title) {
    throw new Error("Album-Titel ist erforderlich.");
  }

  await requireStudioWorldEdit(worldSlug);
  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("Welt nicht gefunden.");

  const albums = createAssetAlbumService(prisma);
  const album = await albums.createAlbum({ worldId: world.id, title, description });

  revalidatePath(`/worlds/${worldSlug}/assets`);
  redirect(`/worlds/${worldSlug}/assets?album=${album.id}`);
}

export async function addAssetsToAlbumAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const albumId = String(formData.get("albumId"));
  const assetIds = String(formData.get("assetIds") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  await requireStudioWorldEdit(worldSlug);
  for (const assetId of assetIds) {
    await requireStudioAssetEdit(worldSlug, assetId);
  }

  const albums = createAssetAlbumService(prisma);
  for (const assetId of assetIds) {
    await albums.addAsset(albumId, assetId);
  }

  revalidatePath(`/worlds/${worldSlug}/assets`);
  redirect(`/worlds/${worldSlug}/assets?album=${albumId}&saved=1`);
}

export async function proposeAssetTagsBatchAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const assetIds = String(formData.get("assetIds") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  await requireStudioWorldEdit(worldSlug);
  for (const assetId of assetIds) {
    await requireStudioAssetEdit(worldSlug, assetId);
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, title: true, description: true, type: true, tags: true },
  });
  const proposals = proposeTagsForAssets(assets);
  await storeAssetTagProposals(prisma, proposals);

  revalidatePath(`/worlds/${worldSlug}/assets`);
  redirect(`/worlds/${worldSlug}/assets?tagged=1`);
}

export async function applyAssetTagProposalAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const assetId = String(formData.get("assetId"));

  await requireStudioAssetEdit(worldSlug, assetId);
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { tags: true, metadata: true },
  });
  if (!asset) throw new Error("Asset nicht gefunden.");

  const metadata =
    asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata)
      ? (asset.metadata as Record<string, unknown>)
      : {};
  const proposal = metadata.aiTagProposal;
  const proposedTags =
    proposal &&
    typeof proposal === "object" &&
    !Array.isArray(proposal) &&
    Array.isArray((proposal as Record<string, unknown>).tags)
      ? ((proposal as Record<string, unknown>).tags as unknown[]).filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [];

  if (proposedTags.length === 0) {
    throw new Error("Keine Tag-Vorschläge vorhanden.");
  }

  const merged = [...new Set([...parseStringArray(asset.tags), ...proposedTags])];
  const { aiTagProposal: _removed, ...restMetadata } = metadata;

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      tags: merged,
      metadata: toPrismaJsonValue(restMetadata),
    },
  });

  revalidatePath(`/worlds/${worldSlug}/assets`);
  redirect(`/worlds/${worldSlug}/assets?saved=1`);
}

export async function openAssetInImageStudioAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const assetId = String(formData.get("assetId"));

  await requireStudioAssetEdit(worldSlug, assetId);
  const world = await repo().getWorldBySlug(worldSlug);
  const asset = await repo().getAssetById(assetId);
  if (!world || !asset) throw new Error("Asset oder Welt nicht gefunden.");

  const imageStudio = createImageStudioService(prisma);
  const project = await imageStudio.createProject({
    worldId: world.id,
    title: asset.title,
    prompt: asset.description,
    metadata: { sourceAssetId: assetId },
  });
  await imageStudio.linkProject(project.id, "asset", assetId);
  await imageStudio.addVersion({
    projectId: project.id,
    operation: "edit",
    prompt: asset.description,
    assetId,
    providerMode: "manual",
    metadata: { source: "asset_library" },
  });

  redirect(`/image-studio/${project.id}`);
}
