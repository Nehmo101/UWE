/**
 * Gesundheits- und Tierarzt-Akte des Haushalts.
 *
 * Impfungen, Vorsorge, Medikamente, Tierarzt — für Menschen und Tiere
 * gleichermaßen, weil beide im Haushalt Termine erzeugen. Ein Eintrag mit
 * `nextDueOn` erscheint automatisch im Kalender und im ICS-Feed, ohne dass
 * jemand daraus von Hand einen Termin macht.
 *
 * Ein Eintrag gehört einer **oder mehreren** Personen: die Wurmkur betrifft
 * beide Katzen, die Grippeimpfung die ganze Familie. Die Zuordnung liegt wie
 * beim Termin in einer eigenen Tabelle. Ohne Zuordnung gibt es keinen Eintrag —
 * eine Akte ohne Person gehört niemandem.
 */
import type { FamilyPrismaClient } from "@uwe/database/family-client";
import type { FamilyHealthRecordKind, FamilyMemberKind } from "./family-types";
import { resolveMemberColour } from "./member-colours";
import { normaliseMemberIds, setMemberLinks, sortMemberBadges } from "./member-links";

export interface CreateHealthRecordInput {
  /** Mindestens eine Person — Doppelte und Leerstrings fallen weg. */
  memberIds: readonly string[];
  kind?: FamilyHealthRecordKind;
  title: string;
  notes?: string;
  occurredOn?: Date | null;
  nextDueOn?: Date | null;
}

export interface UpdateHealthRecordInput {
  /** Weggelassen heisst „unverändert"; gesetzt ersetzt die ganze Auswahl. */
  memberIds?: readonly string[];
  kind?: FamilyHealthRecordKind;
  title?: string;
  notes?: string;
  occurredOn?: Date | null;
  nextDueOn?: Date | null;
}

/** Anzeigefertiges Mitglied an einem Akten-Eintrag. */
export interface HealthRecordMember {
  id: string;
  displayName: string;
  colour: string;
  kind: FamilyMemberKind;
}

const RECORD_INCLUDE = {
  memberLinks: {
    select: {
      member: { select: { id: true, displayName: true, colour: true, kind: true } },
    },
  },
} as const;

const ORDER_BY_RECENT = [{ occurredOn: "desc" }, { createdAt: "desc" }] as const;

interface MemberLinkRow {
  member: { id: string; displayName: string; colour: string; kind: FamilyMemberKind };
}

/**
 * Verknüpfungszeilen zu einer sortierten Mitgliederliste — der Rest des
 * Eintrags bleibt, wie Prisma ihn liefert.
 */
function toView<T extends { memberLinks: MemberLinkRow[] }>(
  row: T,
): Omit<T, "memberLinks"> & { members: HealthRecordMember[] } {
  const { memberLinks, ...rest } = row;

  return {
    ...rest,
    members: sortMemberBadges(
      memberLinks.map((link) => ({
        id: link.member.id,
        displayName: link.member.displayName,
        colour: resolveMemberColour(link.member),
        kind: link.member.kind,
      })),
    ),
  };
}

function normaliseTitle(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed === "") {
    throw new Error("Ein Eintrag braucht eine Bezeichnung.");
  }
  return trimmed.slice(0, 160);
}

/** Ohne Person gehört ein Eintrag niemandem — das ist keine gültige Akte. */
function requireMembers(memberIds: readonly string[]): string[] {
  const unique = normaliseMemberIds(memberIds);
  if (unique.length === 0) {
    throw new Error("Ein Eintrag braucht mindestens eine Person.");
  }
  return unique;
}

export class FamilyHealthService {
  constructor(private readonly db: FamilyPrismaClient) {}

  /** Alle Einträge, an denen dieses Mitglied beteiligt ist, jüngste zuerst. */
  async listForMember(memberId: string) {
    const rows = await this.db.familyHealthRecord.findMany({
      where: { memberLinks: { some: { memberId } } },
      orderBy: [...ORDER_BY_RECENT],
      include: RECORD_INCLUDE,
    });
    return rows.map(toView);
  }

  /** Die ganze Akte des Haushalts, nach Mitglied gruppierbar. */
  async listAll() {
    const rows = await this.db.familyHealthRecord.findMany({
      orderBy: [...ORDER_BY_RECENT],
      include: RECORD_INCLUDE,
    });
    return rows.map(toView);
  }

  async getRecord(id: string) {
    const row = await this.db.familyHealthRecord.findUnique({
      where: { id },
      include: RECORD_INCLUDE,
    });
    return row ? toView(row) : null;
  }

  /**
   * Was bis `until` fällig wird — Grundlage für Kalender, ICS-Feed und
   * Wochenbriefing. Einträge ohne Fälligkeit bleiben aussen vor.
   */
  async listDueUntil(until: Date, from = new Date(0)) {
    const rows = await this.db.familyHealthRecord.findMany({
      where: { nextDueOn: { not: null, gte: from, lte: until } },
      orderBy: { nextDueOn: "asc" },
      include: RECORD_INCLUDE,
    });
    return rows.map(toView);
  }

  async createRecord(input: CreateHealthRecordInput) {
    const memberIds = requireMembers(input.memberIds);
    const title = normaliseTitle(input.title);

    const row = await this.db.familyHealthRecord.create({
      data: {
        kind: input.kind ?? "other",
        title,
        notes: input.notes?.trim() ?? "",
        occurredOn: input.occurredOn ?? null,
        nextDueOn: input.nextDueOn ?? null,
        memberLinks: { create: memberIds.map((memberId) => ({ memberId })) },
      },
      include: RECORD_INCLUDE,
    });

    return toView(row);
  }

  async updateRecord(id: string, input: UpdateHealthRecordInput) {
    const data: Record<string, unknown> = {};

    if (input.kind !== undefined) data["kind"] = input.kind;
    if (input.title !== undefined) data["title"] = normaliseTitle(input.title);
    if (input.notes !== undefined) data["notes"] = input.notes.trim();
    if (input.occurredOn !== undefined) data["occurredOn"] = input.occurredOn;
    if (input.nextDueOn !== undefined) data["nextDueOn"] = input.nextDueOn;

    // Erst prüfen, dann schreiben: eine leere Auswahl darf den Eintrag nicht
    // halb geändert und ohne Person zurücklassen.
    const memberIds = input.memberIds === undefined ? null : requireMembers(input.memberIds);

    const row = await this.db.familyHealthRecord.update({
      where: { id },
      data,
      include: RECORD_INCLUDE,
    });

    if (memberIds === null) return toView(row);

    await this.setRecordMembers(id, memberIds);
    return (await this.getRecord(id)) ?? toView(row);
  }

  /** Setzt die beteiligten Personen auf genau diese Menge. */
  async setRecordMembers(recordId: string, memberIds: readonly string[]): Promise<string[]> {
    const wanted = requireMembers(memberIds);

    return setMemberLinks(
      {
        listMemberIds: async (id) =>
          (
            await this.db.familyHealthRecordMember.findMany({
              where: { recordId: id },
              select: { memberId: true },
            })
          ).map((link) => link.memberId),
        removeExcept: async (id, keep) => {
          await this.db.familyHealthRecordMember.deleteMany({
            where: { recordId: id, memberId: { notIn: [...keep] } },
          });
        },
        add: async (id, ids) => {
          await this.db.familyHealthRecordMember.createMany({
            data: ids.map((memberId) => ({ recordId: id, memberId })),
          });
        },
      },
      recordId,
      wanted,
    );
  }

  async deleteRecord(id: string) {
    await this.db.familyHealthRecord.delete({ where: { id } });
  }
}

export function createFamilyHealthService(db: FamilyPrismaClient): FamilyHealthService {
  return new FamilyHealthService(db);
}
