import {
  assertCanEditContent,
  assertCanEditWorld,
  assertCanReadContent,
  assertCanReadWorld,
  assertCanUploadMedia,
  assertCanUseAI,
  type AIUsageContext,
  type AuthzScope,
  type ContentAuthTarget,
  type MediaUploadTarget,
  type WorldAuthTarget,
} from "@uwe/auth";
import { getAppRepository } from "@uwe/database/server";

export const STUDIO_TRUSTED_SCOPE: AuthzScope = { studioTrusted: true };

export function studioWorldTarget(
  world: Pick<WorldAuthTarget, "id"> & Partial<Pick<WorldAuthTarget, "guestModeEnabled">>,
): WorldAuthTarget {
  return {
    id: world.id,
    guestModeEnabled: world.guestModeEnabled ?? false,
    membership: null,
  };
}

export function assertStudioTrusted(): void {
  assertCanEditWorld(null, { id: "studio", guestModeEnabled: false, membership: null }, STUDIO_TRUSTED_SCOPE);
}

export function assertStudioCanReadWorld(world: WorldAuthTarget): void {
  assertCanReadWorld(null, world, STUDIO_TRUSTED_SCOPE);
}

export function assertStudioCanEditWorld(world: WorldAuthTarget): void {
  assertCanEditWorld(null, world, STUDIO_TRUSTED_SCOPE);
}

export function assertStudioCanReadContent(content: ContentAuthTarget, world: WorldAuthTarget): void {
  assertCanReadContent(null, content, world, STUDIO_TRUSTED_SCOPE);
}

export function assertStudioCanEditContent(content: ContentAuthTarget, world: WorldAuthTarget): void {
  assertCanEditContent(null, content, world, STUDIO_TRUSTED_SCOPE);
}

export function assertStudioCanUploadMedia(target: MediaUploadTarget): void {
  assertCanUploadMedia(null, target, STUDIO_TRUSTED_SCOPE);
}

export function assertStudioCanUseAI(context: AIUsageContext = {}): void {
  assertCanUseAI(null, context, STUDIO_TRUSTED_SCOPE);
}

export async function requireStudioWorldEdit(worldSlug: string): Promise<WorldAuthTarget> {
  assertStudioTrusted();
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error("Welt nicht gefunden");
  }
  const target = studioWorldTarget(world);
  assertStudioCanEditWorld(target);
  return target;
}

export async function requireStudioWorldRead(worldSlug: string): Promise<WorldAuthTarget> {
  assertStudioTrusted();
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error("Welt nicht gefunden");
  }
  const target = studioWorldTarget(world);
  assertStudioCanReadWorld(target);
  return target;
}

export async function requireStudioContentEdit(
  worldSlug: string,
  pageId: string,
): Promise<{ world: WorldAuthTarget; content: ContentAuthTarget }> {
  const repo = getAppRepository();
  const page = await repo.getPageById(pageId);
  if (!page) {
    throw new Error("Seite nicht gefunden");
  }

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world || page.worldId !== world.id) {
    throw new Error("Seite nicht gefunden");
  }

  const worldTarget = studioWorldTarget(world);
  const content: ContentAuthTarget = {
    id: page.id,
    visibility: page.visibility,
    type: page.type,
  };
  assertStudioCanEditContent(content, worldTarget);
  return { world: worldTarget, content };
}

export async function requireStudioAssetEdit(
  worldSlug: string,
  assetId: string,
): Promise<{ world: WorldAuthTarget; assetId: string }> {
  const repo = getAppRepository();
  const asset = await repo.getAssetById(assetId);
  if (!asset) {
    throw new Error("Asset nicht gefunden");
  }

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world || asset.worldId !== world.id) {
    throw new Error("Asset nicht gefunden");
  }

  const worldTarget = studioWorldTarget(world);
  assertStudioCanEditWorld(worldTarget);
  return { world: worldTarget, assetId };
}
