import { notFound } from "next/navigation";
import { PortalSessionsList } from "@/src/components/PortalSessionsList";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import {
  createSessionAvailabilityService,
  type SessionAvailabilitySummary,
} from "@uwe/player-hub";
import { setSessionAvailabilityAction } from "@/app/player-hub-actions";

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
  try {
    sessions = await auth.listGameSessionsForViewer(worldSlug, ctx);
    const upcomingIds = sessions
      .filter((session) => session.status === "planned" || session.status === "prepared")
      .map((session) => session.id);
    availability = await createSessionAvailabilityService(db).listForSessions(upcomingIds);
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
    <section className="portal-content-card">
      <h1>Sessions</h1>
      <p className="auth-lead">
        Kommende Spieltermine mit Verfügbarkeits-Abfrage und veröffentlichte Recaps.
      </p>

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
    </section>
  );
}
