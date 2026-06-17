import type { PrismaClient } from "./client";
import { slugifyMailKey } from "./mail-utils";

export interface MailRecipientView {
  id: string;
  email: string;
  name: string;
  userId: string | null;
}

export interface MailRecipientGroupView {
  id: string;
  worldId: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  recipients: MailRecipientView[];
  updatedAt: Date;
}

export interface MailPlayerContact {
  userId: string;
  displayName: string;
  email: string;
  characterName: string | null;
}

function toRecipientView(record: {
  id: string;
  email: string;
  name: string;
  userId: string | null;
}): MailRecipientView {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    userId: record.userId,
  };
}

export class MailRecipientService {
  constructor(private readonly db: PrismaClient) {}

  async listWorldPlayerContacts(worldSlug: string): Promise<MailPlayerContact[]> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });

    if (!world) {
      return [];
    }

    const memberships = await this.db.worldMembership.findMany({
      where: {
        worldId: world.id,
        role: "player",
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: [{ user: { displayName: "asc" } }],
    });

    return memberships
      .filter((membership) => Boolean(membership.user.email?.trim()))
      .map((membership) => ({
        userId: membership.user.id,
        displayName: membership.user.displayName,
        email: membership.user.email!.trim(),
        characterName: membership.characterName,
      }));
  }

  async ensurePlayersGroup(worldSlug: string): Promise<MailRecipientGroupView> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, name: true },
    });

    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    let group = await this.db.mailRecipientGroup.findUnique({
      where: {
        worldId_slug: {
          worldId: world.id,
          slug: "players",
        },
      },
      include: { recipients: true },
    });

    if (!group) {
      group = await this.db.mailRecipientGroup.create({
        data: {
          worldId: world.id,
          slug: "players",
          name: "Spieler",
          description: `Spieler der Welt „${world.name}" mit hinterlegter E-Mail.`,
          isSystem: true,
        },
        include: { recipients: true },
      });
    }

    const contacts = await this.listWorldPlayerContacts(worldSlug);
    const existingEmails = new Set(group.recipients.map((recipient) => recipient.email.toLowerCase()));

    for (const contact of contacts) {
      if (!existingEmails.has(contact.email.toLowerCase())) {
        await this.db.mailRecipient.create({
          data: {
            groupId: group.id,
            email: contact.email,
            name: contact.characterName?.trim() || contact.displayName,
            userId: contact.userId,
          },
        });
      }
    }

    const refreshed = await this.db.mailRecipientGroup.findUniqueOrThrow({
      where: { id: group.id },
      include: { recipients: { orderBy: { name: "asc" } } },
    });

    return {
      id: refreshed.id,
      worldId: refreshed.worldId,
      slug: refreshed.slug,
      name: refreshed.name,
      description: refreshed.description,
      isSystem: refreshed.isSystem,
      recipients: refreshed.recipients.map(toRecipientView),
      updatedAt: refreshed.updatedAt,
    };
  }

  async listGroups(worldSlug: string): Promise<MailRecipientGroupView[]> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });

    if (!world) {
      return [];
    }

    const groups = await this.db.mailRecipientGroup.findMany({
      where: { worldId: world.id },
      include: { recipients: { orderBy: { name: "asc" } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    return groups.map((group) => ({
      id: group.id,
      worldId: group.worldId,
      slug: group.slug,
      name: group.name,
      description: group.description,
      isSystem: group.isSystem,
      recipients: group.recipients.map(toRecipientView),
      updatedAt: group.updatedAt,
    }));
  }

  async createGroup(
    worldSlug: string,
    input: { name: string; description?: string; slug?: string },
  ): Promise<MailRecipientGroupView> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });

    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    const slug = input.slug?.trim() || slugifyMailKey(input.name, "group");
    const group = await this.db.mailRecipientGroup.create({
      data: {
        worldId: world.id,
        slug,
        name: input.name.trim(),
        description: input.description?.trim() ?? "",
        isSystem: false,
      },
      include: { recipients: true },
    });

    return {
      id: group.id,
      worldId: group.worldId,
      slug: group.slug,
      name: group.name,
      description: group.description,
      isSystem: group.isSystem,
      recipients: [],
      updatedAt: group.updatedAt,
    };
  }

  async addRecipient(
    worldSlug: string,
    groupSlug: string,
    input: { email: string; name?: string; userId?: string },
  ): Promise<MailRecipientGroupView> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });

    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    const group = await this.db.mailRecipientGroup.findUnique({
      where: { worldId_slug: { worldId: world.id, slug: groupSlug } },
    });

    if (!group) {
      throw new Error("Empfängergruppe nicht gefunden.");
    }

    const email = input.email.trim().toLowerCase();
    if (!email.includes("@")) {
      throw new Error("Ungültige E-Mail-Adresse.");
    }

    await this.db.mailRecipient.upsert({
      where: {
        groupId_email: {
          groupId: group.id,
          email,
        },
      },
      create: {
        groupId: group.id,
        email,
        name: input.name?.trim() ?? "",
        userId: input.userId ?? null,
      },
      update: {
        name: input.name?.trim() ?? undefined,
        userId: input.userId ?? undefined,
      },
    });

    const refreshed = await this.db.mailRecipientGroup.findUniqueOrThrow({
      where: { id: group.id },
      include: { recipients: { orderBy: { name: "asc" } } },
    });

    return {
      id: refreshed.id,
      worldId: refreshed.worldId,
      slug: refreshed.slug,
      name: refreshed.name,
      description: refreshed.description,
      isSystem: refreshed.isSystem,
      recipients: refreshed.recipients.map(toRecipientView),
      updatedAt: refreshed.updatedAt,
    };
  }
}

export function createMailRecipientService(db: PrismaClient): MailRecipientService {
  return new MailRecipientService(db);
}
