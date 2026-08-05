import { pickUniqueSlug, slugifyDe } from "@uwe/shared-utils";
import type { PrismaClient } from "@uwe/database/server";

/**
 * Spielergruppen — die Tischrunde als eigene Ebene unter der Welt.
 *
 * Warum es das gibt: Welt-Zuordnung sagt, WAS jemand lesen darf. Sie sagt
 * nichts darüber, WEM ein Gruppenschatz gehört oder welche Quests die eigene
 * Runde angehen. Zwei Runden in derselben Welt teilten sich bisher zwangsweise
 * beides. Die Gruppe trennt das — und zwar ausschließlich das: sie ist kein
 * Recht, kein Häkchen und keine Rolle. Wer die Welt liest, liest sie weiter
 * ganz.
 *
 * Angelegt wird eine Gruppe nur im Studio. Das Portal liest sie und schreibt
 * höchstens in den Schatz, der an ihr hängt.
 */

/** Ein Mitglied, so wie die Studio-Verwaltung es anzeigt. */
export interface PlayerGroupMemberView {
  userId: string;
  displayName: string;
  email: string | null;
  /** Charaktername aus der Welt-Zuordnung — was am Tisch gerufen wird. */
  characterName: string | null;
}

export interface PlayerGroupView {
  id: string;
  worldId: string;
  campaignId: string | null;
  name: string;
  slug: string;
  description: string | null;
  members: PlayerGroupMemberView[];
  /** Gruppenschatz-Datensatz, falls schon einer angelegt wurde. */
  treasuryId: string | null;
  createdAt: Date;
}

export interface CreatePlayerGroupInput {
  worldId: string;
  name: string;
  description?: string | null;
  campaignId?: string | null;
  memberUserIds?: string[];
}

export interface UpdatePlayerGroupInput {
  name?: string;
  description?: string | null;
  campaignId?: string | null;
}

const GROUP_INCLUDE = {
  members: {
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  treasury: { select: { id: true } },
} as const;

type GroupRow = {
  id: string;
  worldId: string;
  campaignId: string | null;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  members: {
    userId: string;
    user: { id: string; displayName: string; email: string | null };
  }[];
  treasury: { id: string } | null;
};

export class PlayerGroupService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Alle Gruppen einer Welt, älteste zuerst.
   *
   * Der Charaktername kommt aus `WorldMembership` und wird in einem zweiten
   * Zug nachgeschlagen: er hängt an (Konto, Welt), nicht an der Gruppe, und
   * ließe sich sonst nur über einen Join durch drei Tabellen holen.
   */
  async listForWorld(worldId: string): Promise<PlayerGroupView[]> {
    const groups = (await this.db.playerGroup.findMany({
      where: { worldId },
      include: GROUP_INCLUDE,
      orderBy: { createdAt: "asc" },
    })) as unknown as GroupRow[];

    const characterNames = await this.characterNamesForWorld(worldId);
    return groups.map((group) => this.toView(group, characterNames));
  }

  async getById(worldId: string, groupId: string): Promise<PlayerGroupView | null> {
    const group = (await this.db.playerGroup.findFirst({
      where: { id: groupId, worldId },
      include: GROUP_INCLUDE,
    })) as unknown as GroupRow | null;
    if (!group) return null;

    return this.toView(group, await this.characterNamesForWorld(worldId));
  }

  /**
   * Die Gruppe eines Spielers in dieser Welt.
   *
   * Mehrere Gruppen pro Konto sind im Schema erlaubt (ein Wechsel soll keinen
   * Datensatz-Tanz brauchen). Das Portal muss sich trotzdem für genau eine
   * entscheiden — es nimmt die zuerst angelegte. Wer wirklich zwei Runden in
   * derselben Welt spielt, bekommt zwei Konten oder der Spielleiter räumt auf.
   */
  async findForUser(worldId: string, userId: string): Promise<PlayerGroupView | null> {
    const membership = await this.db.playerGroupMember.findFirst({
      where: { userId, group: { worldId } },
      orderBy: { group: { createdAt: "asc" } },
      select: { groupId: true },
    });
    if (!membership) return null;

    return this.getById(worldId, membership.groupId);
  }

  async create(input: CreatePlayerGroupInput): Promise<PlayerGroupView> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Die Gruppe braucht einen Namen.");
    }

    const existing = await this.db.playerGroup.findMany({
      where: { worldId: input.worldId },
      select: { slug: true },
    });
    const slug = pickUniqueSlug(
      slugifyDe(name, { fallback: "gruppe", maxLength: 60 }),
      existing.map((group) => group.slug),
      { fallback: "gruppe", maxLength: 60 },
    );

    const created = await this.db.playerGroup.create({
      data: {
        worldId: input.worldId,
        campaignId: input.campaignId ?? null,
        name,
        slug,
        description: input.description?.trim() || null,
      },
      select: { id: true },
    });

    if (input.memberUserIds?.length) {
      await this.setMembers(input.worldId, created.id, input.memberUserIds);
    }

    const view = await this.getById(input.worldId, created.id);
    if (!view) {
      throw new Error("Gruppe konnte nicht gelesen werden.");
    }
    return view;
  }

  async update(
    worldId: string,
    groupId: string,
    input: UpdatePlayerGroupInput,
  ): Promise<PlayerGroupView | null> {
    const group = await this.db.playerGroup.findFirst({
      where: { id: groupId, worldId },
      select: { id: true },
    });
    if (!group) return null;

    await this.db.playerGroup.update({
      where: { id: groupId },
      data: {
        name: input.name?.trim() || undefined,
        description:
          input.description === undefined ? undefined : input.description?.trim() || null,
        campaignId: input.campaignId === undefined ? undefined : input.campaignId || null,
      },
    });

    return this.getById(worldId, groupId);
  }

  /**
   * Gruppe löschen.
   *
   * Der Gruppenschatz geht per `ON DELETE CASCADE` mit — er ist der Besitz
   * genau dieser Runde. Quests verlieren nur ihre Zuordnung (`SET NULL`) und
   * fallen damit aus dem Portal-Questlog, bleiben im Studio aber unberührt.
   */
  async remove(worldId: string, groupId: string): Promise<boolean> {
    const result = await this.db.playerGroup.deleteMany({ where: { id: groupId, worldId } });
    return result.count > 0;
  }

  /** Ersetzt die Mitgliederliste; akzeptiert nur Konten mit Welt-Zuordnung. */
  async setMembers(worldId: string, groupId: string, userIds: string[]): Promise<void> {
    const group = await this.db.playerGroup.findFirst({
      where: { id: groupId, worldId },
      select: { id: true },
    });
    if (!group) {
      throw new Error("Gruppe nicht gefunden.");
    }

    // Ohne Welt-Zuordnung keine Gruppe: sonst hinge ein Schatz an jemandem,
    // der die Welt gar nicht lesen darf.
    const allowed = await this.db.worldMembership.findMany({
      where: { worldId, userId: { in: userIds } },
      select: { userId: true },
    });
    const allowedIds = new Set(allowed.map((row) => row.userId));

    await this.db.$transaction([
      this.db.playerGroupMember.deleteMany({ where: { groupId } }),
      ...[...allowedIds].map((userId) =>
        this.db.playerGroupMember.create({ data: { groupId, userId } }),
      ),
    ]);
  }

  /**
   * Quest einer Gruppe zuordnen (Kampagnen-Radar im Studio).
   *
   * `null` nimmt die Zuordnung zurück — die Quest verschwindet dann wieder aus
   * jedem Portal-Questlog. Die Gruppe muss zur selben Welt gehören wie die
   * Seite; sonst könnte eine fremde Runde eine Quest an sich ziehen.
   */
  async assignQuest(
    worldId: string,
    pageId: string,
    groupId: string | null,
  ): Promise<boolean> {
    if (groupId) {
      const group = await this.db.playerGroup.findFirst({
        where: { id: groupId, worldId },
        select: { id: true },
      });
      if (!group) {
        throw new Error("Gruppe gehört nicht zu dieser Welt.");
      }
    }

    const result = await this.db.page.updateMany({
      where: { id: pageId, worldId, type: "quest" },
      data: { questGroupId: groupId },
    });
    return result.count > 0;
  }

  private async characterNamesForWorld(worldId: string): Promise<Map<string, string | null>> {
    const memberships = await this.db.worldMembership.findMany({
      where: { worldId },
      select: { userId: true, characterName: true },
    });
    return new Map(memberships.map((row) => [row.userId, row.characterName]));
  }

  private toView(group: GroupRow, characterNames: Map<string, string | null>): PlayerGroupView {
    return {
      id: group.id,
      worldId: group.worldId,
      campaignId: group.campaignId,
      name: group.name,
      slug: group.slug,
      description: group.description,
      treasuryId: group.treasury?.id ?? null,
      createdAt: group.createdAt,
      members: group.members.map((member) => ({
        userId: member.user.id,
        displayName: member.user.displayName,
        email: member.user.email,
        characterName: characterNames.get(member.user.id) ?? null,
      })),
    };
  }
}

export function createPlayerGroupService(db: PrismaClient): PlayerGroupService {
  return new PlayerGroupService(db);
}
