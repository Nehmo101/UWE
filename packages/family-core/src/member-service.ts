/**
 * Mitglieder des Haushalts.
 *
 * Ein Mitglied ist eine Person (oder ein Haustier) im Haushalt — ein Konto ist
 * optional. Wer sich anmelden kann, bekommt beim ersten Besuch automatisch ein
 * Mitglied; Kleinkind, Gast und Katze werden von Hand angelegt und haben nie
 * eine `userId`.
 *
 * Business-Logik gehört hierher, nicht in Route Handler oder Server Actions
 * (CLAUDE.md „Goldene Regel").
 */
import type { FamilyPrismaClient } from "@uwe/database/family-client";
import type { FamilyMemberKind } from "./family-types";
import { nextFreeMemberColour, normaliseMemberColour } from "./member-colours";

export interface CreateMemberInput {
  displayName: string;
  kind?: FamilyMemberKind;
  colour?: string | null;
  note?: string;
  /** Konto-Verknüpfung; leer lassen für Mitglieder ohne Login. */
  userId?: string | null;
  birthdayOn?: Date | null;
  anniversaryOn?: Date | null;
  anniversaryLabel?: string | null;
  sortIndex?: number;
}

export interface UpdateMemberInput {
  displayName?: string;
  kind?: FamilyMemberKind;
  colour?: string | null;
  note?: string;
  isActive?: boolean;
  birthdayOn?: Date | null;
  anniversaryOn?: Date | null;
  anniversaryLabel?: string | null;
  sortIndex?: number;
}

export interface ListMembersOptions {
  /** Auch deaktivierte Mitglieder mitliefern. Standard: nein. */
  includeInactive?: boolean;
}

const ORDER_BY = [{ sortIndex: "asc" }, { displayName: "asc" }] as const;

/** Ein Anzeigename darf nicht leer sein — sonst steht eine namenlose Farbe im Kalender. */
export function normaliseDisplayName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed === "") {
    throw new Error("Ein Mitglied braucht einen Namen.");
  }
  return trimmed.slice(0, 80);
}

function normaliseLabel(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, 120);
}

export class FamilyMemberService {
  constructor(private readonly db: FamilyPrismaClient) {}

  async listMembers(options: ListMembersOptions = {}) {
    return this.db.familyMemberProfile.findMany({
      where: options.includeInactive ? {} : { isActive: true },
      orderBy: [...ORDER_BY],
    });
  }

  async getMember(id: string) {
    return this.db.familyMemberProfile.findUnique({ where: { id } });
  }

  async getMemberByUserId(userId: string) {
    return this.db.familyMemberProfile.findUnique({ where: { userId } });
  }

  /**
   * Freie Farbe aus der Palette, gemessen an allen bereits vergebenen — auch
   * denen deaktivierter Mitglieder, damit ein reaktiviertes Mitglied nicht
   * plötzlich die Farbe eines anderen trägt.
   */
  private async pickColour(): Promise<string> {
    const existing = await this.db.familyMemberProfile.findMany({
      select: { colour: true },
    });
    return nextFreeMemberColour(existing.map((row) => row.colour));
  }

  async createMember(input: CreateMemberInput) {
    const colour = normaliseMemberColour(input.colour) ?? (await this.pickColour());

    return this.db.familyMemberProfile.create({
      data: {
        displayName: normaliseDisplayName(input.displayName),
        kind: input.kind ?? "adult",
        colour,
        note: input.note?.trim() ?? "",
        userId: input.userId ?? null,
        birthdayOn: input.birthdayOn ?? null,
        anniversaryOn: input.anniversaryOn ?? null,
        anniversaryLabel: normaliseLabel(input.anniversaryLabel),
        sortIndex: input.sortIndex ?? 0,
      },
    });
  }

  async updateMember(id: string, input: UpdateMemberInput) {
    const data: Record<string, unknown> = {};

    if (input.displayName !== undefined) {
      data["displayName"] = normaliseDisplayName(input.displayName);
    }
    if (input.kind !== undefined) data["kind"] = input.kind;
    if (input.note !== undefined) data["note"] = input.note.trim();
    if (input.isActive !== undefined) data["isActive"] = input.isActive;
    if (input.sortIndex !== undefined) data["sortIndex"] = input.sortIndex;
    if (input.birthdayOn !== undefined) data["birthdayOn"] = input.birthdayOn;
    if (input.anniversaryOn !== undefined) data["anniversaryOn"] = input.anniversaryOn;
    if (input.anniversaryLabel !== undefined) {
      data["anniversaryLabel"] = normaliseLabel(input.anniversaryLabel);
    }
    if (input.colour !== undefined) {
      // Leere Eingabe heißt „keine feste Farbe" — die Anzeige weicht dann auf
      // die aus der Kennung abgeleitete Farbe aus.
      data["colour"] = normaliseMemberColour(input.colour) ?? "";
    }

    return this.db.familyMemberProfile.update({ where: { id }, data });
  }

  /**
   * Löscht ein Mitglied samt Terminzuordnungen, Akte und Abos. Ein Mitglied mit
   * Konto wird nicht gelöscht, sondern deaktiviert — sonst legt der nächste
   * Besuch es sofort wieder an.
   *
   * Die Kaskade räumt nur die Verknüpfungen ab. Was danach ohne Person
   * dasteht, muss mit: ein Akten-Eintrag ohne Zuordnung gehört niemandem, und
   * ein auf Personen eingeschränktes Abo würde sonst stillschweigend zu einem
   * für den ganzen Haushalt. Beides betrifft ausschließlich Einträge und Abos,
   * die es mit diesem Mitglied geteilt haben — gemeinsame bleiben stehen.
   */
  async removeMember(id: string) {
    const member = await this.getMember(id);
    if (!member) return null;

    if (member.userId) {
      return this.db.familyMemberProfile.update({
        where: { id },
        data: { isActive: false },
      });
    }

    const [recordLinks, subscriptionLinks] = await Promise.all([
      this.db.familyHealthRecordMember.findMany({
        where: { memberId: id },
        select: { recordId: true },
      }),
      this.db.familyCalendarSubscriptionMember.findMany({
        where: { memberId: id },
        select: { subscriptionId: true },
      }),
    ]);

    await this.db.familyMemberProfile.delete({ where: { id } });

    const recordIds = recordLinks.map((link) => link.recordId);
    if (recordIds.length > 0) {
      await this.db.familyHealthRecord.deleteMany({
        where: { id: { in: recordIds }, memberLinks: { none: {} } },
      });
    }

    const subscriptionIds = subscriptionLinks.map((link) => link.subscriptionId);
    if (subscriptionIds.length > 0) {
      await this.db.familyCalendarSubscription.deleteMany({
        where: { id: { in: subscriptionIds }, memberLinks: { none: {} } },
      });
    }

    return null;
  }

  /**
   * Legt beim ersten Besuch ein Mitglied für das Konto an. Löst
   * `FamilyService.ensureMemberProfile` ab, vergibt aber zusätzlich eine Farbe.
   *
   * Der Anzeigename aus dem Konto ist nur der **Startwert**: gepflegt wird er
   * danach im Haushalt auf `/members`. Würde jeder Besuch den Kontonamen
   * zurückschreiben, verlöre jede dort gespeicherte Änderung beim nächsten
   * Seitenaufruf ihre Wirkung.
   */
  async ensureMemberForUser(input: { userId: string; displayName: string }) {
    const existing = await this.getMemberByUserId(input.userId);
    if (existing) return existing;

    return this.createMember({
      userId: input.userId,
      displayName: normaliseDisplayName(input.displayName),
    });
  }

  /** Verknüpft ein bestehendes Mitglied ohne Konto mit einer Benutzer-ID. */
  async linkMemberToUser(id: string, userId: string) {
    const alreadyLinked = await this.getMemberByUserId(userId);
    if (alreadyLinked && alreadyLinked.id !== id) {
      throw new Error("Dieses Konto ist bereits einem anderen Mitglied zugeordnet.");
    }
    return this.db.familyMemberProfile.update({ where: { id }, data: { userId } });
  }

  async unlinkMemberFromUser(id: string) {
    return this.db.familyMemberProfile.update({ where: { id }, data: { userId: null } });
  }
}

export function createFamilyMemberService(db: FamilyPrismaClient): FamilyMemberService {
  return new FamilyMemberService(db);
}
