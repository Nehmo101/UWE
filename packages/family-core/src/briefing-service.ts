/**
 * Wochenbriefing des Haushalts.
 *
 * Sammelt, was in der kommenden Woche ansteht — Termine je Person, Geburtstage,
 * fällige Arzt- und Tierarzttermine, auslaufende Verträge — und lässt daraus
 * einen kurzen Text schreiben.
 *
 * Der Kontext-Bau ist rein und getestet; nur der Modell-Aufruf nicht. Wie in
 * `@uwe/kitchen` läuft er direkt über die Connector-Queue (lokale Maschinenraum-
 * Inferenz). Ist kein Connector online, kommt der Rohkontext zurück — eine
 * Liste ohne Fließtext ist immer noch nützlich, ein Absturz nie.
 */
import type { AnniversaryOccurrence } from "./anniversaries";
import { FAMILY_HEALTH_KIND_LABEL, type FamilyHealthRecordKind } from "./family-types";

export interface BriefingEvent {
  title: string;
  startAt: Date;
  allDay: boolean;
  location: string | null;
  memberNames: readonly string[];
}

export interface BriefingHealthItem {
  memberNames: readonly string[];
  kind: FamilyHealthRecordKind;
  title: string;
  nextDueOn: Date;
}

export interface BriefingContract {
  name: string;
  endsOn: Date;
}

export interface BriefingInput {
  from: Date;
  to: Date;
  memberNames: readonly string[];
  events: readonly BriefingEvent[];
  anniversaries: readonly AnniversaryOccurrence[];
  healthDue: readonly BriefingHealthItem[];
  contracts: readonly BriefingContract[];
}

const WEEKDAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

function when(event: BriefingEvent): string {
  return event.allDay
    ? WEEKDAY.format(event.startAt)
    : `${WEEKDAY.format(event.startAt)}, ${TIME.format(event.startAt)}`;
}

/**
 * Baut den Kontext für das Briefing — und gleichzeitig die Fassung, die
 * angezeigt wird, wenn kein Modell erreichbar ist.
 */
export function buildBriefingContext(input: BriefingInput): string {
  const lines: string[] = [
    `Haushalt: ${input.memberNames.join(", ") || "(keine Mitglieder erfasst)"}`,
    `Zeitraum: ${WEEKDAY.format(input.from)} bis ${WEEKDAY.format(input.to)}`,
    "",
  ];

  lines.push(`Termine (${input.events.length}):`);
  if (input.events.length === 0) {
    lines.push("- keine");
  } else {
    for (const event of input.events) {
      const who = event.memberNames.length > 0 ? ` [${event.memberNames.join(", ")}]` : " [alle]";
      const where = event.location ? ` (${event.location})` : "";
      lines.push(`- ${when(event)}: ${event.title}${where}${who}`);
    }
  }

  lines.push("", `Geburtstage und Jahrestage (${input.anniversaries.length}):`);
  if (input.anniversaries.length === 0) {
    lines.push("- keine");
  } else {
    for (const occurrence of input.anniversaries) {
      lines.push(`- ${WEEKDAY.format(occurrence.date)}: ${occurrence.title}`);
    }
  }

  lines.push("", `Gesundheit und Tierarzt (${input.healthDue.length}):`);
  if (input.healthDue.length === 0) {
    lines.push("- nichts fällig");
  } else {
    for (const item of input.healthDue) {
      lines.push(
        `- ${WEEKDAY.format(item.nextDueOn)}: ${item.memberNames.join(", ")} — ${item.title} (${FAMILY_HEALTH_KIND_LABEL[item.kind]})`,
      );
    }
  }

  lines.push("", `Verträge, die auslaufen (${input.contracts.length}):`);
  if (input.contracts.length === 0) {
    lines.push("- keine");
  } else {
    for (const contract of input.contracts) {
      lines.push(`- ${WEEKDAY.format(contract.endsOn)}: ${contract.name}`);
    }
  }

  return lines.join("\n");
}

export const BRIEFING_SYSTEM_PROMPT = [
  "Du schreibst das Wochenbriefing für einen Haushalt.",
  "Fasse in höchstens 200 Wörtern zusammen, was ansteht — nach Person geordnet, in ganzen Sätzen.",
  "Nenne zuerst, was Vorbereitung braucht (Termine mit Ort, Arztbesuche, auslaufende Verträge).",
  "Erfinde nichts dazu und lass nichts Wichtiges weg. Schreibe auf Deutsch, freundlich und knapp.",
  "Keine Überschriften, keine Aufzählungszeichen — nur Fließtext.",
].join(" ");

/** Ist überhaupt etwas los? Ein leeres Briefing muss man nicht schreiben lassen. */
export function hasBriefingContent(input: BriefingInput): boolean {
  return (
    input.events.length > 0 ||
    input.anniversaries.length > 0 ||
    input.healthDue.length > 0 ||
    input.contracts.length > 0
  );
}

/** Beginn (Montag) und Ende (Sonntag) der Woche, in der `reference` liegt. */
export function weekRange(reference: Date): { from: Date; to: Date } {
  const day = reference.getDay();
  // Montag als Wochenanfang: Sonntag (0) gehört zur ablaufenden Woche.
  const offsetToMonday = (day + 6) % 7;

  const from = new Date(reference);
  from.setDate(from.getDate() - offsetToMonday);
  from.setHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}
