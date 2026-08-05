import type { PrismaClient } from "./client";
import type {} from "./generated/prisma/client";
import type { AccessContext, AreaAccess, AuthUser, AuthUserSource, PreviewOptions } from "@uwe/auth";
import {
  buildAccessContext,
  canCreatePlayerNote,
  canEditPlayerNote,
  canModeratePlayerNote,
  canReadAsset,
  canReadContent,
  canReadWorld,
  canViewWorldContent,
  canViewPlayerNote,
  filterAssetsForViewer,
  filterBlocksForViewer,
  filterPagesForViewer,
  filterPlayerNotesForViewer,
  isDm,
  preserveDmSections,
  redactDmSectionsForViewer,
  scopeFromAccessContext,
  sessionExpiresAt,
  canEditPlayerCharacterBlock,
} from "@uwe/auth";
import {
  generateSessionToken,
  hashOpaqueToken,
  hashPassword,
  isLegacyPasswordHash,
  verifyPassword,
} from "@uwe/auth/server";
import { toAreaAccess, toAuthUser, toSafeUser, type SafeUser } from "@uwe/auth";
import type { PageWithBlocks } from "./repository";
import {
  normalizeLookupKey,
  parseWikiLinks,
  renderContentHtml,
  type PageViewLink,
} from "./page-service";
import { parseStringArray } from "./json-utils";
import { searchForAuthContext, type SearchOptions, type SearchResultItem } from "./search-service";
import { SettingsService, resolveSessionInactivityTimeoutMs } from "./settings-service";
import {
  GameSessionService,
  toDmGameSessionView,
  toPortalGameSessionView,
  type DmGameSessionView,
  type PortalGameSessionView,
} from "./game-session";
import {
  createWorldEventService,
  toPortalWorldEventView,
  compareInGameDates,
  type PortalWorldEventView,
  type WorldEventWithLinks,
} from "./world-event-service";
import {
  SoundboardService,
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
import {
  createPortalDashboardService,
  PortalDashboardService,
  type PortalDashboardData,
} from "./portal-dashboard-service";
import {
  createCharacterService,
  toPortalCharacterView,
  type PortalCharacterView,
  type UpdateCharacterInput,
} from "./character-service";
import { logAuditEvent } from "./audit-log-service";
import { USER_SAFE_SELECT } from "./user-service";

const SESSION_ACTIVITY_TOUCH_THROTTLE_MS = 60_000;

/**
 * A valid-format scrypt hash used only to equalize timing in `authenticate`.
 * When the e-mail is unknown or the account is inactive we still run one
 * `verifyPassword` against this constant so the scrypt cost is paid on every
 * path — otherwise the missing-scrypt shortcut is a user-enumeration timing
 * oracle. The value never matches any password (it is not derived from one).
 */
export const DUMMY_PASSWORD_HASH = `scrypt:v1:${"0".repeat(32)}:${"0".repeat(128)}`;

/**
 * Account-lockout policy. Deliberately loose (10 tries / 15 min) so a
 * fat-fingered legitimate user is not locked out, while password spraying —
 * which the account-keyed counter catches across rotating IPs — cannot make
 * meaningful progress. The owner is not code-exempt; the window auto-expires.
 */
export const MAX_FAILED_LOGINS = 10;
export const LOCKOUT_MS = 15 * 60_000;

/**
 * Die vier Häkchen plus das KI-Flag, alle optional. `aiAccess` ist kein
 * fünftes Häkchen — siehe `packages/auth/src/area-access.ts`.
 */
export interface AreaAccessInput {
  portalAccess?: boolean;
  studioAccess?: boolean;
  brainAccess?: boolean;
  familyAccess?: boolean;
  aiAccess?: boolean;
}

export interface CreateUserInput extends AreaAccessInput {
  displayName: string;
  email?: string | null;
  password?: string | null;
  isOwner?: boolean;
  status?: "invited" | "active" | "disabled";
}

export interface UpdateUserInput extends AreaAccessInput {
  displayName?: string;
  email?: string | null;
  isOwner?: boolean;
  status?: "invited" | "active" | "disabled";
}

export interface UpsertWorldMembershipInput {
  userId: string;
  worldId: string;
  characterName?: string | null;
}

export interface AdminUserView {
  id: string;
  displayName: string;
  email: string | null;
  isOwner: boolean;
  access: AreaAccess;
  status: "invited" | "active" | "disabled";
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  worldMemberships: Array<{
    id: string;
    worldId: string;
    characterName: string | null;
    world: { id: string; name: string; slug: string };
  }>;
}

export interface CreateWorldMembershipInput {
  userId: string;
  worldId: string;
  characterName?: string | null;
}

export class AuthService {
  private readonly gameSessions: GameSessionService;
  private readonly soundboard: SoundboardService;
  private readonly playerNotes: PlayerNoteService;
  private readonly portalDashboard: PortalDashboardService;
  private readonly characters;

  constructor(private readonly db: PrismaClient) {
    this.gameSessions = new GameSessionService(db);
    this.soundboard = new SoundboardService(db);
    this.playerNotes = new PlayerNoteService(db);
    this.portalDashboard = createPortalDashboardService(db);
    this.characters = createCharacterService(db);
  }

  async createUser(input: CreateUserInput): Promise<SafeUser> {
    const existingOwnerCount = input.isOwner
      ? await this.db.user.count({ where: { isOwner: true } })
      : 0;

    const user = await this.db.user.create({
      data: {
        displayName: input.displayName,
        email: input.email ?? null,
        passwordHash: input.password ? await hashPassword(input.password) : null,
        isOwner: input.isOwner ?? false,
        portalAccess: input.portalAccess ?? false,
        studioAccess: input.studioAccess ?? false,
        brainAccess: input.brainAccess ?? false,
        familyAccess: input.familyAccess ?? false,
        aiAccess: input.aiAccess ?? false,
        status: input.status ?? "active",
      },
      select: USER_SAFE_SELECT,
    });

    await logAuditEvent(this.db, {
      action: "user_created",
      targetType: "user",
      targetId: user.id,
      metadata: {
        displayName: user.displayName,
        email: user.email,
        isOwner: user.isOwner,
        access: toAreaAccess(user),
      },
    });

    if (input.isOwner && existingOwnerCount === 0) {
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

    return toSafeUser(user);
  }

  async findUserByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: USER_SAFE_SELECT,
    });
  }

  async findUserById(id: string) {
    return this.db.user.findUnique({
      where: { id },
      select: USER_SAFE_SELECT,
    });
  }

  async hasOwnerUser(): Promise<boolean> {
    const owner = await this.db.user.findFirst({
      where: { isOwner: true },
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

    // The first account is the owner and gets every checkbox — there is nobody
    // else around yet who could tick them.
    return this.createUser({
      displayName: input.displayName,
      email: input.email,
      password: input.password,
      isOwner: true,
      portalAccess: true,
      studioAccess: true,
      brainAccess: true,
      familyAccess: true,
      // Der Owner geht über `canUseEngineAi` ohnehin durch; gesetzt wird es
      // trotzdem, damit die Zeile das Gleiche sagt wie die Oberfläche.
      aiAccess: true,
    });
  }

  async createWorldMembership(input: CreateWorldMembershipInput) {
    return this.db.worldMembership.create({
      data: {
        userId: input.userId,
        worldId: input.worldId,
        characterName: input.characterName ?? null,
      },
    });
  }

  async listUsersForAdmin(): Promise<AdminUserView[]> {
    const users = await this.db.user.findMany({
      orderBy: [{ displayName: "asc" }],
      include: {
        worldMemberships: {
          include: {
            world: { select: { id: true, name: true, slug: true } },
          },
          orderBy: [{ world: { name: "asc" } }],
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      isOwner: user.isOwner,
      access: toAreaAccess(user),
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      worldMemberships: user.worldMemberships.map((membership) => ({
        id: membership.id,
        worldId: membership.worldId,
        characterName: membership.characterName,
        world: membership.world,
      })),
    }));
  }

  async updateUser(
    userId: string,
    input: UpdateUserInput,
    actorUserId?: string | null,
  ) {
    const existing = await this.db.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new Error("USER_NOT_FOUND");
    }

    if (input.email !== undefined && input.email !== existing.email) {
      if (input.email) {
        const duplicate = await this.db.user.findUnique({ where: { email: input.email } });
        if (duplicate && duplicate.id !== userId) {
          throw new Error("EMAIL_ALREADY_EXISTS");
        }
      }
    }

    if (input.isOwner === false && existing.isOwner) {
      const ownerCount = await this.db.user.count({
        where: { isOwner: true, status: "active" },
      });
      if (ownerCount <= 1) {
        throw new Error("LAST_OWNER_ROLE");
      }
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName ?? undefined,
        email: input.email !== undefined ? input.email : undefined,
        isOwner: input.isOwner ?? undefined,
        portalAccess: input.portalAccess ?? undefined,
        studioAccess: input.studioAccess ?? undefined,
        brainAccess: input.brainAccess ?? undefined,
        familyAccess: input.familyAccess ?? undefined,
        aiAccess: input.aiAccess ?? undefined,
        status: input.status ?? undefined,
      },
    });

    const accessChanged =
      toAreaAccess(existing).portal !== toAreaAccess(updated).portal ||
      toAreaAccess(existing).studio !== toAreaAccess(updated).studio ||
      toAreaAccess(existing).brain !== toAreaAccess(updated).brain ||
      toAreaAccess(existing).family !== toAreaAccess(updated).family ||
      // Wer den Maschinenraum-Host beschäftigen darf, ist eine Rechteänderung und
      // gehört ins Audit — genau wie die Häkchen darüber.
      existing.aiAccess !== updated.aiAccess ||
      existing.isOwner !== updated.isOwner;

    if (accessChanged) {
      await logAuditEvent(this.db, {
        actorUserId: actorUserId ?? undefined,
        action: "user_access_changed",
        targetType: "user",
        targetId: userId,
        metadata: {
          from: { isOwner: existing.isOwner, access: toAreaAccess(existing), aiAccess: existing.aiAccess },
          to: { isOwner: updated.isOwner, access: toAreaAccess(updated), aiAccess: updated.aiAccess },
        },
      });
    }

    return updated;
  }

  async disableUser(userId: string, actorUserId?: string | null) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (user.status === "disabled") {
      return user;
    }

    if (user.isOwner) {
      const activeOwners = await this.db.user.count({
        where: { isOwner: true, status: "active", id: { not: userId } },
      });
      if (activeOwners === 0) {
        throw new Error("LAST_OWNER");
      }
    }

    if (actorUserId && actorUserId === userId) {
      throw new Error("CANNOT_DISABLE_SELF");
    }

    await this.db.session.deleteMany({ where: { userId } });

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { status: "disabled" },
    });

    await logAuditEvent(this.db, {
      actorUserId: actorUserId ?? undefined,
      action: "user_disabled",
      targetType: "user",
      targetId: userId,
      metadata: {
        displayName: user.displayName,
        email: user.email,
      },
    });

    return updated;
  }

  async enableUser(userId: string, actorUserId?: string | null) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    if (user.status === "active") {
      return user;
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { status: "active" },
    });

    await logAuditEvent(this.db, {
      actorUserId: actorUserId ?? undefined,
      action: "user_enabled",
      targetType: "user",
      targetId: userId,
      metadata: {
        displayName: user.displayName,
        email: user.email,
      },
    });

    return updated;
  }

  async resetUserPassword(
    userId: string,
    password: string,
    actorUserId?: string | null,
  ) {
    if (password.length < 8) {
      throw new Error("PASSWORD_TOO_SHORT");
    }

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const updated = await this.db.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password) },
    });

    await logAuditEvent(this.db, {
      actorUserId: actorUserId ?? undefined,
      action: "password_reset",
      targetType: "user",
      targetId: userId,
      metadata: {
        displayName: user.displayName,
        email: user.email,
      },
    });

    return updated;
  }

  async upsertWorldMembership(input: UpsertWorldMembershipInput) {
    const membership = await this.db.worldMembership.upsert({
      where: {
        userId_worldId: {
          userId: input.userId,
          worldId: input.worldId,
        },
      },
      create: {
        userId: input.userId,
        worldId: input.worldId,
        characterName: input.characterName ?? null,
      },
      update: {
        characterName: input.characterName !== undefined ? input.characterName : undefined,
      },
      include: {
        world: { select: { id: true, name: true, slug: true } },
      },
    });

    return membership;
  }

  async removeWorldMembership(userId: string, worldId: string) {
    const existing = await this.db.worldMembership.findUnique({
      where: { userId_worldId: { userId, worldId } },
    });

    if (!existing) {
      throw new Error("MEMBERSHIP_NOT_FOUND");
    }

    await this.db.worldMembership.delete({
      where: { userId_worldId: { userId, worldId } },
    });
  }

  async listAccessibleWorldsForUser(userId: string | null) {
    // Without an account there is nothing to see — anonymous guests are gone
    // along with the guest mode switch (Notiz Lasse, 2026-07-26).
    if (!userId) {
      return [];
    }

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "active") {
      return [];
    }

    const worlds = await this.db.world.findMany({
      where: { isSandbox: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        updatedAt: true,
      },
    });

    const memberships = await this.db.worldMembership.findMany({
      where: { userId },
    });
    const membershipByWorld = new Map(memberships.map((entry) => [entry.worldId, entry]));
    const authUser = this.toAuthUser(user);

    return worlds.filter((world) => {
      const membership = membershipByWorld.get(world.id) ?? null;
      return canReadWorld(authUser, {
        id: world.id,
        membership: membership
          ? {
              userId: membership.userId,
              worldId: membership.worldId,
              characterName: membership.characterName,
            }
          : null,
      });
    });
  }

  async recordSuccessfulLogin(userId: string) {
    await this.db.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Count a failed password attempt for this account. Once it reaches
   * MAX_FAILED_LOGINS the account is locked for LOCKOUT_MS. This is keyed on the
   * account, not the IP, so an attacker rotating source IPs (which the spoofable
   * X-Forwarded-For made trivial) still runs into the same wall. The window
   * auto-expires; a successful login clears the counter.
   */
  async recordFailedLogin(userId: string) {
    const updated = await this.db.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      await this.db.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_MS) },
      });
    }
  }

  async resetFailedLogins(userId: string) {
    await this.db.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  async authenticate(email: string, password: string) {
    const user = await this.db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user?.passwordHash) {
      // Pay the scrypt cost anyway so an unknown e-mail is not distinguishable
      // from a wrong password by response time (user-enumeration oracle).
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      return null;
    }

    if (user.status !== "active") {
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      return null;
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      return null;
    }

    if (user.passwordHash && isLegacyPasswordHash(user.passwordHash)) {
      const upgradedHash = await hashPassword(password);
      await this.db.user.update({
        where: { id: user.id },
        data: { passwordHash: upgradedHash },
      });
    }

    return toSafeUser(user);
  }

  async createSession(userId: string, options: { ipAddress?: string | null } = {}) {
    const token = generateSessionToken();
    const tokenHash = hashOpaqueToken(token);
    const session = await this.db.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt: sessionExpiresAt(),
        ...(options.ipAddress ? { ipAddress: options.ipAddress } : {}),
      },
      include: {
        user: {
          select: USER_SAFE_SELECT,
        },
      },
    });

    return {
      ...session,
      token,
      user: toSafeUser(session.user as Record<string, unknown>),
    };
  }

  async getSessionByToken(token: string, options: { touch?: boolean } = {}) {
    const touch = options.touch !== false;
    const tokenHash = hashOpaqueToken(token);
    const session = await this.db.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: USER_SAFE_SELECT,
        },
      },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt <= new Date()) {
      await this.db.session.delete({ where: { id: session.id } });
      return null;
    }

    const lastActiveAt = session.lastActiveAt ?? session.createdAt;
    const systemSettings = await new SettingsService(this.db).getSettings();
    const inactivityMs = resolveSessionInactivityTimeoutMs(systemSettings);
    if (inactivityMs > 0 && Date.now() - lastActiveAt.getTime() >= inactivityMs) {
      await this.db.session.delete({ where: { id: session.id } });
      return null;
    }

    if (touch) {
      const now = new Date();
      if (now.getTime() - lastActiveAt.getTime() >= SESSION_ACTIVITY_TOUCH_THROTTLE_MS) {
        await this.db.session.update({
          where: { id: session.id },
          data: { lastActiveAt: now },
        });
      }
    }

    return {
      ...session,
      token,
      user: toSafeUser(session.user as Record<string, unknown>),
    };
  }

  async touchSession(token: string): Promise<boolean> {
    const session = await this.getSessionByToken(token, { touch: true });
    return session !== null;
  }

  async deleteSession(token: string) {
    const tokenHash = hashOpaqueToken(token);
    await this.db.session.deleteMany({ where: { tokenHash } });
  }

  toAuthUser(user: AuthUserSource): AuthUser {
    return toAuthUser(user);
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
        isSandbox: true,
      },
    });

    if (!world || world.isSandbox) {
      return null;
    }

    const user = options.userId
      ? await this.db.user.findUnique({
          where: { id: options.userId },
          select: USER_SAFE_SELECT,
        })
      : null;

    if (user && user.status !== "active") {
      return null;
    }

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

    return buildAccessContext({
      user: user ? this.toAuthUser(user) : null,
      worldMembership: membership
        ? {
            userId: membership.userId,
            worldId: membership.worldId,
            characterName: membership.characterName,
          }
        : null,
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

    // Dieselbe Freigabe wie in jeder Liste — sonst waere der Haken nur eine
    // Empfehlung: Die Seite verschwaende aus dem Index, bliebe aber unter ihrem
    // Direktlink erreichbar, und Slugs sind ratbar.
    if (filterPagesForViewer(ctx, [page]).length === 0) {
      return null;
    }

    return {
      ...page,
      // Die Kurzbeschreibung ist auch Wikitext — eine dort hingeschriebene
      // `:::dm`-Marke muss genauso greifen wie im Block.
      summary: redactDmSectionsForViewer(ctx, page.summary),
      contentBlocks: filterBlocksForViewer(ctx, page.contentBlocks),
    };
  }

  async listPagesForViewer(worldSlug: string, ctx: AccessContext) {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      return [];
    }

    const scope = scopeFromAccessContext(ctx, world.id);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return [];
    }

    // The WS3 pre-narrowing that used to sit here is gone with visibility:
    // there is no combination left that would let SQL drop a row a viewer may
    // not see. Everyone assigned to the world loads the whole world index.
    const pages = await this.db.page.findMany({
      where: { world: { slug: worldSlug } },
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        summary: true,
        questStatus: true,
        updatedAt: true,
        // Muss mit: `filterPagesForViewer` ist fail-closed und wirft ohne dieses
        // Feld jede Seite heraus.
        portalReleased: true,
      },
      orderBy: [{ title: "asc" }],
    });

    // filterPagesForViewer stays as the single gate: it returns nothing for an
    // anonymous guest and everything for anyone assigned to the world. Nur die
    // Kurzbeschreibung geht noch durch den DM-Schnitt — sie ist Wikitext und
    // steht in dieser Liste unter jedem Seitentitel.
    return filterPagesForViewer(ctx, pages).map((page) => {
      const summary = redactDmSectionsForViewer(ctx, page.summary);
      return summary === page.summary ? page : { ...page, summary };
    });
  }

  /**
   * Builds the wikilink lookup + access scope for a world exactly once, so a
   * page view can render all its blocks without re-querying the page index per
   * block. Pass the result into {@link renderBlockContentForViewer} as
   * `renderCtx`. Returns null when the world does not exist.
   */
  async buildViewerRenderContext(worldSlug: string, ctx: AccessContext) {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      return null;
    }

    const allPages = await this.db.page.findMany({
      where: { world: { slug: worldSlug } },
      select: {
        id: true,
        title: true,
        slug: true,
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

    return { lookup, scope: scopeFromAccessContext(ctx, world.id) };
  }

  /**
   * Renders block content as HTML with resolved wikilinks for the
   * authenticated portal. Pass a `renderCtx`
   * from {@link buildViewerRenderContext} to reuse one page-index query across
   * all blocks; omit it to build the lookup for this block only.
   *
   * Der DM-Bereich (`:::dm … :::`) fällt hier ein zweites Mal heraus. Die
   * Blöcke kommen bereits geschnitten aus `filterBlocksForViewer`; diese Zeile
   * deckt die Aufrufer ab, die den Inhalt anderswo herbekommen haben.
   */
  async renderBlockContentForViewer(
    worldSlug: string,
    rawContent: string,
    ctx: AccessContext,
    renderCtx?: Awaited<ReturnType<AuthService["buildViewerRenderContext"]>>,
  ): Promise<string> {
    const content = redactDmSectionsForViewer(ctx, rawContent);
    const parsed = parseWikiLinks(content);
    if (parsed.length === 0) {
      return renderContentHtml(content, []);
    }

    const context =
      renderCtx === undefined ? await this.buildViewerRenderContext(worldSlug, ctx) : renderCtx;
    if (!context) {
      return renderContentHtml(content, []);
    }

    const links: PageViewLink[] = parsed.map((raw) => {
      const displayText = raw.label ?? raw.target;
      const target = context.lookup.get(normalizeLookupKey(raw.target));

      if (!target) {
        return { displayText, status: "broken" as const };
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

  private toPortalWorldEventViewForViewer(
    event: WorldEventWithLinks,
    ctx: AccessContext,
  ): PortalWorldEventView {
    const view = toPortalWorldEventView(event);
    const visiblePages = filterPagesForViewer(
      ctx,
      event.entityLinks.map((link) => link.page),
    );
    const visibleIds = new Set(visiblePages.map((page) => page.id));
    return {
      ...view,
      linkedPages: view.linkedPages.filter((page) => visibleIds.has(page.id)),
    };
  }

  async listWorldEventsForViewer(
    worldSlug: string,
    ctx: AccessContext,
  ): Promise<PortalWorldEventView[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug }, select: { id: true } });
    if (!world) {
      return [];
    }

    const scope = scopeFromAccessContext(ctx, world.id);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return [];
    }

    const events = createWorldEventService(this.db);
    const rows = await events.listForWorld(world.id);
    const portalRows = rows as WorldEventWithLinks[];

    return portalRows
      .map((event) => this.toPortalWorldEventViewForViewer(event, ctx))
      .sort((a, b) => compareInGameDates(a.inGameDate, b.inGameDate));
  }

  async listWorldEventsForPageViewer(
    worldSlug: string,
    pageId: string,
    ctx: AccessContext,
  ): Promise<PortalWorldEventView[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug }, select: { id: true } });
    if (!world) {
      return [];
    }

    const scope = scopeFromAccessContext(ctx, world.id);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return [];
    }

    const events = createWorldEventService(this.db);
    const rows = await events.listForPage(pageId);
    const portalRows = rows as WorldEventWithLinks[];

    return portalRows
      .map((event) => this.toPortalWorldEventViewForViewer(event, ctx))
      .sort((a, b) => compareInGameDates(a.inGameDate, b.inGameDate));
  }

  async listGameSessionsForViewer(worldSlug: string, ctx: AccessContext): Promise<PortalGameSessionView[]> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      return [];
    }

    const scope = scopeFromAccessContext(ctx, world.id);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return [];
    }

    if (isDm(ctx)) {
      const sessions = await this.gameSessions.listByWorld(worldSlug);
      return sessions
        .filter((session) => session.recapPublished)
        .map((session) => this.toPortalSessionViewForViewer(session, ctx));
    }

    const sessions = await this.gameSessions.listVisibleToPlayersForPortal(worldSlug);
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

    const dmView = isDm(ctx);
    const playerMayViewSchedule =
      !dmView &&
      ctx.worldMembership !== null &&
      session.playerVisibleSchedule &&
      (session.status === "planned" || session.status === "prepared");

    if (!session.recapPublished && !dmView && !playerMayViewSchedule) {
      return null;
    }

    // Portal never exposes DM-only fields — even for DMs viewing the portal.
    return this.toPortalSessionViewForViewer(session, ctx);
  }

  async listGameSessionsForDm(
    worldSlug: string,
    campaignId?: string | null,
    options?: {
      status?: import("./generated/prisma/client").GameSessionStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<DmGameSessionView[]> {
    const sessions = await this.gameSessions.listByWorld(worldSlug, {
      campaignId,
      status: options?.status,
      limit: options?.limit,
      offset: options?.offset,
    });
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

    // „Player" is now: assigned to this world and without the Studio checkbox.
    return this.db.worldMembership.findMany({
      where: {
        worldId: world.id,
        user: { studioAccess: false },
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

    const scope = scopeFromAccessContext(ctx, world.id);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return [];
    }

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
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return [];
    }

    const buttons = await this.soundboard.listByWorld(worldSlug, options);

    return buttons
      .filter((button) =>
        button.assetId && button.asset
          ? canReadAsset(ctx.user, { id: button.asset.id }, scope.world, scope)
          : true,
      )
      .map(toPortalSoundboardButtonView);
  }

  async getSoundboardButtonForViewer(
    worldSlug: string,
    buttonId: string,
    ctx: AccessContext,
  ): Promise<PortalSoundboardButtonView | null> {
    const button = await this.soundboard.getByIdForWorld(worldSlug, buttonId);
    if (!button) {
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
      const allowed = canReadAsset(ctx.user, { id: button.asset.id }, scope.world, scope);
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
      select: { id: true },
    });
    if (!world) return [];

    let notes;
    if (options?.pageId) {
      notes = await this.playerNotes.listForPage(worldSlug, options.pageId, {
        campaignId: options.campaignId,
      });
    } else if (options?.gameSessionId) {
      notes = await this.playerNotes.listForGameSession(worldSlug, options.gameSessionId);
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
      title?: string | null;
      category?: import("./player-note-service").PlayerNoteCategory;
      sessionDate?: Date | null;
      pageId?: string | null;
      gameSessionId?: string | null;
      /** Offline vergebene Kennung; verhindert Duplikate beim Nachsyncen. */
      clientRef?: string | null;
    },
  ): Promise<PortalPlayerNoteView | null> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world || !ctx.user || !canCreatePlayerNote(ctx)) {
      return null;
    }

    const note = await this.playerNotes.create({
      worldId: world.id,
      campaignId: input.campaignId,
      userId: ctx.user.id,
      content: input.content,
      title: input.title,
      category: input.category,
      sessionDate: input.sessionDate,
      pageId: input.pageId,
      gameSessionId: input.gameSessionId,
      clientRef: input.clientRef,
    });

    return toPortalPlayerNoteView(note);
  }

  async updatePlayerNoteForViewer(
    worldSlug: string,
    noteId: string,
    ctx: AccessContext,
    content: string,
    extras?: {
      title?: string | null;
      category?: import("./player-note-service").PlayerNoteCategory;
      sessionDate?: Date | null;
    },
  ): Promise<PortalPlayerNoteView | null> {
    const note = await this.playerNotes.getByIdForWorld(worldSlug, noteId);
    if (!note || !canEditPlayerNote(ctx, note)) {
      return null;
    }

    const updated = await this.playerNotes.update(noteId, { content, ...extras });
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

  async getPortalDashboard(
    worldSlug: string,
    ctx: AccessContext,
    options?: { campaignId?: string | null },
  ): Promise<PortalDashboardData | null> {
    const pages = await this.listPagesForViewer(worldSlug, ctx);
    const sessions = await this.listGameSessionsForViewer(worldSlug, ctx);
    const notes = await this.listPlayerNotesForViewer(worldSlug, ctx, {
      campaignId: options?.campaignId,
    });

    return this.portalDashboard.buildDashboard(worldSlug, ctx, {
      visiblePages: pages,
      publishedSessions: sessions,
      playerNotes: notes,
    });
  }

  async listCharactersForViewer(
    worldSlug: string,
    ctx: AccessContext,
  ): Promise<PortalCharacterView[]> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      return [];
    }

    const scope = scopeFromAccessContext(ctx, world.id);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return [];
    }

    if (isDm(ctx)) {
      const characters = await this.characters.listForWorld(world.id);
      return characters.map((character) => toPortalCharacterView(character));
    }

    if (!ctx.user) {
      return [];
    }

    const characters = await this.characters.listForOwner(world.id, ctx.user.id);
    const visible: PortalCharacterView[] = [];

    for (const character of characters) {
      if (character.pageId && character.page && !canViewWorldContent(ctx)) {
        continue;
      }
      visible.push(toPortalCharacterView(character));
    }

    return visible;
  }

  async getCharacterForViewer(
    worldSlug: string,
    characterId: string,
    ctx: AccessContext,
  ): Promise<PortalCharacterView | null> {
    const character = await this.characters.getById(characterId);
    if (!character) {
      return null;
    }

    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world || character.worldId !== world.id) {
      return null;
    }

    const scope = scopeFromAccessContext(ctx, world.id);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return null;
    }

    if (!isDm(ctx)) {
      if (!ctx.user || character.ownerUserId !== ctx.user.id) {
        return null;
      }

      if (character.pageId && !canViewWorldContent(ctx)) {
        return null;
      }
    }

    return toPortalCharacterView(character);
  }

  async updateCharacterForOwner(
    worldSlug: string,
    characterId: string,
    input: UpdateCharacterInput,
    ctx: AccessContext,
  ): Promise<PortalCharacterView | null> {
    if (ctx.previewAsUserId || ctx.worldMembership === null || !ctx.user) {
      return null;
    }

    const existing = await this.getCharacterForViewer(worldSlug, characterId, ctx);
    if (!existing || existing.ownerUserId !== ctx.user.id) {
      return null;
    }

    const updated = await this.characters.update(characterId, input);
    return updated ? toPortalCharacterView(updated) : null;
  }

  async updatePlayerCharacterBlockForViewer(
    worldSlug: string,
    pageSlug: string,
    blockId: string,
    content: string,
    ctx: AccessContext,
  ): Promise<PageWithBlocks | null> {
    const page = await this.db.page.findFirst({
      where: {
        slug: pageSlug,
        world: { slug: worldSlug },
      },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
        campaign: true,
      },
    });

    if (!page) {
      return null;
    }

    const block = page.contentBlocks.find((entry) => entry.id === blockId);
    if (!block) {
      return null;
    }

    if (!canEditPlayerCharacterBlock(ctx, page, block)) {
      return null;
    }

    // Der Spieler hat den Block ohne die DM-Bereiche zu sehen bekommen. Würde
    // sein Stand einfach überschreiben, wären die Notizen des DM beim ersten
    // Speichern weg — sie werden deshalb aus dem gespeicherten Stand
    // übernommen. Neue Marken aus dieser Eingabe verwirft `preserveDmSections`.
    await this.db.contentBlock.update({
      where: { id: blockId },
      data: { content: preserveDmSections(block.content, content.trim()) },
    });

    return this.getPageForViewer(worldSlug, pageSlug, ctx);
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
  canViewWorldContent,
  filterAssetsForViewer,
  filterBlocksForViewer,
  filterPagesForViewer,
  canCreatePlayerNote,
  canEditPlayerNote,
  canModeratePlayerNote,
  canViewPlayerNote,
  filterPlayerNotesForViewer,
  canEditPlayerCharacterBlock,
};
