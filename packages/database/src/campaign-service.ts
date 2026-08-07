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
  /** Bände einer Welt, die sich zu einer Kampagne machen lassen. */
  listVolumeCandidates(worldSlug: string): Promise<VolumeCandidate[]>;
  /** Aus einem Band eine Kampagne machen — samt der Dungeons, die dazugehören. */
  createFromVolume(input: CreateFromVolumeInput): Promise<CreateFromVolumeResult>;
  /** Einen vorhandenen Band nachträglich einer Kampagne zuschlagen. */
  attachVolume(input: AttachVolumeInput): Promise<{ assigned: number }>;
}

/** Ein Band: eine Seite ohne Elternteil, die Unterseiten trägt. */
export interface VolumeCandidate {
  pageId: string;
  title: string;
  slug: string;
  type: string;
  /** Wie viele Seiten unter ihr hängen, über alle Ebenen. */
  pageCount: number;
  /** `dungeon` — ein Band, der als Dungeon zugeordnet werden kann. */
  isDungeon: boolean;
  campaignId: string | null;
  campaignName: string | null;
}

export interface CreateFromVolumeInput {
  worldSlug: string;
  /** Wurzelseite des Bandes. */
  volumePageId: string;
  /** Ohne Angabe: der Titel des Bandes. */
  name?: string;
  description?: string | null;
  /** Wurzelseiten der Dungeon-Bände, die zu dieser Kampagne gehören. */
  dungeonPageIds?: string[];
}

export interface CreateFromVolumeResult {
  id: string;
  slug: string;
  name: string;
  /** Seiten, die der Kampagne zugeordnet wurden — Band plus Dungeons. */
  assigned: number;
  dungeonsAttached: number;
}

export interface AttachVolumeInput {
  worldSlug: string;
  campaignId: string;
  volumePageId: string;
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

    async listVolumeCandidates(worldSlug) {
      const world = await requireWorld(worldSlug);
      const pages = await ladeSeitenbaum(db, world.id);
      const kinder = kinderIndex(pages);

      return pages
        .filter((page) => !page.parentPageId && (kinder.get(page.id)?.length ?? 0) > 0)
        .map((page) => ({
          pageId: page.id,
          title: page.title,
          slug: page.slug,
          type: page.type,
          pageCount: nachkommen(page.id, kinder).length + 1,
          isDungeon: page.type === "dungeon",
          campaignId: page.campaignId,
          campaignName: page.campaignName,
        }))
        .sort((a, b) => b.pageCount - a.pageCount);
    },

    async createFromVolume({ worldSlug, volumePageId, name, description, dungeonPageIds }) {
      const world = await requireWorld(worldSlug);
      const pages = await ladeSeitenbaum(db, world.id);
      const kinder = kinderIndex(pages);
      const band = pages.find((page) => page.id === volumePageId);

      if (!band) throw new CampaignServiceError("Diesen Band gibt es in dieser Welt nicht.");
      if (band.parentPageId) {
        throw new CampaignServiceError(
          `„${band.title}" ist kein Band, sondern eine Unterseite. Nimm die oberste Seite des Buchs.`,
        );
      }

      const cleanName = parseName(name?.trim() ? name : band.title);
      const duplicate = await db.campaign.findFirst({
        where: { worldId: world.id, name: cleanName },
        select: { id: true },
      });
      if (duplicate) {
        throw new CampaignServiceError(`„${cleanName}" gibt es in dieser Welt bereits.`);
      }

      const dungeons = (dungeonPageIds ?? []).map((id) => {
        const page = pages.find((entry) => entry.id === id);
        if (!page) throw new CampaignServiceError("Ein ausgewählter Dungeon gehört nicht zu dieser Welt.");
        if (page.parentPageId) {
          throw new CampaignServiceError(
            `„${page.title}" ist kein eigener Dungeon-Band, sondern hängt unter einer anderen Seite.`,
          );
        }
        return page;
      });

      const campaign = await db.campaign.create({
        data: {
          worldId: world.id,
          name: cleanName,
          slug: await pickSlug(world.id, cleanName),
          description: parseDescription(description),
        },
      });

      let assigned = await zuordnen(db, band.id, kinder, campaign.id);
      for (const dungeon of dungeons) {
        assigned += await zuordnen(db, dungeon.id, kinder, campaign.id);
      }

      return {
        id: campaign.id,
        slug: campaign.slug,
        name: campaign.name,
        assigned,
        dungeonsAttached: dungeons.length,
      };
    },

    async attachVolume({ worldSlug, campaignId, volumePageId }) {
      const world = await requireWorld(worldSlug);
      const campaign = await requireCampaign(world.id, campaignId);
      const pages = await ladeSeitenbaum(db, world.id);
      const kinder = kinderIndex(pages);
      const band = pages.find((page) => page.id === volumePageId);

      if (!band) throw new CampaignServiceError("Diesen Band gibt es in dieser Welt nicht.");
      if (band.parentPageId) {
        throw new CampaignServiceError(
          `„${band.title}" ist kein Band, sondern eine Unterseite. Nimm die oberste Seite.`,
        );
      }

      return { assigned: await zuordnen(db, band.id, kinder, campaign.id) };
    },
  };
}

interface BaumSeite {
  id: string;
  parentPageId: string | null;
  title: string;
  slug: string;
  type: string;
  campaignId: string | null;
  campaignName: string | null;
}

/**
 * Der Seitenbaum der Welt, flach.
 *
 * Nur Skalare: Ein `include` über eine Welt mit tausend Seiten sprengt bei
 * SQLite den Parameterrahmen — derselbe Grund wie bei
 * `listPagesWithBlocksForGraphUnfiltered`.
 */
async function ladeSeitenbaum(db: PrismaClient, worldId: string): Promise<BaumSeite[]> {
  const rows = await db.page.findMany({
    where: { worldId },
    select: {
      id: true,
      parentPageId: true,
      title: true,
      slug: true,
      type: true,
      campaignId: true,
      campaign: { select: { name: true } },
    },
    orderBy: [{ sortIndex: "asc" }, { title: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    parentPageId: row.parentPageId,
    title: row.title,
    slug: row.slug,
    type: row.type,
    campaignId: row.campaignId,
    campaignName: row.campaign?.name ?? null,
  }));
}

function kinderIndex(pages: BaumSeite[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const page of pages) {
    if (!page.parentPageId) continue;
    const bucket = index.get(page.parentPageId);
    if (bucket) bucket.push(page.id);
    else index.set(page.parentPageId, [page.id]);
  }
  return index;
}

/**
 * Alle Nachkommen einer Seite.
 *
 * Mit einer Besuchsliste, nicht rekursiv ohne Schutz: Ein Zyklus im Baum — durch
 * einen misslungenen Umzug etwa — würde die Funktion sonst nie beenden.
 */
function nachkommen(rootId: string, kinder: Map<string, string[]>): string[] {
  const raus: string[] = [];
  const gesehen = new Set<string>([rootId]);
  const offen = [...(kinder.get(rootId) ?? [])];

  while (offen.length > 0) {
    const id = offen.pop()!;
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    raus.push(id);
    offen.push(...(kinder.get(id) ?? []));
  }

  return raus;
}

/** Höchstens so viele IDs je `IN (…)` — siehe `PAGE_ID_BATCH` im Repository. */
const ZUORDNUNG_BATCH = 500;

async function zuordnen(
  db: PrismaClient,
  rootId: string,
  kinder: Map<string, string[]>,
  campaignId: string,
): Promise<number> {
  const ids = [rootId, ...nachkommen(rootId, kinder)];
  let n = 0;
  for (let from = 0; from < ids.length; from += ZUORDNUNG_BATCH) {
    const result = await db.page.updateMany({
      where: { id: { in: ids.slice(from, from + ZUORDNUNG_BATCH) } },
      data: { campaignId },
    });
    n += result.count;
  }
  return n;
}
