import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_STATUSES,
  createSessionAvailabilityService,
  type SessionAvailabilitySummary,
} from "@uwe/player-hub";
import { setSessionAvailabilityAction } from "@/app/player-hub-actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
  timeStyle: "short",
});

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

  return (
    <section className="portal-content-card">
      <h1>Sessions</h1>
      <p className="auth-lead">
        Kommende Spieltermine mit Verfügbarkeits-Abfrage und veröffentlichte Recaps.
      </p>

      {upcoming.length > 0 && (
        <>
          <h2>Kommende Sessions</h2>
          <ul className="auth-page-list">
            {upcoming.map((session) => {
              const summary = availability.get(session.id);
              const ownVote = viewerId
                ? summary?.votes.find((vote) => vote.userId === viewerId)
                : undefined;
              return (
                <li key={session.id}>
                  <strong>
                    Session {session.sessionNumber}: {session.title}
                  </strong>
                  <p className="portal-dash-summary">
                    {session.date ? DATE_FORMAT.format(session.date) : "Termin noch offen"}
                  </p>

                  {summary && (
                    <p className="auth-muted">
                      Zusagen: {summary.counts.yes} · Vielleicht: {summary.counts.maybe} ·
                      Absagen: {summary.counts.no}
                      {summary.votes.length > 0 && (
                        <>
                          {" — "}
                          {summary.votes
                            .map(
                              (vote) =>
                                `${vote.displayName}: ${AVAILABILITY_LABELS[vote.status]}`,
                            )
                            .join(", ")}
                        </>
                      )}
                    </p>
                  )}

                  {canVote && (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {AVAILABILITY_STATUSES.map((status) => (
                        <form key={status} action={setSessionAvailabilityAction}>
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="status" value={status} />
                          <button
                            type="submit"
                            className="auth-inline-button"
                            aria-pressed={ownVote?.status === status}
                            style={
                              ownVote?.status === status
                                ? { fontWeight: 700, textDecoration: "underline" }
                                : undefined
                            }
                          >
                            {AVAILABILITY_LABELS[status]}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {upcoming.length === 0 && recaps.length === 0 && (
        <PortalEmptyState
          title="Keine Sessions veröffentlicht"
          description="Kommende Termine und Recaps erscheinen hier, sobald dein Spielleiter sie freigibt."
          icon="calendar"
        />
      )}

      {recaps.length > 0 && (
        <>
          <h2>Session-Recaps</h2>
          <ul className="auth-page-list">
            {recaps.map((session) => (
              <li key={session.id}>
                <Link href={`/auth/worlds/${worldSlug}/sessions/${session.id}`}>
                  <strong>
                    Session {session.sessionNumber}: {session.title}
                  </strong>
                  {session.date && <span>{session.date.toLocaleDateString("de-DE")}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
