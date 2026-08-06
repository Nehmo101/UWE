import { notFound } from "next/navigation";
import { PortalSessionsList } from "@/src/components/PortalSessionsList";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import {
  createPlayerGroupService,
  createSessionAvailabilityService,
  type SessionAvailabilitySummary,
} from "@uwe/player-hub";
import { setSessionAvailabilityAction } from "@/app/player-hub-actions";
import { PageHeader } from "@/src/components/shell";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalSessionsPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const viewerId = ctx.previewAsUserId ?? ctx.user?.id ?? null;
  const canVote = Boolean(ctx.user) && !ctx.previewAsUserId;

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let sessions;
  let availability: Map<string, SessionAvailabilitySummary> = new Map();
  /*
    Die Liste selbst ist bereits gefiltert — `listGameSessionsForViewer` lädt
    fremde Runden gar nicht erst. Was hier nachgeschlagen wird, ist nur die
    Beschriftung: heißt „keine Sessions" gerade „noch nichts veröffentlicht"
    oder „du sitzt an keinem Tisch"?
  */
  let groupName: string | null = null;
  let worldHasGroups = false;
  try {
    sessions = await auth.listGameSessionsForViewer(worldSlug, ctx);
    const upcomingIds = sessions
      .filter((session) => session.status === "planned" || session.status === "prepared")
      .map((session) => session.id);
    availability = await createSessionAvailabilityService(db).listForSessions(upcomingIds);

    const world = await db.world.findUnique({ where: { slug: worldSlug }, select: { id: true } });
    if (world) {
      worldHasGroups = (await db.playerGroup.count({ where: { worldId: world.id } })) > 0;
      groupName = viewerId
        ? ((await createPlayerGroupService(db).findForUser(world.id, viewerId))?.name ?? null)
        : null;
    }
  } finally {
    await db.$disconnect();
  }

  const upcoming = sessions.filter(
    (session) => session.status === "planned" || session.status === "prepared",
  );
  const recaps = sessions.filter(
    (session) => session.status !== "planned" && session.status !== "prepared",
  );

  const availabilityRecord = Object.fromEntries(availability.entries());

  return (
    <>
      <PageHeader
        title="Sessions"
        summary={
          groupName
            ? `Die Spieltermine und Recaps eurer Runde „${groupName}“.`
            : "Kommende Spieltermine mit Verfügbarkeits-Abfrage und veröffentlichte Recaps."
        }
      />

      {worldHasGroups && !groupName ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Du bist noch keiner Tischrunde zugeordnet — hier stehen deshalb nur Abende, die
          der ganzen Welt gelten. Der Spielleiter ordnet dich im Studio einer Runde zu.
        </p>
      ) : null}

      <PortalSessionsList
        worldSlug={worldSlug}
        upcoming={upcoming.map((session) => ({
          id: session.id,
          sessionNumber: session.sessionNumber,
          title: session.title,
          status: session.status,
          dateIso: session.date?.toISOString() ?? null,
        }))}
        recaps={recaps.map((session) => ({
          id: session.id,
          sessionNumber: session.sessionNumber,
          title: session.title,
          status: session.status,
          dateIso: session.date?.toISOString() ?? null,
        }))}
        availability={availabilityRecord}
        viewerId={viewerId}
        canVote={canVote}
        setAvailabilityAction={setSessionAvailabilityAction}
      />
    </>
  );
}
