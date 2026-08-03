import { pickUniqueSlug, slugifyDe } from "@uwe/shared-utils/slug";
import type { PrismaClient } from "./client";

/**
 * Kampagnen-Verwaltung: anlegen, umbenennen, löschen.
 *
 * Kampagnen entstanden bisher nur im Seed und beim Doc-Import (der eine
 * bestehende Kampagne über ihren Namen *auflöst*, aber keine anlegt) — in der
 * Oberfläche war die Kampagne ein Filter ohne Quelle. Diese Datei ist die
 * fehlende Schreibseite dazu.
 *
 * Bewusst eine eigene Datei mit Subpath-Export (`@uwe/database/campaign`)
 * statt eines Anbaus an `repository.ts`/`server.ts`: beide sind eingefrorene
 * Baselines (siehe CLAUDE.md, Modul-Disziplin).
 *
 * **Zum Löschen.** Die Fremdschlüssel der Kampagne sind nicht einheitlich:
 * Seiten, Sessions, Assets, Labels, Print-Listen, Soundboard-Knöpfe,
 * Brain-Dokumente/-Fakten und Charaktere hängen mit `onDelete: SetNull` daran
 * und überleben die Kampagne als weltweite Inhalte. `PlayerNote.campaignId` ist
 * dagegen NOT NULL mit `onDelete: Cascade` — Spielernotizen der Kampagne werden
 * mitgelöscht. Deshalb verlangt {@link deleteCampaign} den Namen als Bestätigung
 * und {@link listCampaignOverview} liefert die Zahlen, die im Formular stehen.
 */

export interface CampaignOverviewEntry {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  counts: {
    pages: number;
    gameSessions: number;
    assets: number;
    /** Wird beim Löschen mit entfernt (Cascade). */
    playerNotes: number;
    characters: number;
  };
}

export interface CampaignService {
  listOverview(worldSlug: string): Promise<CampaignOverviewEntry[]>;
  create(input: CreateCampaignInput): Promise<{ id: string; slug: string }>;
  rename(input: RenameCampaignInput): Promise<{ id: string; slug: string }>;
  remove(input: DeleteCampaignInput): Promise<{ id: string }>;
}

export interface CreateCampaignInput {
  worldSlug: string;
  name: string;
  description?: string | null;
}

export interface RenameCampaignInput {
  worldSlug: string;
  campaignId: string;
  name: string;
  description?: string | null;
}

export interface DeleteCampaignInput {
  worldSlug: string;
  campaignId: string;
  /** Muss dem aktuellen Namen entsprechen — Schutz vor dem Fehlklick. */
  expectedName: string;
}

/** Fehler mit einer Meldung, die direkt in der Oberfläche stehen darf. */
export class CampaignServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignServiceError";
  }
}

const NAME_MAX_LENGTH = 120;
const SLUG_MAX_LENGTH = 80;

function parseName(raw: string): string {
  const name = raw.trim();
  if (!name) {
    throw new CampaignServiceError("Der Kampagnen-Name darf nicht leer sein.");
  }
  if (name.length > NAME_MAX_LENGTH) {
    throw new CampaignServiceError(
      `Der Kampagnen-Name ist zu lang (max. ${NAME_MAX_LENGTH} Zeichen).`,
    );
  }
  return name;
}

function parseDescription(raw: string | null | undefined): string | null {
  const description = (raw ?? "").trim();
  return description || null;
}

export function createCampaignService(db: PrismaClient): CampaignService {
  async function requireWorld(worldSlug: string) {
    const world = await db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) {
      throw new CampaignServiceError(`Welt „${worldSlug}" wurde nicht gefunden.`);
    }
    return world;
  }

  async function requireCampaign(worldId: string, campaignId: string) {
    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.worldId !== worldId) {
      throw new CampaignServiceError("Diese Kampagne gehört nicht zu dieser Welt.");
    }
    return campaign;
  }

  /**
   * Freier Slug innerhalb der Welt. `@@unique([worldId, slug])` erlaubt denselben
   * Slug in einer anderen Welt, deshalb wird nur weltweit verglichen.
   */
  async function pickSlug(worldId: string, name: string, keepCampaignId?: string) {
    const taken = (
      await db.campaign.findMany({ where: { worldId }, select: { id: true, slug: true } })
    )
      .filter((entry) => entry.id !== keepCampaignId)
      .map((entry) => entry.slug);

    return pickUniqueSlug(
      slugifyDe(name, { maxLength: SLUG_MAX_LENGTH, fallback: "kampagne" }),
      taken,
      { maxLength: SLUG_MAX_LENGTH, fallback: "kampagne" },
    );
  }

  return {
    async listOverview(worldSlug) {
      const world = await db.world.findUnique({ where: { slug: worldSlug } });
      if (!world) return [];

      const campaigns = await db.campaign.findMany({
        where: { worldId: world.id },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              pages: true,
              gameSessions: true,
              assets: true,
              playerNotes: true,
              characters: true,
            },
          },
        },
      });

      return campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        description: campaign.description,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        counts: {
          pages: campaign._count.pages,
          gameSessions: campaign._count.gameSessions,
          assets: campaign._count.assets,
          playerNotes: campaign._count.playerNotes,
          characters: campaign._count.characters,
        },
      }));
    },

    async create({ worldSlug, name, description }) {
      const world = await requireWorld(worldSlug);
      const cleanName = parseName(name);

      const duplicate = await db.campaign.findFirst({
        where: { worldId: world.id, name: cleanName },
        select: { id: true },
      });
      if (duplicate) {
        throw new CampaignServiceError(`„${cleanName}" gibt es in dieser Welt bereits.`);
      }

      const campaign = await db.campaign.create({
        data: {
          worldId: world.id,
          name: cleanName,
          slug: await pickSlug(world.id, cleanName),
          description: parseDescription(description),
        },
      });

      return { id: campaign.id, slug: campaign.slug };
    },

    async rename({ worldSlug, campaignId, name, description }) {
      const world = await requireWorld(worldSlug);
      const campaign = await requireCampaign(world.id, campaignId);
      const cleanName = parseName(name);

      const duplicate = await db.campaign.findFirst({
        where: { worldId: world.id, name: cleanName, id: { not: campaign.id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new CampaignServiceError(`„${cleanName}" gibt es in dieser Welt bereits.`);
      }

      // Der Slug steht in jedem `?campaign=`-Link und in den Backup-Manifesten.
      // Er wandert deshalb nur mit, wenn er noch der alte Auto-Slug war — ein
      // von Hand gepflegter oder importierter Slug bleibt, wo er ist.
      const autoSlug = slugifyDe(campaign.name, {
        maxLength: SLUG_MAX_LENGTH,
        fallback: "kampagne",
      });
      const slug =
        campaign.slug === autoSlug ? await pickSlug(world.id, cleanName, campaign.id) : campaign.slug;

      const updated = await db.campaign.update({
        where: { id: campaign.id },
        data: { name: cleanName, slug, description: parseDescription(description) },
      });

      return { id: updated.id, slug: updated.slug };
    },

    async remove({ worldSlug, campaignId, expectedName }) {
      const world = await requireWorld(worldSlug);
      const campaign = await requireCampaign(world.id, campaignId);

      if (expectedName.trim() !== campaign.name) {
        throw new CampaignServiceError(
          `Zum Löschen muss der Name exakt eingetragen werden: „${campaign.name}".`,
        );
      }

      await db.campaign.delete({ where: { id: campaign.id } });
      return { id: campaign.id };
    },
  };
}
