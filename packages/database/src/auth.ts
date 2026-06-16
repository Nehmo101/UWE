import type { PrismaClient } from "./client";
import type { AccessContext, AuthUser, PreviewOptions } from "@uwe/auth";
import {
  buildAccessContext,
  canCreatePlayerNote,
  canEditPlayerNote,
  canModeratePlayerNote,
  canReadAsset,
  canReadContent,
  canViewAsset,
  canViewContentBlock,
  canViewPage,
  canViewPlayerNote,
  filterAssetsForViewer,
  filterBlocksForViewer,
  filterPagesForViewer,
  filterPlayerNotesForViewer,
  scopeFromAccessContext,
  sessionExpiresAt,
} from "@uwe/auth";
import { generateSessionToken, hashPassword, verifyPassword } from "@uwe/auth/server";
import type { PageWithBlocks } from "./repository";
import {
  normalizeLookupKey,
  parseWikiLinks,
  renderContentHtml,
  type PageViewLink,
} from "./page-service";
import { parseStringArray } from "./json-utils";
import { searchForAuthContext, type SearchOptions, type SearchResultItem } from "./search-service";
import { SettingsService, isGuestPortalAccessAllowed } from "./settings-service";
import {
  GameSessionService,
  toDmGameSessionView,
  toPortalGameSessionView,
  type DmGameSessionView,
  type PortalGameSessionView,
} from "./game-session";
import {
  SoundboardService,
  isSoundboardButtonVisibleInPortal,
  toDmSoundboardButtonView,
  toPortalSoundboardButtonView,
  type DmSoundboardButtonView,
  type PortalSoundboardButtonView,
} from "./soundboard";
import {
  PlayerNoteService,
  toDmPlayerNoteView,
  toPortalPlayerNoteView,
  type DmPlayerNoteView,
  type PortalPlayerNoteView,
} from "./player-note-service";
import { logAuditEvent } from "./audit-log-service";

export interface CreateUserInput {
  displayName: string;
  email?: string | null;
  password?: string | null;
  role?: "owner" | "admin" | "dm" | "player" | "readonly" | "guest";
}

export interface CreateWorldMembershipInput {
  userId: string;
  worldId: string;
  role: "owner" | "dm" | "player";
  characterName?: string | null;
}

export class AuthService {
  private readonly gameSessions: GameSessionService;
  private readonly soundboard: SoundboardService;
  private readonly playerNotes: PlayerNoteService;

  constructor(private readonly db: PrismaClient) {
    this.gameSessions = new GameSessionService(db);
    this.soundboard = new SoundboardService(db);
    this.playerNotes = new PlayerNoteService(db);
  }

  async createUser(input: CreateUserInput) {
    const existingOwnerCount =
      input.role === "owner"
        ? await this.db.user.count({ where: { role: "owner" } })
        : 0;

    const user = await this.db.user.create({
      data: {
        displayName: input.displayName,
        email: input.email ?? null,
        passwordHash: input.password ? hashPassword(input.password) : null,
        role: input.role ?? "player",
      },
    });

    await logAuditEvent(this.db, {
      action: "user_created",
      targetType: "user",
      targetId: user.id,
      metadata: {
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
    });

    if (input.role === "owner" && existingOwnerCount === 0) {
      await logAuditEvent(this.db, {
        action: "setup_owner_created",
        targetType: "user",
        targetId: user.id,
        metadata: {
          displayName: user.displayName,
          email: user.email,
        },
      });
    }

    return user;
  }

  async findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async findUserById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  async hasOwnerUser(): Promise<boolean> {
    const owner = await this.db.user.findFirst({
      where: { role: "owner" },
      select: { id: true },
    });
    return owner !== null;
  }

  async isSetupAvailable(): Promise<boolean> {
    return !(await this.hasOwnerUser());
  }

  async createOwnerViaSetup(input: {
    displayName: string;
    email: string;
    password: string;
  }) {
    if (!(await this.isSetupAvailable())) {
      throw new Error("SETUP_DISABLED");
    }

    return this.createUser({
      displayName: input.displayName,
      email: input.email,
      password: input.password,
      role: "owner",
    });
  }

  async createWorldMembership(input: CreateWorldMembershipInput) {
    const existingOwnerMembership =
      input.role === "owner"
        ? await this.db.worldMembership.count({ where: { role: "owner" } })
        : 0;

    const membership = await this.db.worldMembership.create({
      data: {
        userId: input.userId,
        worldId: input.worldId,
        role: input.role,
        characterName: input.characterName ?? null,
      },
    });

    if (input.role === "owner" && existingOwnerMembership === 0) {
      await logAuditEvent(this.db, {
        action: "setup_owner_created",
        targetType: "user",
        targetId: input.userId,
        worldId: input.worldId,
        metadata: { worldRole: input.role },
      });
    }

    return membership;
  }

  async updateWorldMembershipRole(
    userId: string,
    worldId: string,
    role: "owner" | "dm" | "player",
  ) {
    const existing = await this.db.worldMembership.findUnique({
      where: { userId_worldId: { userId, worldId } },
    });

    if (!existing) {
      throw new Error("World membership not found");
    }

    const updated = await this.db.worldMembership.update({
      where: { userId_worldId: { userId, worldId } },
      data: { role },
    });

    await logAuditEvent(this.db, {
      action: "user_role_changed",
      targetType: "user",
      targetId: userId,
      worldId,
      metadata: {
        from: existing.role,
        to: role,
        scope: "world",
      },
    });

    return updated;
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
    role: "owner" | "admin" | "dm" | "player" | "readonly" | "guest";
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

    const systemSettings = await new SettingsService(this.db).getSettings();

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
      guestModeEnabled: isGuestPortalAccessAllowed(systemSettings, world.guestModeEnabled),
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

    if (!page) {
      return null;
    }

    const scope = scopeFromAccessContext(ctx, page.worldId);
    if (!canReadContent(ctx.user, page, scope.world, scope)) {
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

  /**
   * Renders block content as HTML with resolved wikilinks for the
   * authenticated portal. Links to pages the viewer cannot see are shown as
   * "Verborgen" and never expose the target title or slug.
   */
  async renderBlockContentForViewer(
    worldSlug: string,
    content: string,
    ctx: AccessContext,
  ): Promise<string> {
    const parsed = parseWikiLinks(content);
    if (parsed.length === 0) {
      return renderContentHtml(content, []);
    }

    const allPages = await this.db.page.findMany({
      where: { world: { slug: worldSlug } },
      select: {
        id: true,
        title: true,
        slug: true,
        visibility: true,
        publishStatus: true,
        aliases: true,
      },
    });

    const lookup = new Map<string, (typeof allPages)[number]>();
    for (const page of allPages) {
      const keys = [
        normalizeLookupKey(page.title),
        normalizeLookupKey(page.slug),
        ...parseStringArray(page.aliases).map(normalizeLookupKey),
      ];
      for (const key of keys) {
        if (!lookup.has(key)) {
          lookup.set(key, page);
        }
      }
    }

    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      return renderContentHtml(content, []);
    }

    const scope = scopeFromAccessContext(ctx, world.id);

    const links: PageViewLink[] = parsed.map((raw) => {
      const displayText = raw.label ?? raw.target;
      const target = lookup.get(normalizeLookupKey(raw.target));

      if (!target) {
        return { displayText, status: "broken" as const };
      }

      if (!canReadContent(ctx.user, target, scope.world, scope)) {
        return { displayText: raw.label ?? "Verborgen", status: "hidden" as const };
      }

      return {
        displayText,
        href: `/auth/worlds/${worldSlug}/${target.slug}`,
        status: "resolved" as const,
      };
    });

    return renderContentHtml(content, links);
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

  /**
   * Linked pages can include DM-only or unpublished pages. Their titles and
   * slugs must never leak to portal viewers, so the list is filtered with the
   * same visibility rules as the wiki itself.
   */
  private toPortalSessionViewForViewer(
    session: Parameters<typeof toPortalGameSessionView>[0],
    ctx: AccessContext,
  ): PortalGameSessionView {
    const view = toPortalGameSessionView(session);
    return {
      ...view,
      linkedPages: filterPagesForViewer(ctx, view.linkedPages),
    };
  }

  async listGameSessionsForViewer(worldSlug: string, ctx: AccessContext): Promise<PortalGameSessionView[]> {
    const isDm = ctx.effectiveRole === "owner" || ctx.effectiveRole === "dm";

    if (isDm) {
      const sessions = await this.gameSessions.listByWorld(worldSlug);
      return sessions
        .filter((session) => session.recapPublished)
        .map((session) => this.toPortalSessionViewForViewer(session, ctx));
    }

    if (ctx.effectiveRole !== "player") {
      return [];
    }

    const sessions = await this.gameSessions.listPublishedForPortal(worldSlug);
    return sessions.map((session) => this.toPortalSessionViewForViewer(session, ctx));
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
    return this.toPortalSessionViewForViewer(session, ctx);
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

    const scope = scopeFromAccessContext(ctx, asset.worldId);
    const accessInfo = {
      id: asset.id,
      visibility: asset.visibility,
      secretLevel: asset.secretLevel,
      revealState: asset.revealState,
      linkedPageIds: asset.pageLinks.map((link) => link.pageId),
    };

    if (!canReadAsset(ctx.user, accessInfo, scope.world, scope)) {
      return null;
    }

    return asset;
  }

  async listSoundboardForDm(
    worldSlug: string,
    campaignId?: string | null,
  ): Promise<DmSoundboardButtonView[]> {
    const buttons = await this.soundboard.listByWorld(worldSlug, { campaignId });
    return buttons.map(toDmSoundboardButtonView);
  }

  async getSoundboardButtonForDm(
    worldSlug: string,
    buttonId: string,
  ): Promise<DmSoundboardButtonView | null> {
    const button = await this.soundboard.getByIdForWorld(worldSlug, buttonId);
    return button ? toDmSoundboardButtonView(button) : null;
  }

  async listSoundboardForViewer(
    worldSlug: string,
    ctx: AccessContext,
    options?: { campaignId?: string | null },
  ): Promise<PortalSoundboardButtonView[]> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      return [];
    }

    const scope = scopeFromAccessContext(ctx, world.id);
    const buttons = await this.soundboard.listByWorld(worldSlug, options);

    return buttons
      .filter((button) => {
        if (!isSoundboardButtonVisibleInPortal(button.visibility)) {
          return false;
        }

        if (button.assetId && button.asset) {
          return canReadAsset(
            ctx.user,
            {
              id: button.asset.id,
              visibility: button.asset.visibility,
              linkedPageIds: [],
            },
            scope.world,
            scope,
          );
        }

        return true;
      })
      .map(toPortalSoundboardButtonView);
  }

  async getSoundboardButtonForViewer(
    worldSlug: string,
    buttonId: string,
    ctx: AccessContext,
  ): Promise<PortalSoundboardButtonView | null> {
    const button = await this.soundboard.getByIdForWorld(worldSlug, buttonId);
    if (!button || !isSoundboardButtonVisibleInPortal(button.visibility)) {
      return null;
    }

    if (button.asset) {
      const world = await this.db.world.findUnique({
        where: { slug: worldSlug },
        select: { id: true },
      });
      if (!world) {
        return null;
      }

      const scope = scopeFromAccessContext(ctx, world.id);
      const allowed = canReadAsset(
        ctx.user,
        {
          id: button.asset.id,
          visibility: button.asset.visibility,
          linkedPageIds: [],
        },
        scope.world,
        scope,
      );
      if (!allowed) {
        return null;
      }
    }

    return toPortalSoundboardButtonView(button);
  }

  async listPlayerNotesForViewer(
    worldSlug: string,
    ctx: AccessContext,
    options?: { campaignId?: string | null; pageId?: string; gameSessionId?: string },
  ): Promise<PortalPlayerNoteView[]> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { guestCommentsEnabled: true },
    });
    if (!world) return [];

    let notes;
    if (options?.pageId) {
      notes = await this.playerNotes.listForPage(worldSlug, options.pageId, {
        campaignId: options.campaignId,
      });
    } else if (options?.gameSessionId) {
      notes = await this.playerNotes.listForGameSession(worldSlug, options.gameSessionId);
    } else if (ctx.user && ctx.effectiveRole === "player") {
      notes = await this.playerNotes.listByUser(worldSlug, ctx.user.id, {
        campaignId: options?.campaignId,
      });
    } else {
      notes = await this.playerNotes.listByWorld(worldSlug, {
        campaignId: options?.campaignId,
      });
    }

    return filterPlayerNotesForViewer(ctx, notes).map(toPortalPlayerNoteView);
  }

  async getPlayerNoteForViewer(
    worldSlug: string,
    noteId: string,
    ctx: AccessContext,
  ): Promise<PortalPlayerNoteView | null> {
    const note = await this.playerNotes.getByIdForWorld(worldSlug, noteId);
    if (!note || !canViewPlayerNote(ctx, note)) {
      return null;
    }
    return toPortalPlayerNoteView(note);
  }

  async createPlayerNoteForViewer(
    worldSlug: string,
    ctx: AccessContext,
    input: {
      campaignId: string;
      content: string;
      pageId?: string | null;
      gameSessionId?: string | null;
    },
  ): Promise<PortalPlayerNoteView | null> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, guestCommentsEnabled: true },
    });
    if (!world || !ctx.user || !canCreatePlayerNote(ctx, world.guestCommentsEnabled)) {
      return null;
    }

    const note = await this.playerNotes.create({
      worldId: world.id,
      campaignId: input.campaignId,
      userId: ctx.user.id,
      content: input.content,
      pageId: input.pageId,
      gameSessionId: input.gameSessionId,
    });

    return toPortalPlayerNoteView(note);
  }

  async updatePlayerNoteForViewer(
    worldSlug: string,
    noteId: string,
    ctx: AccessContext,
    content: string,
  ): Promise<PortalPlayerNoteView | null> {
    const note = await this.playerNotes.getByIdForWorld(worldSlug, noteId);
    if (!note || !canEditPlayerNote(ctx, note)) {
      return null;
    }

    const updated = await this.playerNotes.update(noteId, { content });
    return toPortalPlayerNoteView(updated);
  }

  async submitPlayerNoteForViewer(
    worldSlug: string,
    noteId: string,
    ctx: AccessContext,
  ): Promise<PortalPlayerNoteView | null> {
    const note = await this.playerNotes.getByIdForWorld(worldSlug, noteId);
    if (!note || !canEditPlayerNote(ctx, note) || note.status !== "draft") {
      return null;
    }

    const updated = await this.playerNotes.submitToDm(noteId);
    return toPortalPlayerNoteView(updated);
  }

  async listPlayerNotesForDm(
    worldSlug: string,
    options?: { campaignId?: string | null; status?: import("./generated/prisma/client").PlayerNoteStatus },
  ): Promise<DmPlayerNoteView[]> {
    const notes = await this.playerNotes.listByWorld(worldSlug, {
      campaignId: options?.campaignId,
      status: options?.status ?? ["visible_to_dm", "accepted", "hidden", "draft"],
    });
    return notes.map(toDmPlayerNoteView);
  }

  async listPlayerNoteReviewQueue(
    worldSlug: string,
    campaignId?: string | null,
  ): Promise<DmPlayerNoteView[]> {
    const notes = await this.playerNotes.listByWorld(worldSlug, {
      campaignId,
      status: "visible_to_dm",
    });
    return notes.map(toDmPlayerNoteView);
  }

  async getPlayerNoteForDm(
    worldSlug: string,
    noteId: string,
  ): Promise<DmPlayerNoteView | null> {
    const note = await this.playerNotes.getByIdForWorld(worldSlug, noteId);
    return note ? toDmPlayerNoteView(note) : null;
  }

  getPlayerNoteService(): PlayerNoteService {
    return this.playerNotes;
  }
}

export function createAuthService(db: PrismaClient): AuthService {
  return new AuthService(db);
}

export {
  canReadAsset,
  canReadContent,
  canViewAsset,
  canViewContentBlock,
  canViewPage,
  filterAssetsForViewer,
  filterBlocksForViewer,
  filterPagesForViewer,
  canCreatePlayerNote,
  canEditPlayerNote,
  canModeratePlayerNote,
  canViewPlayerNote,
  filterPlayerNotesForViewer,
};
