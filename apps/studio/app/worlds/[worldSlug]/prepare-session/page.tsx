import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GameSessionStatusBadge,
} from "@uwe/shared-ui";
import {
  createAiRunService,
  createAuthService,
  createPrismaClient,
  getAppRepository,
  type DmGameSessionView,
} from "@uwe/database/server";
import {
  buildPrepareNextSessionOutline,
  getInferenceStatus,
  serializePrepareNextSessionOutline,
} from "@uwe/ai-brain";
import { PrepareSessionPanel } from "@/components/PrepareSessionPanel";
import { SettingsCollapsiblePanel } from "@/components/SettingsCollapsiblePanel";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

function isUpcomingSession(session: DmGameSessionView): boolean {
  return session.status === "planned" || session.status === "prepared";
}

function sortBySessionNumber(a: DmGameSessionView, b: DmGameSessionView): number {
  return a.sessionNumber - b.sessionNumber;
}

function pickReferenceSession(sessions: DmGameSessionView[]): DmGameSessionView | null {
  const played = sessions
    .filter((session) => session.status === "played" || session.status === "summarized")
    .sort(sortBySessionNumber);
  if (played.length > 0) {
    return played[played.length - 1] ?? null;
  }

  const withContext = sessions
    .filter((session) => session.summaryDm?.trim() || session.openPlots?.trim())
    .sort(sortBySessionNumber);
  if (withContext.length > 0) {
    return withContext[withContext.length - 1] ?? null;
  }

  return sessions.length > 0 ? (sessions.sort(sortBySessionNumber)[sessions.length - 1] ?? null) : null;
}

export default async function PrepareSessionPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const aiRuns = createAiRunService();
  const [sessions, inference, latestPrepRun] = await Promise.all([
    auth.listGameSessionsForDm(worldSlug),
    getInferenceStatus({ useMock: process.env.AI_USE_MOCK === "true" }),
    aiRuns.list({
      worldId: world.id,
      taskType: "next_session_prep",
      status: "completed",
      limit: 1,
    }),
  ]);
  await db.$disconnect();

  const upcomingSessions = sessions.filter(isUpcomingSession).sort(sortBySessionNumber);
  const referenceSession = pickReferenceSession(sessions);
  const outline =
    referenceSession &&
    buildPrepareNextSessionOutline({
      worldSlug,
      lastSessionTitle: referenceSession.title,
      summaryDm: referenceSession.summaryDm,
      openPlots: referenceSession.openPlots,
      playerDecisions: referenceSession.playerDecisions,
      linkedPages: referenceSession.linkedPages.map((page) => ({
        title: page.title,
        type: page.type,
      })),
    });
  const outlineText = outline ? serializePrepareNextSessionOutline(outline) : null;

  const defaultSessionId =
    upcomingSessions[0]?.id ?? referenceSession?.id ?? sessions[0]?.id;

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Session vorbereiten",
            `/worlds/${worldSlug}/prepare-session`,
          )}
        />
      }
    >
      <PageHeader
        title="Session vorbereiten"
        summary="Kommende Sessions im Blick, heuristische Outline-Vorschau und KI-Generator für das nächste Spielabend-Paket."
        actions={
          <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={`/worlds/${worldSlug}/sessions`}>
            Alle Sessions
          </Link>
        }
      />

      <SettingsCollapsiblePanel
        title="Kommende Sessions"
        summary={`${upcomingSessions.length} geplant`}
        defaultOpen
      >
        {upcomingSessions.length === 0 ? (
          <p className="uwe-hint">
            Keine geplanten Sessions.{" "}
            <Link href={`/worlds/${worldSlug}/sessions/new`}>Neue Session anlegen →</Link>
          </p>
        ) : (
          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Titel</th>
                <th>Datum</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingSessions.map((session) => (
                <tr key={session.id}>
                  <td data-label="#">{session.sessionNumber}</td>
                  <td data-label="Titel">
                    <Link href={`/worlds/${worldSlug}/sessions/${session.id}`}>
                      {session.title}
                    </Link>
                  </td>
                  <td data-label="Datum">
                    {session.date ? session.date.toLocaleDateString("de-DE") : "—"}
                  </td>
                  <td data-label="Status">
                    <GameSessionStatusBadge status={session.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SettingsCollapsiblePanel>

      {latestPrepRun.runs[0]?.resultText ? (
        <SettingsCollapsiblePanel
          title="Letztes Session-Paket (Brain)"
          summary="SSR aus letztem abgeschlossenen KI-Lauf"
          defaultOpen
        >
          <p className="uwe-dashboard-muted">
            Abgeschlossen {latestPrepRun.runs[0].updatedAt.toLocaleString("de-DE")} — Review vor
            Übernahme.
          </p>
          <pre className="uwe-pre-block" style={{ whiteSpace: "pre-wrap" }}>
            {latestPrepRun.runs[0].resultText}
          </pre>
          <p>
            <Link href={`/worlds/${worldSlug}/ai-runs/${latestPrepRun.runs[0].id}`}>
              AI Run öffnen →
            </Link>
          </p>
        </SettingsCollapsiblePanel>
      ) : null}

      {outlineText && referenceSession && (
        <SettingsCollapsiblePanel
          title="Heuristische Outline-Vorschau"
          summary={`Aus Session #${referenceSession.sessionNumber}`}
          defaultOpen={false}
        >
          <p className="uwe-dashboard-muted">
            Deterministische Vorschau aus Session #{referenceSession.sessionNumber} „
            {referenceSession.title}“ — kein KI-Ersatz, nur Orientierung vor dem Generator-Lauf.
          </p>
          <pre className="uwe-pre-block" style={{ whiteSpace: "pre-wrap" }}>
            {outlineText}
          </pre>
        </SettingsCollapsiblePanel>
      )}

      <SettingsCollapsiblePanel
        title="KI Session-Paket generieren"
        summary="RTX-only — Review vor Übernahme"
        defaultOpen
      >
        <PrepareSessionPanel
          worldSlug={worldSlug}
          sessions={sessions.map((session) => ({
            id: session.id,
            title: session.title,
            sessionNumber: session.sessionNumber,
          }))}
          defaultSessionId={defaultSessionId}
          rtxReady={inference.online}
          rtxEnabled={inference.enabled}
        />
      </SettingsCollapsiblePanel>
    </WorldShell>
  );
}
