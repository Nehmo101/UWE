import { generateSessionToken, hashPassword, verifyPassword } from "@uwe/auth";
import type { PrismaClient } from "./client";
import type { Asset, Page, ShareLink, ShareTargetType } from "./generated/prisma/client";
import { filterBlocksForContext, type ShareAccessGrant } from "./permissions";
import type { PageWithBlocks } from "./repository";

export type { ShareLink, ShareTargetType };

export interface CreateShareLinkInput {
  worldId: string;
  targetType: ShareTargetType;
  targetId: string;
  expiresAt?: Date | null;
  password?: string | null;
  readOnly?: boolean;
  logAccess?: boolean;
}

export interface UpdateShareLinkInput {
  expiresAt?: Date | null;
  password?: string | null;
  clearPassword?: boolean;
  readOnly?: boolean;
  logAccess?: boolean;
  enabled?: boolean;
}

export interface ShareLinkValidationResult {
  link: ShareLink;
  grant: ShareAccessGrant;
  target: ShareResolvedTarget;
}

export type ShareResolvedTarget =
  | { kind: "page"; page: PageWithBlocks; worldSlug: string }
  | { kind: "asset"; asset: Asset; worldSlug: string };

export interface ShareAccessMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function isShareLinkActive(link: Pick<ShareLink, "enabled" | "expiresAt">): boolean {
  if (!link.enabled) {
    return false;
  }

  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
    return false;
  }

  return true;
}

export function buildShareUrl(token: string, portalBaseUrl?: string): string {
  const base = (portalBaseUrl ?? process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3001").replace(
    /\/$/,
    "",
  );
  return `${base}/share/${token}`;
}

function addTargetToGrant(
  grant: ShareAccessGrant,
  targetType: ShareTargetType,
  targetId: string,
  pageType?: Page["type"] | null,
  assetType?: Asset["type"] | null,
): void {
  if (targetType === "page" || (targetType === "handout" && pageType === "handout")) {
    grant.sharedPageIds.add(targetId);
    return;
  }

  if (targetType === "asset" || (targetType === "handout" && assetType === "handout")) {
    grant.sharedAssetIds.add(targetId);
  }
}

export class ShareLinkService {
  constructor(private readonly db: PrismaClient) {}

  async validateTarget(worldId: string, targetType: ShareTargetType, targetId: string): Promise<void> {
    if (targetType === "page") {
      const page = await this.db.page.findFirst({ where: { id: targetId, worldId } });
      if (!page) {
        throw new Error("Seite nicht gefunden");
      }
      return;
    }

    if (targetType === "asset") {
      const asset = await this.db.asset.findFirst({ where: { id: targetId, worldId } });
      if (!asset) {
        throw new Error("Asset nicht gefunden");
      }
      return;
    }

    const page = await this.db.page.findFirst({ where: { id: targetId, worldId, type: "handout" } });
    if (page) {
      return;
    }

    const asset = await this.db.asset.findFirst({ where: { id: targetId, worldId, type: "handout" } });
    if (asset) {
      return;
    }

    throw new Error("Handout nicht gefunden");
  }

  async createShareLink(input: CreateShareLinkInput): Promise<ShareLink> {
    await this.validateTarget(input.worldId, input.targetType, input.targetId);

    return this.db.shareLink.create({
      data: {
        worldId: input.worldId,
        targetType: input.targetType,
        targetId: input.targetId,
        token: generateSessionToken(),
        expiresAt: input.expiresAt ?? null,
        passwordHash: input.password ? hashPassword(input.password) : null,
        readOnly: input.readOnly ?? true,
        logAccess: input.logAccess ?? false,
        enabled: true,
      },
    });
  }

  async listShareLinksForTarget(
    worldId: string,
    targetType: ShareTargetType,
    targetId: string,
  ): Promise<ShareLink[]> {
    return this.db.shareLink.findMany({
      where: { worldId, targetType, targetId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getShareLinkById(id: string): Promise<ShareLink | null> {
    return this.db.shareLink.findUnique({ where: { id } });
  }

  async getShareLinkByToken(token: string): Promise<ShareLink | null> {
    return this.db.shareLink.findUnique({ where: { token } });
  }

  async updateShareLink(id: string, input: UpdateShareLinkInput): Promise<ShareLink> {
    return this.db.shareLink.update({
      where: { id },
      data: {
        expiresAt: input.expiresAt,
        passwordHash: input.clearPassword
          ? null
          : input.password
            ? hashPassword(input.password)
            : undefined,
        readOnly: input.readOnly,
        logAccess: input.logAccess,
        enabled: input.enabled,
      },
    });
  }

  async disableShareLink(id: string): Promise<ShareLink> {
    return this.updateShareLink(id, { enabled: false });
  }

  /**
   * Builds the access grant for a single share link. A token only ever grants
   * access to its own target — never to other share links in the same world,
   * which may be password-protected or have different expiry dates.
   */
  async buildShareGrantForLink(
    link: Pick<ShareLink, "worldId" | "targetType" | "targetId">,
  ): Promise<ShareAccessGrant> {
    const grant: ShareAccessGrant = {
      sharedPageIds: new Set<string>(),
      sharedAssetIds: new Set<string>(),
    };

    const [page, asset] = await Promise.all([
      link.targetType === "page" || link.targetType === "handout"
        ? this.db.page.findFirst({
            where: { id: link.targetId, worldId: link.worldId },
            select: { id: true, type: true },
          })
        : Promise.resolve(null),
      link.targetType === "asset" || link.targetType === "handout"
        ? this.db.asset.findFirst({
            where: { id: link.targetId, worldId: link.worldId },
            select: { id: true, type: true },
          })
        : Promise.resolve(null),
    ]);

    addTargetToGrant(grant, link.targetType, link.targetId, page?.type, asset?.type);
    return grant;
  }

  async resolveShareTarget(link: ShareLink): Promise<ShareResolvedTarget | null> {
    const world = await this.db.world.findUnique({ where: { id: link.worldId } });
    if (!world) {
      return null;
    }

    if (link.targetType === "page") {
      const page = await this.db.page.findFirst({
        where: { id: link.targetId, worldId: link.worldId },
        include: {
          contentBlocks: { orderBy: { sortOrder: "asc" } },
          campaign: true,
        },
      });

      if (!page) {
        return null;
      }

      return { kind: "page", page, worldSlug: world.slug };
    }

    if (link.targetType === "asset") {
      const asset = await this.db.asset.findFirst({
        where: { id: link.targetId, worldId: link.worldId },
      });

      if (!asset) {
        return null;
      }

      return { kind: "asset", asset, worldSlug: world.slug };
    }

    const handoutPage = await this.db.page.findFirst({
      where: { id: link.targetId, worldId: link.worldId, type: "handout" },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
        campaign: true,
      },
    });

    if (handoutPage) {
      return { kind: "page", page: handoutPage, worldSlug: world.slug };
    }

    const handoutAsset = await this.db.asset.findFirst({
      where: { id: link.targetId, worldId: link.worldId, type: "handout" },
    });

    if (handoutAsset) {
      return { kind: "asset", asset: handoutAsset, worldSlug: world.slug };
    }

    return null;
  }

  verifySharePassword(link: ShareLink, password: string | null | undefined): boolean {
    if (!link.passwordHash) {
      return true;
    }

    if (!password) {
      return false;
    }

    return verifyPassword(password, link.passwordHash);
  }

  async validateShareAccess(
    token: string,
    options?: {
      password?: string | null;
      passwordVerified?: boolean;
      meta?: ShareAccessMeta;
    },
  ): Promise<ShareLinkValidationResult | null> {
    const link = await this.getShareLinkByToken(token);
    if (!link || !isShareLinkActive(link)) {
      return null;
    }

    if (link.passwordHash) {
      if (options?.passwordVerified) {
        // Cookie-based auth already verified
      } else if (!this.verifySharePassword(link, options?.password)) {
        return null;
      }
    }

    const target = await this.resolveShareTarget(link);
    if (!target) {
      return null;
    }

    const grant = await this.buildShareGrantForLink(link);

    if (target.kind === "page" && !grant.sharedPageIds.has(target.page.id)) {
      return null;
    }

    if (target.kind === "asset" && !grant.sharedAssetIds.has(target.asset.id)) {
      return null;
    }

    if (link.logAccess) {
      await this.db.shareAccessLog.create({
        data: {
          shareLinkId: link.id,
          ipAddress: options?.meta?.ipAddress ?? null,
          userAgent: options?.meta?.userAgent ?? null,
        },
      });
    }

    return { link, grant, target };
  }

  filterPageForShare(page: PageWithBlocks, grant: ShareAccessGrant): PageWithBlocks | null {
    if (!grant.sharedPageIds.has(page.id)) {
      return null;
    }

    return {
      ...page,
      contentBlocks: filterBlocksForContext(page.contentBlocks, "share", {
        shareGrant: grant,
        pageId: page.id,
      }),
    };
  }

  canAccessAssetViaShare(assetId: string, grant: ShareAccessGrant): boolean {
    return grant.sharedAssetIds.has(assetId);
  }
}

export function createShareLinkService(db: PrismaClient): ShareLinkService {
  return new ShareLinkService(db);
}
