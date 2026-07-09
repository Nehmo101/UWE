import type { AccessContext } from "@uwe/auth";
import {
  canReadWorld,
  canViewPage,
  isWorldStaff,
  scopeFromAccessContext,
} from "@uwe/auth";
import type { InventoryItem, Prisma, PrismaClient } from "./generated/prisma/client";

export type CurrencyLedger = Record<string, number>;

export const DEFAULT_CURRENCIES: CurrencyLedger = {
  cp: 0,
  sp: 0,
  ep: 0,
  gp: 0,
  pp: 0,
};

export interface UpsertPartyTreasuryInput {
  worldId: string;
  name?: string;
  currencies?: CurrencyLedger;
  notes?: string;
}

export interface CreateInventoryItemInput {
  worldId: string;
  name: string;
  characterId?: string | null;
  treasuryId?: string | null;
  pageId?: string | null;
  quantity?: number;
  weight?: number | null;
  value?: Prisma.InputJsonValue;
  properties?: Prisma.InputJsonValue;
  notes?: string;
  sortOrder?: number;
}

/**
 * Player-safe Sicht auf ein Inventar-Item: keine `properties` (dort liegen
 * DM-Notizen und DM-Flags), keine Seiten-Verknüpfung.
 */
export interface PlayerSafeInventoryItemView {
  id: string;
  name: string;
  quantity: number;
  weight: number | null;
  value: unknown;
  notes: string;
  sortOrder: number;
  /** Für Staff-Ansichten; nach Player-Filterung immer false. */
  dmOnly: boolean;
}

export interface PortalTreasuryView {
  /** null, solange noch kein Treasury-Datensatz existiert. */
  id: string | null;
  name: string;
  currencies: unknown;
  notes: string;
  items: PlayerSafeInventoryItemView[];
  updatedAt: string | null;
}

export interface MovePartyItemForViewerInput {
  itemId: string;
  /** Ziel-Charakter (muss dem Viewer gehören); null/undefined = zurück in die Schatzkammer. */
  targetCharacterId?: string | null;
}

type InventoryItemDmFields = Pick<InventoryItem, "properties">;

function propertiesRecord(item: InventoryItemDmFields): Record<string, unknown> | null {
  const properties = item.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return null;
  }
  return properties as Record<string, unknown>;
}

/** DM-only Items (versteckte Artefakte) werden über `properties.dmOnly === true` markiert. */
export function isInventoryItemDmOnly(item: InventoryItemDmFields): boolean {
  return propertiesRecord(item)?.dmOnly === true;
}

/** DM-Notizen liegen in `properties.dmNotes` und werden nie an Spieler ausgeliefert. */
export function getInventoryItemDmNotes(item: InventoryItemDmFields): string | null {
  const dmNotes = propertiesRecord(item)?.dmNotes;
  return typeof dmNotes === "string" && dmNotes.trim().length > 0 ? dmNotes : null;
}

export function toPlayerSafeInventoryItemView(item: InventoryItem): PlayerSafeInventoryItemView {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    weight: item.weight,
    value: item.value ?? null,
    notes: item.notes,
    sortOrder: item.sortOrder,
    dmOnly: isInventoryItemDmOnly(item),
  };
}

const PAGE_ACCESS_SELECT = {
  id: true,
  visibility: true,
  publishStatus: true,
  secretLevel: true,
  revealState: true,
} as const;

export class PartyTreasuryService {
  constructor(private readonly db: PrismaClient) {}

  private async resolveWorldIdForViewer(worldSlug: string): Promise<string | null> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, isSandbox: true },
    });
    if (!world || world.isSandbox) {
      return null;
    }
    return world.id;
  }

  private async isItemPagePlayerVisible(
    ctx: AccessContext,
    pageId: string | null,
  ): Promise<boolean> {
    if (!pageId) {
      return true;
    }
    const page = await this.db.page.findUnique({
      where: { id: pageId },
      select: PAGE_ACCESS_SELECT,
    });
    return page ? canViewPage(ctx, page) : false;
  }

  /** Player-safe Filter: dm_only-Items und Items mit nicht sichtbarer verlinkter Seite fliegen raus. */
  private async filterItemsForPlayer(
    ctx: AccessContext,
    items: InventoryItem[],
  ): Promise<InventoryItem[]> {
    const candidates = items.filter((item) => !isInventoryItemDmOnly(item));
    const pageIds = [
      ...new Set(
        candidates
          .map((item) => item.pageId)
          .filter((pageId): pageId is string => Boolean(pageId)),
      ),
    ];

    if (pageIds.length === 0) {
      return candidates;
    }

    const pages = await this.db.page.findMany({
      where: { id: { in: pageIds } },
      select: PAGE_ACCESS_SELECT,
    });
    const pageById = new Map(pages.map((page) => [page.id, page]));

    return candidates.filter((item) => {
      if (!item.pageId) {
        return true;
      }
      const page = pageById.get(item.pageId);
      return page ? canViewPage(ctx, page) : false;
    });
  }

  /**
   * Gruppenschatz für Portal-Viewer: Welt-Leserecht wird geprüft, der Schatz ist
   * Spieler-Inhalt (wie `player_visible`) — Gäste sehen ihn nicht. Nicht-Staff
   * erhält nur player-safe gefilterte Items ohne `properties`.
   */
  async getForViewer(worldSlug: string, ctx: AccessContext): Promise<PortalTreasuryView | null> {
    const worldId = await this.resolveWorldIdForViewer(worldSlug);
    if (!worldId) {
      return null;
    }

    const scope = scopeFromAccessContext(ctx, worldId);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return null;
    }

    const staff = isWorldStaff(ctx);
    if (!staff && ctx.effectiveRole !== "player") {
      return null;
    }

    const treasury = await this.getByWorldId(worldId);
    if (!treasury) {
      return {
        id: null,
        name: "Gruppenschatz",
        currencies: DEFAULT_CURRENCIES,
        notes: "",
        items: [],
        updatedAt: null,
      };
    }

    const items = staff ? treasury.items : await this.filterItemsForPlayer(ctx, treasury.items);

    const itemUpdatedAt = items.reduce<Date | null>((latest, item) => {
      if (!latest || item.updatedAt > latest) {
        return item.updatedAt;
      }
      return latest;
    }, null);
    const updatedAt = itemUpdatedAt && itemUpdatedAt > treasury.updatedAt
      ? itemUpdatedAt
      : treasury.updatedAt;

    return {
      id: treasury.id,
      name: treasury.name,
      currencies: treasury.currencies,
      notes: treasury.notes,
      items: items.map(toPlayerSafeInventoryItemView),
      updatedAt: updatedAt.toISOString(),
    };
  }

  /**
   * Charakter-Inventar für Portal-Viewer: nur Staff oder der Charakter-Eigentümer.
   * Nicht-Staff sieht keine dm_only-Items und keine `properties`.
   */
  async listItemsForCharacterForViewer(
    worldSlug: string,
    characterId: string,
    ctx: AccessContext,
  ): Promise<PlayerSafeInventoryItemView[] | null> {
    const worldId = await this.resolveWorldIdForViewer(worldSlug);
    if (!worldId) {
      return null;
    }

    const scope = scopeFromAccessContext(ctx, worldId);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return null;
    }

    const character = await this.db.character.findUnique({
      where: { id: characterId },
      select: { id: true, worldId: true, ownerUserId: true },
    });
    if (!character || character.worldId !== worldId) {
      return null;
    }

    const staff = isWorldStaff(ctx);
    if (!staff && (!ctx.user || character.ownerUserId !== ctx.user.id)) {
      return null;
    }

    const items = await this.listItemsForCharacter(characterId);
    const visible = staff ? items : items.filter((item) => !isInventoryItemDmOnly(item));
    return visible.map(toPlayerSafeInventoryItemView);
  }

  async getByWorldId(worldId: string) {
    return this.db.partyTreasury.findUnique({
      where: { worldId },
      include: {
        items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      },
    });
  }

  async getOrCreateForWorld(worldId: string) {
    const existing = await this.getByWorldId(worldId);
    if (existing) {
      return existing;
    }
    return this.db.partyTreasury.create({
      data: {
        worldId,
        currencies: DEFAULT_CURRENCIES as unknown as Prisma.InputJsonValue,
      },
      include: { items: true },
    });
  }

  async upsert(input: UpsertPartyTreasuryInput) {
    const currencies = input.currencies ?? DEFAULT_CURRENCIES;
    return this.db.partyTreasury.upsert({
      where: { worldId: input.worldId },
      create: {
        worldId: input.worldId,
        name: input.name ?? "Gruppenschatz",
        currencies: currencies as unknown as Prisma.InputJsonValue,
        notes: input.notes ?? "",
      },
      update: {
        name: input.name,
        currencies: input.currencies
          ? (input.currencies as unknown as Prisma.InputJsonValue)
          : undefined,
        notes: input.notes,
      },
    });
  }

  async addItem(input: CreateInventoryItemInput) {
    if (!input.characterId && !input.treasuryId) {
      throw new Error("Inventar-Item braucht characterId oder treasuryId.");
    }
    if (input.characterId && input.treasuryId) {
      throw new Error("Inventar-Item darf nicht gleichzeitig Charakter- und Gruppenschatz sein.");
    }

    return this.db.inventoryItem.create({
      data: {
        worldId: input.worldId,
        characterId: input.characterId ?? null,
        treasuryId: input.treasuryId ?? null,
        pageId: input.pageId ?? null,
        name: input.name,
        quantity: input.quantity ?? 1,
        weight: input.weight ?? null,
        value: input.value,
        properties: input.properties,
        notes: input.notes ?? "",
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async listItemsForCharacter(characterId: string) {
    return this.db.inventoryItem.findMany({
      where: { characterId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async listItemsForTreasury(treasuryId: string) {
    return this.db.inventoryItem.findMany({
      where: { treasuryId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  /** Alle aktuell von Charakteren getragenen Items einer Welt (Studio-Übersicht). */
  async listItemsHeldByCharacters(worldId: string) {
    return this.db.inventoryItem.findMany({
      where: { worldId, characterId: { not: null } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { character: { select: { id: true, displayName: true } } },
    });
  }

  /** DM-Pfad: Item (Schatzkammer oder anderer Charakter) einem Charakter derselben Welt zuweisen. */
  async moveItemToCharacter(worldId: string, itemId: string, characterId: string) {
    const item = await this.db.inventoryItem.findFirst({
      where: { id: itemId, worldId },
      select: { id: true },
    });
    if (!item) {
      throw new Error("Inventar-Item nicht gefunden.");
    }

    const character = await this.db.character.findFirst({
      where: { id: characterId, worldId },
      select: { id: true },
    });
    if (!character) {
      throw new Error("Charakter nicht gefunden.");
    }

    return this.db.inventoryItem.update({
      where: { id: itemId },
      data: { characterId: character.id, treasuryId: null },
    });
  }

  /** DM-Pfad: Item zurück in die Schatzkammer der Welt legen. */
  async moveItemToTreasury(worldId: string, itemId: string) {
    const item = await this.db.inventoryItem.findFirst({
      where: { id: itemId, worldId },
      select: { id: true },
    });
    if (!item) {
      throw new Error("Inventar-Item nicht gefunden.");
    }

    const treasury = await this.getOrCreateForWorld(worldId);
    return this.db.inventoryItem.update({
      where: { id: itemId },
      data: { treasuryId: treasury.id, characterId: null },
    });
  }

  /**
   * Portal-Pfad: Spieler bewegen Items nur zwischen Schatzkammer und EIGENEM Charakter.
   * DM-only-Items und versteckte Artefakte (nicht sichtbare verlinkte Seite) sind tabu.
   * Staff, Gäste und Preview-Sessions erhalten null — der DM nutzt das Studio.
   */
  async moveItemForViewer(
    worldSlug: string,
    ctx: AccessContext,
    input: MovePartyItemForViewerInput,
  ): Promise<InventoryItem | null> {
    if (!ctx.user || ctx.previewAsUserId || ctx.effectiveRole !== "player") {
      return null;
    }

    const worldId = await this.resolveWorldIdForViewer(worldSlug);
    if (!worldId) {
      return null;
    }

    const scope = scopeFromAccessContext(ctx, worldId);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return null;
    }

    const item = await this.db.inventoryItem.findFirst({
      where: { id: input.itemId, worldId },
    });
    if (!item || isInventoryItemDmOnly(item)) {
      return null;
    }

    if (input.targetCharacterId) {
      // Schatzkammer -> eigener Charakter
      if (!item.treasuryId) {
        return null;
      }
      if (!(await this.isItemPagePlayerVisible(ctx, item.pageId))) {
        return null;
      }

      const character = await this.db.character.findFirst({
        where: { id: input.targetCharacterId, worldId },
        select: { id: true, ownerUserId: true },
      });
      if (!character || character.ownerUserId !== ctx.user.id) {
        return null;
      }

      return this.db.inventoryItem.update({
        where: { id: item.id },
        data: { characterId: character.id, treasuryId: null },
      });
    }

    // Eigener Charakter -> Schatzkammer
    if (!item.characterId) {
      return null;
    }
    const owner = await this.db.character.findUnique({
      where: { id: item.characterId },
      select: { ownerUserId: true },
    });
    if (!owner || owner.ownerUserId !== ctx.user.id) {
      return null;
    }

    const treasury = await this.getOrCreateForWorld(worldId);
    return this.db.inventoryItem.update({
      where: { id: item.id },
      data: { treasuryId: treasury.id, characterId: null },
    });
  }

  async deleteItem(worldId: string, itemId: string) {
    const item = await this.db.inventoryItem.findFirst({
      where: { id: itemId, worldId, treasuryId: { not: null } },
    });
    if (!item) {
      throw new Error("Inventar-Item nicht gefunden.");
    }
    return this.db.inventoryItem.delete({ where: { id: itemId } });
  }
}

export function createPartyTreasuryService(db: PrismaClient): PartyTreasuryService {
  return new PartyTreasuryService(db);
}
