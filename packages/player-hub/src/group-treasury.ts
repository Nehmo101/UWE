import type { AccessContext } from "@uwe/auth";
import { canReadWorld, isDm, scopeFromAccessContext } from "@uwe/auth";
import {
  DEFAULT_CURRENCIES,
  isInventoryItemDmOnly,
  toPlayerSafeInventoryItemView,
  type CurrencyLedger,
  type PlayerSafeInventoryItemView,
  type PrismaClient,
} from "@uwe/database/server";
import { createPlayerGroupService, type PlayerGroupView } from "./player-groups";

/**
 * Gruppenschatz aus Spielerhand.
 *
 * Bisher pflegte den Schatz nur der Spielleiter im Studio; das Portal durfte
 * Gegenstände zwischen Kammer und eigenem Charakter schieben, mehr nicht. Am
 * Tisch ist das die falsche Reihenfolge — Münzen und Beute fallen dort an, wo
 * die Spieler sitzen. Diese Schicht gibt der Runde Schreibrecht auf genau
 * ihren eigenen Schatz:
 *
 *   - Währungen (pp/gp/ep/sp/cp) direkt setzen,
 *   - eigene Gegenstände eintragen, ändern und wieder streichen,
 *   - eine gemeinsame Notiz führen.
 *
 * Die Grenze bleibt hart: geschrieben wird nur in den Schatz der eigenen
 * Gruppe, und ein vom Spielleiter versteckter Gegenstand (`properties.dmOnly`)
 * ist auch hier tabu — er taucht weder auf noch lässt er sich anfassen.
 */

/** Reihenfolge der Münzen, wie sie am Tisch gezählt werden. */
export const TREASURY_CURRENCIES = ["pp", "gp", "ep", "sp", "cp"] as const;
export type TreasuryCurrency = (typeof TREASURY_CURRENCIES)[number];

export const TREASURY_CURRENCY_LABELS: Record<TreasuryCurrency, string> = {
  pp: "Platin",
  gp: "Gold",
  ep: "Elektrum",
  sp: "Silber",
  cp: "Kupfer",
};

export interface GroupTreasuryView {
  /** `null`, solange noch nie jemand in diesen Schatz geschrieben hat. */
  treasuryId: string | null;
  name: string;
  notes: string;
  currencies: Record<TreasuryCurrency, number>;
  items: PlayerSafeInventoryItemView[];
  updatedAt: string | null;
}

export interface ViewerGroupTreasury {
  group: PlayerGroupView;
  treasury: GroupTreasuryView;
  /** Schreibrecht: Mitglied der Gruppe, keine Vorschau-Sitzung. */
  canEdit: boolean;
}

/** Liest eine beliebige JSON-Ablage als vollständige Münzbilanz. */
export function parseCurrencyLedger(raw: unknown): Record<TreasuryCurrency, number> {
  const ledger = { ...DEFAULT_CURRENCIES } as Record<string, number>;
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  for (const key of TREASURY_CURRENCIES) {
    const value = source[key];
    ledger[key] = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  return ledger as Record<TreasuryCurrency, number>;
}

export class GroupTreasuryService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Schatz einer Gruppe holen oder anlegen.
   *
   * `groupId` trägt einen UNIQUE-Index, das Anlegen ist also auch bei zwei
   * gleichzeitigen Aufrufen genau einmal erfolgreich; der Verlierer liest
   * danach den Gewinner. Deshalb der zweite Leseversuch im Fehlerfall statt
   * einer Sperre.
   */
  async getOrCreateForGroup(worldId: string, groupId: string) {
    const existing = await this.db.partyTreasury.findUnique({
      where: { groupId },
      include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    });
    if (existing) return existing;

    try {
      return await this.db.partyTreasury.create({
        data: {
          worldId,
          groupId,
          currencies: { ...DEFAULT_CURRENCIES } as unknown as CurrencyLedger,
        },
        include: { items: true },
      });
    } catch {
      const raced = await this.db.partyTreasury.findUnique({
        where: { groupId },
        include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
      });
      if (!raced) throw new Error("Gruppenschatz konnte nicht angelegt werden.");
      return raced;
    }
  }

  /** Welt aufloesen, Leserecht pruefen, Gruppe des Viewers finden. */
  private async resolveViewerGroup(worldSlug: string, ctx: AccessContext) {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, isSandbox: true },
    });
    if (!world || world.isSandbox) return null;

    const scope = scopeFromAccessContext(ctx, world.id);
    if (!canReadWorld(ctx.user, scope.world, scope)) return null;

    const viewerId = ctx.previewAsUserId ?? ctx.user?.id ?? null;
    if (!viewerId) return null;

    const group = await createPlayerGroupService(this.db).findForUser(world.id, viewerId);
    if (!group) return null;

    return { world, group };
  }

  /**
   * Der Schatz, den dieser Viewer im Portal sieht — samt Schreibrecht.
   *
   * `null` heißt: keine Welt, kein Leserecht oder keine Gruppe. Der Aufrufer
   * darf daraus keinen Fehler machen; „noch keiner Runde zugeordnet" ist ein
   * gültiger Zustand, den die Seite selbst erklärt.
   *
   * Der GET ist folgenlos: gibt es noch keinen Schatz-Datensatz, kommt eine
   * leere Kasse zurück, ohne dass eine Zeile entsteht. Angelegt wird erst
   * beim ersten Schreiben (dasselbe Prinzip wie bei den Terra-Karten: kein
   * Lazy-Bootstrap durch bloßes Hinsehen).
   */
  async getForViewer(worldSlug: string, ctx: AccessContext): Promise<ViewerGroupTreasury | null> {
    const resolved = await this.resolveViewerGroup(worldSlug, ctx);
    if (!resolved) return null;
    const { group } = resolved;

    const treasury = await this.db.partyTreasury.findUnique({
      where: { groupId: group.id },
      include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
    });

    // Vorschau-als-Spieler darf lesen, aber nichts anfassen: sonst schreibt
    // der Spielleiter unter fremdem Namen in die Bücher der Runde.
    const canEdit = Boolean(ctx.user) && !ctx.previewAsUserId && ctx.worldMembership !== null;

    if (!treasury) {
      return {
        group,
        treasury: {
          treasuryId: null,
          name: "Gruppenschatz",
          notes: "",
          currencies: parseCurrencyLedger(null),
          items: [],
          updatedAt: null,
        },
        canEdit,
      };
    }

    const staff = isDm(ctx);
    const items = staff ? treasury.items : treasury.items.filter((item) => !isInventoryItemDmOnly(item));

    const latest = items.reduce<Date>(
      (acc, item) => (item.updatedAt > acc ? item.updatedAt : acc),
      treasury.updatedAt,
    );

    return {
      group,
      treasury: {
        treasuryId: treasury.id,
        name: treasury.name,
        notes: treasury.notes,
        currencies: parseCurrencyLedger(treasury.currencies),
        items: items.map(toPlayerSafeInventoryItemView),
        updatedAt: latest.toISOString(),
      },
      canEdit,
    };
  }

  /**
   * Schreibzugang prüfen und den Schatz der eigenen Gruppe holen — hier, und
   * nur hier, wird er bei Bedarf angelegt.
   *
   * Jeder Schreibpfad geht hier durch — die Prüfung liegt bewusst nicht in den
   * Server Actions, sondern an der Stelle, die die Daten kennt.
   */
  private async requireWritableTreasury(worldSlug: string, ctx: AccessContext) {
    if (!ctx.user || ctx.previewAsUserId || ctx.worldMembership === null) return null;

    const resolved = await this.resolveViewerGroup(worldSlug, ctx);
    if (!resolved) return null;

    const treasury = await this.getOrCreateForGroup(resolved.world.id, resolved.group.id);
    return { group: resolved.group, treasury };
  }

  /** Münzbilanz der eigenen Gruppe setzen (absolute Werte, keine Differenz). */
  async updateCurrenciesForViewer(
    worldSlug: string,
    ctx: AccessContext,
    currencies: Partial<Record<TreasuryCurrency, number>>,
  ): Promise<boolean> {
    const resolved = await this.requireWritableTreasury(worldSlug, ctx);
    if (!resolved) return false;

    const next = parseCurrencyLedger(resolved.treasury.currencies);
    for (const key of TREASURY_CURRENCIES) {
      const value = currencies[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        next[key] = Math.max(0, Math.floor(value));
      }
    }

    await this.db.partyTreasury.update({
      where: { id: resolved.treasury.id },
      data: { currencies: next as unknown as CurrencyLedger },
    });
    return true;
  }

  /** Gemeinsame Notiz der Runde. */
  async updateNotesForViewer(
    worldSlug: string,
    ctx: AccessContext,
    notes: string,
  ): Promise<boolean> {
    const resolved = await this.requireWritableTreasury(worldSlug, ctx);
    if (!resolved) return false;

    await this.db.partyTreasury.update({
      where: { id: resolved.treasury.id },
      data: { notes: notes.slice(0, 4000) },
    });
    return true;
  }

  /** Gegenstand von Hand eintragen. */
  async addItemForViewer(
    worldSlug: string,
    ctx: AccessContext,
    input: { name: string; quantity?: number; notes?: string },
  ): Promise<boolean> {
    const resolved = await this.requireWritableTreasury(worldSlug, ctx);
    if (!resolved) return false;

    const name = input.name.trim();
    if (!name) return false;

    await this.db.inventoryItem.create({
      data: {
        worldId: resolved.group.worldId,
        treasuryId: resolved.treasury.id,
        name: name.slice(0, 200),
        quantity: Math.max(1, Math.floor(input.quantity ?? 1)),
        notes: (input.notes ?? "").slice(0, 2000),
      },
    });
    return true;
  }

  /** Menge, Name oder Notiz eines Gegenstands im eigenen Schatz ändern. */
  async updateItemForViewer(
    worldSlug: string,
    ctx: AccessContext,
    input: { itemId: string; name?: string; quantity?: number; notes?: string },
  ): Promise<boolean> {
    const resolved = await this.requireWritableTreasury(worldSlug, ctx);
    if (!resolved) return false;

    const item = await this.db.inventoryItem.findFirst({
      where: { id: input.itemId, treasuryId: resolved.treasury.id },
    });
    if (!item || isInventoryItemDmOnly(item)) return false;

    await this.db.inventoryItem.update({
      where: { id: item.id },
      data: {
        name: input.name?.trim() ? input.name.trim().slice(0, 200) : undefined,
        quantity:
          typeof input.quantity === "number" && Number.isFinite(input.quantity)
            ? Math.max(1, Math.floor(input.quantity))
            : undefined,
        notes: input.notes === undefined ? undefined : input.notes.slice(0, 2000),
      },
    });
    return true;
  }

  /** Gegenstand aus dem eigenen Schatz streichen. */
  async removeItemForViewer(
    worldSlug: string,
    ctx: AccessContext,
    itemId: string,
  ): Promise<boolean> {
    const resolved = await this.requireWritableTreasury(worldSlug, ctx);
    if (!resolved) return false;

    const item = await this.db.inventoryItem.findFirst({
      where: { id: itemId, treasuryId: resolved.treasury.id },
    });
    if (!item || isInventoryItemDmOnly(item)) return false;

    await this.db.inventoryItem.delete({ where: { id: item.id } });
    return true;
  }
}

export function createGroupTreasuryService(db: PrismaClient): GroupTreasuryService {
  return new GroupTreasuryService(db);
}
