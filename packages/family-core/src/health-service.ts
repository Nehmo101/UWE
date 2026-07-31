/**
 * Gesundheits- und Tierarzt-Akte je Haushalts-Mitglied.
 *
 * Impfungen, Vorsorge, Medikamente, Tierarzt — für Menschen und Tiere
 * gleichermaßen, weil beide im Haushalt Termine erzeugen. Ein Eintrag mit
 * `nextDueOn` erscheint automatisch im Kalender und im ICS-Feed, ohne dass
 * jemand daraus von Hand einen Termin macht.
 */
import type { FamilyPrismaClient } from "@uwe/database/family-client";
import type { FamilyHealthRecordKind } from "./family-types";

export interface CreateHealthRecordInput {
  memberId: string;
  kind?: FamilyHealthRecordKind;
  title: string;
  notes?: string;
  occurredOn?: Date | null;
  nextDueOn?: Date | null;
}

export interface UpdateHealthRecordInput {
  kind?: FamilyHealthRecordKind;
  title?: string;
  notes?: string;
  occurredOn?: Date | null;
  nextDueOn?: Date | null;
}

const MEMBER_SELECT = {
  select: { id: true, displayName: true, colour: true, kind: true },
} as const;

function normaliseTitle(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed === "") {
    throw new Error("Ein Eintrag braucht eine Bezeichnung.");
  }
  return trimmed.slice(0, 160);
}

export class FamilyHealthService {
  constructor(private readonly db: FamilyPrismaClient) {}

  /** Alle Einträge eines Mitglieds, jüngste zuerst. */
  async listForMember(memberId: string) {
    return this.db.familyHealthRecord.findMany({
      where: { memberId },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    });
  }

  /** Die ganze Akte des Haushalts, nach Mitglied gruppierbar. */
  async listAll() {
    return this.db.familyHealthRecord.findMany({
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      include: { member: MEMBER_SELECT },
    });
  }

  async getRecord(id: string) {
    return this.db.familyHealthRecord.findUnique({
      where: { id },
      include: { member: MEMBER_SELECT },
    });
  }

  /**
   * Was bis `until` fällig wird — Grundlage für Kalender, ICS-Feed und
   * Wochenbriefing. Einträge ohne Fälligkeit bleiben aussen vor.
   */
  async listDueUntil(until: Date, from = new Date(0)) {
    return this.db.familyHealthRecord.findMany({
      where: { nextDueOn: { not: null, gte: from, lte: until } },
      orderBy: { nextDueOn: "asc" },
      include: { member: MEMBER_SELECT },
    });
  }

  async createRecord(input: CreateHealthRecordInput) {
    return this.db.familyHealthRecord.create({
      data: {
        memberId: input.memberId,
        kind: input.kind ?? "other",
        title: normaliseTitle(input.title),
        notes: input.notes?.trim() ?? "",
        occurredOn: input.occurredOn ?? null,
        nextDueOn: input.nextDueOn ?? null,
      },
    });
  }

  async updateRecord(id: string, input: UpdateHealthRecordInput) {
    const data: Record<string, unknown> = {};

    if (input.kind !== undefined) data["kind"] = input.kind;
    if (input.title !== undefined) data["title"] = normaliseTitle(input.title);
    if (input.notes !== undefined) data["notes"] = input.notes.trim();
    if (input.occurredOn !== undefined) data["occurredOn"] = input.occurredOn;
    if (input.nextDueOn !== undefined) data["nextDueOn"] = input.nextDueOn;

    return this.db.familyHealthRecord.update({ where: { id }, data });
  }

  async deleteRecord(id: string) {
    await this.db.familyHealthRecord.delete({ where: { id } });
  }
}

export function createFamilyHealthService(db: FamilyPrismaClient): FamilyHealthService {
  return new FamilyHealthService(db);
}
