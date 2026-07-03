import type { PrismaClient } from "@uwe/database/server";
import { ROLL_TABLE_PRESETS } from "./presets";
import {
  coerceRollTableEntries,
  normalizeRollTableCategory,
  type RollTableCategory,
  type RollTableEntry,
} from "./roll";

export interface RollTableView {
  id: string;
  worldId: string;
  name: string;
  category: RollTableCategory;
  dice: string | null;
  notes: string | null;
  entries: RollTableEntry[];
  updatedAt: Date;
}

export interface CreateRollTableInput {
  worldId: string;
  name: string;
  category?: string;
  dice?: string | null;
  notes?: string | null;
  entries: RollTableEntry[];
}

type RollTableRow = {
  id: string;
  worldId: string;
  name: string;
  category: string;
  dice: string | null;
  notes: string | null;
  entries: unknown;
  updatedAt: Date;
};

function toView(row: RollTableRow): RollTableView {
  return {
    id: row.id,
    worldId: row.worldId,
    name: row.name,
    category: normalizeRollTableCategory(row.category),
    dice: row.dice,
    notes: row.notes,
    entries: coerceRollTableEntries(row.entries),
    updatedAt: row.updatedAt,
  };
}

export class RollTableService {
  constructor(private readonly db: PrismaClient) {}

  async listForWorld(worldId: string): Promise<RollTableView[]> {
    const rows = await this.db.rollTable.findMany({
      where: { worldId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return rows.map(toView);
  }

  async get(id: string): Promise<RollTableView | null> {
    const row = await this.db.rollTable.findUnique({ where: { id } });
    return row ? toView(row) : null;
  }

  async create(input: CreateRollTableInput): Promise<RollTableView> {
    if (!input.name.trim()) {
      throw new Error("Name ist erforderlich.");
    }
    if (input.entries.length === 0) {
      throw new Error("Mindestens ein Tabellen-Eintrag ist erforderlich.");
    }
    const row = await this.db.rollTable.create({
      data: {
        worldId: input.worldId,
        name: input.name.trim(),
        category: normalizeRollTableCategory(input.category),
        dice: input.dice?.trim() || null,
        notes: input.notes?.trim() || null,
        entries: input.entries as object[],
      },
    });
    return toView(row);
  }

  async update(
    id: string,
    input: Partial<Omit<CreateRollTableInput, "worldId">>,
  ): Promise<RollTableView> {
    const row = await this.db.rollTable.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        category: input.category === undefined ? undefined : normalizeRollTableCategory(input.category),
        dice: input.dice === undefined ? undefined : input.dice?.trim() || null,
        notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
        entries: input.entries === undefined ? undefined : (input.entries as object[]),
      },
    });
    return toView(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.rollTable.delete({ where: { id } });
  }

  /** Spielt die Preset-Tabellen ein; bereits vorhandene Namen werden übersprungen. */
  async seedPresets(worldId: string): Promise<{ created: number; skipped: number }> {
    const existing = await this.db.rollTable.findMany({
      where: { worldId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((row) => row.name));

    let created = 0;
    let skipped = 0;
    for (const preset of ROLL_TABLE_PRESETS) {
      if (existingNames.has(preset.name)) {
        skipped += 1;
        continue;
      }
      await this.db.rollTable.create({
        data: {
          worldId,
          name: preset.name,
          category: preset.category,
          dice: preset.dice ?? null,
          notes: preset.notes ?? null,
          entries: preset.entries as object[],
        },
      });
      created += 1;
    }
    return { created, skipped };
  }
}

export function createRollTableService(db: PrismaClient): RollTableService {
  return new RollTableService(db);
}
