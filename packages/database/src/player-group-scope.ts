import type { PrismaClient } from "./client";

/**
 * Die Tischrunde des Betrachters — und was daraus fuer Sessions folgt.
 *
 * Warum das hier und nicht in `@uwe/player-hub` steht, wo die Gruppen sonst
 * leben: `@uwe/player-hub` haengt an `@uwe/database`, nicht umgekehrt. Die
 * Portal-Sicht auf Sessions entsteht aber im Auth-Service dieses Pakets, und
 * sie darf nicht davon abhaengen, dass jeder Aufrufer daran denkt zu filtern.
 * Deshalb: ein winziger Lookup hier, dieselbe Auswahlregel wie dort.
 */

/**
 * Die eine Runde, in der ein Konto in dieser Welt sitzt.
 *
 * Mehrere Mitgliedschaften sind im Schema erlaubt; die Auswahl nimmt — wie
 * `PlayerGroupService.findForUser` — die zuerst angelegte Gruppe. Ohne
 * Mitgliedschaft (oder ohne Konto) kommt `null` zurueck, und das ist die
 * fail-closed Richtung: `null` sieht nur, was der ganzen Welt gehoert.
 */
export async function findViewerPlayerGroupId(
  db: PrismaClient,
  worldId: string,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const membership = await db.playerGroupMember.findFirst({
    where: { userId, group: { worldId } },
    orderBy: { group: { createdAt: "asc" } },
    select: { groupId: true },
  });

  return membership?.groupId ?? null;
}

/**
 * Prisma-`where`-Fragment fuer „Sessions, die diese Runde sehen darf".
 *
 * Zwei Faelle, mehr gibt es nicht:
 * - `groupId === null` (kein Tisch): nur welt-weite Sessions.
 * - sonst: welt-weite Sessions plus die der eigenen Runde.
 *
 * Fremde Runden kommen in keinem Fall vor — deshalb steht die Regel als
 * Datenbank-Filter und nicht als `filter()` hinter dem Laden.
 */
export function playerGroupSessionScope(groupId: string | null) {
  return groupId
    ? { OR: [{ groupId: null }, { groupId }] }
    : { groupId: null };
}

/** Dieselbe Regel fuer eine einzelne, bereits geladene Session. */
export function isSessionVisibleToGroup(
  sessionGroupId: string | null,
  viewerGroupId: string | null,
): boolean {
  return sessionGroupId === null || sessionGroupId === viewerGroupId;
}
