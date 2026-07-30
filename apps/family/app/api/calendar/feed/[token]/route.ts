import { createCalendarService, prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import {
  attachMembersToEvents,
  createFamilyCalendarSubscriptionService,
  createFamilyHealthService,
  createFamilyMemberService,
  expandAnniversaries,
  renderFamilyIcs,
  resolveMemberColour,
  type FeedEventInput,
  type FeedHealthInput,
} from "@uwe/family-core";

/**
 * ICS-Abo des Haushalts-Kalenders — für die Kalender-App auf dem iPhone.
 *
 * Diese Route trägt bewusst **keinen** Sitzungs-Guard: ein Abo-Kalender wird
 * vom Gerät ohne `Authorization`-Header abgerufen, das Geheimnis steht deshalb
 * im Pfad. Sie ist dafür in `FAMILY_PUBLIC_API_ALLOWLIST`
 * (packages/security-tests) und `FAMILY_PUBLIC_ROUTES` (packages/auth)
 * eingetragen.
 *
 * Der Token ist ein eigener Typ (`uwecal_…`, `FamilyCalendarSubscription`) und
 * kann ausschließlich Termine lesen — nie schreiben, nie andere Bereiche. Er
 * ist einzeln widerrufbar; gespeichert wird nur sein Hash.
 *
 * Der Zeitraum ist bewusst begrenzt: ein Jahr zurück, zwei nach vorn. Ein
 * unbegrenzter Feed würde mit den Jahren immer langsamer.
 */

export const dynamic = "force-dynamic";

const MONTHS_BACK = 12;
const MONTHS_AHEAD = 24;

function notFound(): Response {
  // Bewusst 404 statt 401/403: die Antwort soll nicht verraten, ob es diesen
  // Token je gab oder ob er widerrufen wurde.
  return new Response("Nicht gefunden.", { status: 404 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  const subscriptions = createFamilyCalendarSubscriptionService(familyPrisma);
  // Der Dateiname darf angehängt werden („…/uwecal_abc.ics"), damit die URL im
  // Kalender-Abo nach einem Kalender aussieht.
  const subscription = await subscriptions.resolveByToken(token.replace(/\.ics$/i, ""));
  if (!subscription) return notFound();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - MONTHS_BACK, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + MONTHS_AHEAD, 0, 23, 59, 59, 999);

  const calendar = createCalendarService(familyPrisma, prisma);
  const members = createFamilyMemberService(familyPrisma);
  const health = createFamilyHealthService(familyPrisma);

  const [rawEvents, memberRows, healthDue] = await Promise.all([
    calendar.listEvents({ from, to, limit: 2000 }),
    members.listMembers({ includeInactive: true }),
    health.listDueUntil(to, from),
  ]);

  const enriched = await attachMembersToEvents(familyPrisma, rawEvents);

  // Ein an eine Person gebundenes Abo zeigt nur deren Termine. Termine ohne
  // Zuordnung gehören dem Haushalt und bleiben in jedem Abo sichtbar.
  const memberId = subscription.memberId;
  const events: FeedEventInput[] = enriched
    .filter(
      (event) =>
        !memberId ||
        event.members.length === 0 ||
        event.members.some((m) => m.id === memberId),
    )
    .map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
      memberNames: event.members.map((m) => m.displayName),
    }));

  const anniversaries = expandAnniversaries(memberRows, {
    from,
    to,
    colourOf: resolveMemberColour,
    includeInactive: true,
  }).filter((occurrence) => !memberId || occurrence.memberId === memberId);

  const due: FeedHealthInput[] = healthDue
    .filter((record) => !memberId || record.memberId === memberId)
    .flatMap((record) =>
      record.nextDueOn
        ? [
            {
              id: record.id,
              memberName: record.member.displayName,
              kind: record.kind,
              title: record.title,
              nextDueOn: record.nextDueOn,
            },
          ]
        : [],
    );

  const ownerName = memberId
    ? memberRows.find((row) => row.id === memberId)?.displayName
    : undefined;
  const calendarName = ownerName ? `UWE Family — ${ownerName}` : "UWE Family";

  const ics = renderFamilyIcs({ events, anniversaries, healthDue: due }, calendarName);

  await subscriptions.markUsed(subscription.id);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="uwe-family.ics"',
      // Abo-Kalender fragen regelmäßig nach; eine kurze Frist entlastet den
      // Host, ohne dass ein neuer Termin lange unsichtbar bleibt.
      "Cache-Control": "private, max-age=300",
    },
  });
}
