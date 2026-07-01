import type { Prisma, PrismaClient } from "./generated/prisma/client";

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

export class PartyTreasuryService {
  constructor(private readonly db: PrismaClient) {}

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
}

export function createPartyTreasuryService(db: PrismaClient): PartyTreasuryService {
  return new PartyTreasuryService(db);
}
