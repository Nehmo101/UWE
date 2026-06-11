import type { PrismaClient } from "./client";
import type { AccessContext, AuthUser, PreviewOptions } from "@uwe/auth";
import {
  buildAccessContext,
  canViewAsset,
  canViewContentBlock,
  canViewPage,
  filterAssetsForViewer,
  filterBlocksForViewer,
  filterPagesForViewer,
  generateSessionToken,
  hashPassword,
  sessionExpiresAt,
  verifyPassword,
} from "@uwe/auth";
import type { PageWithBlocks } from "./repository";
import { searchForAuthContext, type SearchOptions, type SearchResultItem } from "./search-service";
import {
  GameSessionService,
  toDmGameSessionView,
  toPortalGameSessionView,
  type DmGameSessionView,
  type PortalGameSessionView,
} from "./game-session";

export interface CreateUserInput {
  displayName: string;
  email?: string | null;
  password?: string | null;
  role?: "owner" | "dm" | "player" | "guest";
}

export interface CreateWorldMembershipInput {
  userId: string;
  worldId: string;
  role: "owner" | "dm" | "player";
  characterName?: string | null;
}

export class AuthService {
  private readonly gameSessions: GameSessionService;

  constructor(private readonly db: PrismaClient) {
    this.gameSessions = new GameSessionService(db);
  }

  async createUser(input: CreateUserInput) {
    return this.db.user.create({
      data: {
        displayName: input.displayName,
        email: input.email ?? null,
        passwordHash: input.password ? hashPassword(input.password) : null,
        role: input.role ?? "player",
      },
    });
  }

  async findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async findUserById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  async createWorldMembership(input: CreateWorldMembershipInput) {
    return this.db.worldMembership.create({
      data: {
        userId: input.userId,
        worldId: input.worldId,
        role: input.role,
        characterName: input.characterName ?? null,
      },
    });
  }

  async grantPagePlayerAccess(pageId: string, userId: string) {
    return this.db.pagePlayerAccess.upsert({
      where: {
        pageId_userId: { pageId, userId },
      },
      create: { pageId, userId },
      update: {},
    });
  }

  async unlockPageForUser(pageId: string, userId: string, sessionLabel?: string | null) {
    return this.db.sessionUnlock.upsert({
      where: {
        pageId_userId: { pageId, userId },
      },
      create: {
        pageId,
        userId,
        sessionLabel: sessionLabel ?? null,
      },
      update: {
        unlockedAt: new Date(),
        sessionLabel: sessionLabel ?? null,
      },
    });
  }

  async authenticate(email: string, password: string) {
    const user = await this.findUserByEmail(email);
    if (!user?.passwordHash) {
      return null;
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return null;
    }

    return user;
  }

  async createSession(userId: string) {
    const token = generateSessionToken();
    const session = await this.db.session.create({
      data: {
        userId,
        token,
        expiresAt: sessionExpiresAt(),
      },
      include: { user: true },
    });

    return session;
  }

  async getSessionByToken(token: string) {
    const session = await this.db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt <= new Date()) {
      await this.db.session.delete({ where: { id: session.id } });
      return null;
    }

    return session;
  }

  async deleteSession(token: string) {
    await this.db.session.deleteMany({ where: { token } });
  }

  toAuthUser(user: {
    id: string;
    displayName: string;
    email: string | null;
    role: "owner" | "dm" | "player" | "guest";
  }): AuthUser {
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    };
  }

  async buildAccessContextForWorld(
    worldSlug: string,
    options: {
      userId?: string | null;
      preview?: PreviewOptions;
    } = {},
  ): Promise<AccessContext | null> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: {
        id: true,
        guestModeEnabled: true,
      },
    });

    if (!world) {
      return null;
    }

    const user = options.userId
      ? await this.db.user.findUnique({ where: { id: options.userId } })
      : null;

    const membership = user
      ? await this.db.worldMembership.findUnique({
          where: {
            userId_worldId: {
              userId: user.id,
              worldId: world.id,
            },
          },
        })
      : null;

    const effectiveUserId = options.preview?.previewAsUserId ?? user?.id ?? null;

    const [unlocks, specificAccess] = effectiveUserId
      ? await Promise.all([
          this.db.sessionUnlock.findMany({
            where: { userId: effectiveUserId, page: { worldId: world.id } },
            select: { pageId: true },
          }),
          this.db.pagePlayerAccess.findMany({
            where: { userId: effectiveUserId, page: { worldId: world.id } },
            select: { pageId: true },
          }),
        ])
      : [[], []];

    return buildAccessContext({
      user: user ? this.toAuthUser(user) : null,
      worldMembership: membership
        ? {
            userId: membership.userId,
            worldId: membership.worldId,
            role: membership.role,
            characterName: membership.characterName,
          }
        : null,
      guestModeEnabled: world.guestModeEnabled,
      unlockedPageIds: unlocks.map((entry) => entry.pageId),
      specificPlayerPageIds: specificAccess.map((entry) => entry.pageId),
      preview: options.preview,
    });
  }

  async getPageForViewer(
    worldSlug: string,
    pageSlug: string,
    ctx: AccessContext,
  ): Promise<PageWithBlocks | null> {
    const page = await this.db.page.findFirst({
      where: {
        slug: pageSlug,
        world: { slug: worldSlug },
      },
      include: {
        contentBlocks: {
          orderBy: { sortOrder: "asc" },
        },
        campaign: true,
      },
    });

    if (!page || !canViewPage(ctx, page)) {
      return null;
    }

    return {
      ...page,
      contentBlocks: filterBlocksForViewer(ctx, page.contentBlocks, page),
    };
  }

  async listPagesForViewer(worldSlug: string, ctx: AccessContext) {
    const pages = await this.db.page.findMany({
      where: {
        world: { slug: worldSlug },
      },
      orderBy: [{ title: "asc" }],
    });

    return filterPagesForViewer(ctx, pages);
  }

  async searchForViewer(
    worldSlug: string,
    ctx: AccessContext,
    options: SearchOptions,
  ): Promise<SearchResultItem[]> {
    return searchForAuthContext(this.db, ctx, {
      ...options,
      worldSlug,
      urlMode: options.urlMode ?? "auth-portal",
    });
  }

  async setWorldGuestMode(worldId: string, enabled: boolean) {
    return this.db.world.update({
      where: { id: worldId },
      data: { guestModeEnabled: enabled },
    });
  }

  async listGameSessionsForViewer(worldSlug: string, ctx: AccessContext): Promise<PortalGameSessionView[]> {
    const isDm = ctx.effectiveRole === "owner" || ctx.effectiveRole === "dm";

    if (isDm) {
      const sessions = await this.gameSessions.listByWorld(worldSlug);
      return sessions
        .filter((session) => session.recapPublished)
        .map(toPortalGameSessionView);
    }

    if (ctx.effectiveRole !== "player") {
      return [];
    }

    const sessions = await this.gameSessions.listPublishedForPortal(worldSlug);
    return sessions.map(toPortalGameSessionView);
  }

  async getGameSessionForViewer(
    worldSlug: string,
    sessionId: string,
    ctx: AccessContext,
  ): Promise<PortalGameSessionView | null> {
    const session = await this.gameSessions.getByIdForWorld(worldSlug, sessionId);
    if (!session) {
      return null;
    }

    const isDm = ctx.effectiveRole === "owner" || ctx.effectiveRole === "dm";
    if (!session.recapPublished && !isDm) {
      return null;
    }

    // Portal never exposes DM-only fields — even for DMs viewing the portal.
    return toPortalGameSessionView(session);
  }

  async listGameSessionsForDm(worldSlug: string, campaignId?: string | null): Promise<DmGameSessionView[]> {
    const sessions = await this.gameSessions.listByWorld(worldSlug, { campaignId });
    return sessions.map(toDmGameSessionView);
  }

  async getGameSessionForDm(worldSlug: string, sessionId: string): Promise<DmGameSessionView | null> {
    const loaded = await this.gameSessions.getByIdForWorld(worldSlug, sessionId);
    return loaded ? toDmGameSessionView(loaded) : null;
  }

  async listWorldPlayers(worldSlug: string) {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });

    if (!world) {
      return [];
    }

    return this.db.worldMembership.findMany({
      where: {
        worldId: world.id,
        role: "player",
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ user: { displayName: "asc" } }],
    });
  }

  async listAssetsForViewer(worldSlug: string, ctx: AccessContext, options?: { type?: string }) {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    const assets = await this.db.asset.findMany({
      where: {
        worldId: world.id,
        ...(options?.type ? { type: options.type as import("./generated/prisma/client").AssetType } : {}),
      },
      include: {
        pageLinks: { select: { pageId: true } },
      },
      orderBy: [{ title: "asc" }],
    });

    const withLinks = assets.map((asset) => ({
      ...asset,
      linkedPageIds: asset.pageLinks.map((link) => link.pageId),
    }));

    return filterAssetsForViewer(ctx, withLinks);
  }

  async getAssetForViewer(worldSlug: string, assetId: string, ctx: AccessContext) {
    const asset = await this.db.asset.findFirst({
      where: {
        id: assetId,
        world: { slug: worldSlug },
      },
      include: {
        pageLinks: { select: { pageId: true } },
      },
    });

    if (!asset) return null;

    const accessInfo = {
      id: asset.id,
      visibility: asset.visibility,
      linkedPageIds: asset.pageLinks.map((link) => link.pageId),
    };

    if (!canViewAsset(ctx, accessInfo)) {
      return null;
    }

    return asset;
  }
}

export function createAuthService(db: PrismaClient): AuthService {
  return new AuthService(db);
}

export {
  canViewAsset,
  canViewContentBlock,
  canViewPage,
  filterAssetsForViewer,
  filterBlocksForViewer,
  filterPagesForViewer,
};
