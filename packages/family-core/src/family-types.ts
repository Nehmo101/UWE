/**
 * Gemeinsame Typen für `@uwe/family-core`.
 *
 * Bewusst strukturell und nicht aus dem Prisma-Client abgeleitet: die reinen
 * Module (Farben, Jahrestage, ICS-Aufbau) sollen ohne Datenbank testbar bleiben.
 */

export type FamilyMemberKind = "adult" | "child" | "pet" | "guest";

export type FamilyHealthRecordKind =
  | "vaccination"
  | "checkup"
  | "medication"
  | "vet"
  | "other";

/** Ein Mitglied des Haushalts — mit oder ohne Konto. */
export interface FamilyMemberLike {
  id: string;
  userId: string | null;
  displayName: string;
  colour: string;
  kind: FamilyMemberKind;
  isActive: boolean;
  sortIndex: number;
  birthdayOn: Date | null;
  anniversaryOn: Date | null;
  anniversaryLabel: string | null;
}

/** Ein Termin, angereichert um die beteiligten Mitglieder. */
export interface CalendarEventLike {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
}

export interface FamilyHealthRecordLike {
  id: string;
  memberId: string;
  kind: FamilyHealthRecordKind;
  title: string;
  notes: string;
  occurredOn: Date | null;
  nextDueOn: Date | null;
}

/** Deutschsprachige Beschriftung der Mitglieds-Art, für Oberfläche und Briefing. */
export const FAMILY_MEMBER_KIND_LABEL: Record<FamilyMemberKind, string> = {
  adult: "Erwachsen",
  child: "Kind",
  pet: "Haustier",
  guest: "Gast",
};

export const FAMILY_HEALTH_KIND_LABEL: Record<FamilyHealthRecordKind, string> = {
  vaccination: "Impfung",
  checkup: "Vorsorge",
  medication: "Medikament",
  vet: "Tierarzt",
  other: "Sonstiges",
};

export const FAMILY_MEMBER_KINDS: readonly FamilyMemberKind[] = [
  "adult",
  "child",
  "pet",
  "guest",
];

export const FAMILY_HEALTH_RECORD_KINDS: readonly FamilyHealthRecordKind[] = [
  "vaccination",
  "checkup",
  "medication",
  "vet",
  "other",
];

export function isFamilyMemberKind(value: unknown): value is FamilyMemberKind {
  return typeof value === "string" && FAMILY_MEMBER_KINDS.includes(value as FamilyMemberKind);
}

export function isFamilyHealthRecordKind(value: unknown): value is FamilyHealthRecordKind {
  return (
    typeof value === "string" &&
    FAMILY_HEALTH_RECORD_KINDS.includes(value as FamilyHealthRecordKind)
  );
}
