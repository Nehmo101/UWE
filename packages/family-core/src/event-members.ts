/**
 * Zuordnung von Terminen zu Haushalts-Mitgliedern.
 *
 * Ein Termin kann mehrere Personen betreffen („Familienessen") oder gar keine
 * (externe Termine aus abonnierten Feeds). Die Zuordnung liegt in einer
 * eigenen Tabelle, damit der Monatskalender pro Person filtern und einfärben
 * kann, ohne dass der CalDAV/ICS-Abgleich davon etwas mitbekommt.
 */
import type { FamilyPrismaClient } from "@uwe/database/family-client";
import { resolveMemberColour } from "./member-colours";
import { setMemberLinks, sortMemberBadges, type FamilyMemberBadge } from "./member-links";

export type EventMemberBadge = FamilyMemberBadge;

/**
 * Setzt die Mitglieder eines Termins auf genau die übergebene Menge.
 * Leeres Array entfernt alle Zuordnungen — so wird ein persönlicher Termin
 * wieder zu einem allgemeinen.
 */
export async function setEventMembers(
  db: FamilyPrismaClient,
  eventId: string,
  memberIds: readonly string[],
): Promise<void> {
  await setMemberLinks(
    {
      listMemberIds: async (id) =>
        (
          await db.calendarEventMember.findMany({
            where: { eventId: id },
            select: { memberId: true },
          })
        ).map((row) => row.memberId),
      removeExcept: async (id, keep) => {
        await db.calendarEventMember.deleteMany({
          where: keep.length > 0 ? { eventId: id, memberId: { notIn: [...keep] } } : { eventId: id },
        });
      },
      add: async (id, ids) => {
        await db.calendarEventMember.createMany({
          data: ids.map((memberId) => ({ eventId: id, memberId })),
        });
      },
    },
    eventId,
    memberIds,
  );
}

/** Mitglieder-Kennungen je Termin, für eine ganze Terminliste in einem Zug. */
export async function memberIdsByEvent(
  db: FamilyPrismaClient,
  eventIds: readonly string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (eventIds.length === 0) return out;

  const links = await db.calendarEventMember.findMany({
    where: { eventId: { in: [...eventIds] } },
    select: { eventId: true, memberId: true },
  });

  for (const link of links) {
    const list = out.get(link.eventId);
    if (list) list.push(link.memberId);
    else out.set(link.eventId, [link.memberId]);
  }
  return out;
}

/**
 * Reichert eine Terminliste um die beteiligten Mitglieder an — Name und Farbe,
 * fertig für die Anzeige. Ein Datenbankzugriff für die Zuordnungen, einer für
 * die Mitglieder, unabhängig von der Anzahl der Termine.
 */
export async function attachMembersToEvents<T extends { id: string }>(
  db: FamilyPrismaClient,
  events: readonly T[],
): Promise<(T & { members: EventMemberBadge[] })[]> {
  if (events.length === 0) return [];

  const byEvent = await memberIdsByEvent(
    db,
    events.map((event) => event.id),
  );

  const needed = new Set<string>();
  for (const ids of byEvent.values()) {
    for (const id of ids) needed.add(id);
  }

  const members =
    needed.size === 0
      ? []
      : await db.familyMemberProfile.findMany({
          where: { id: { in: [...needed] } },
          select: { id: true, displayName: true, colour: true },
        });

  const badgeById = new Map<string, EventMemberBadge>(
    members.map((member) => [
      member.id,
      {
        id: member.id,
        displayName: member.displayName,
        colour: resolveMemberColour(member),
      },
    ]),
  );

  return events.map((event) => ({
    ...event,
    members: sortMemberBadges(
      (byEvent.get(event.id) ?? [])
        .map((id) => badgeById.get(id))
        .filter((badge): badge is EventMemberBadge => badge !== undefined),
    ),
  }));
}

/** Termin-Kennungen, die einem Mitglied zugeordnet sind. */
export async function eventIdsForMember(
  db: FamilyPrismaClient,
  memberId: string,
): Promise<string[]> {
  const links = await db.calendarEventMember.findMany({
    where: { memberId },
    select: { eventId: true },
  });
  return links.map((link) => link.eventId);
}
