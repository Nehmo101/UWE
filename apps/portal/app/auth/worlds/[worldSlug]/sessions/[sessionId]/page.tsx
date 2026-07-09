import { notFound } from "next/navigation";
import { PlayerNotesPanel } from "@/src/components/PlayerNotesPanel";
import { SessionRecapFeed } from "@/src/components/SessionRecapFeed";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { canCreatePlayerNote } from "@uwe/auth";
import { createAuthService, createPrismaClient } from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string; sessionId: string }>;
}

export default async function PortalSessionDetailPage({ params }: Props) {
  const { worldSlug, sessionId } = await params;
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let session;
  let notes;
  let newlyUnlocked;
  let canComment = false;
  let prevSessionId: string | null = null;
  let nextSessionId: string | null = null;

  try {
    const allSessions = await auth.listGameSessionsForViewer(worldSlug, ctx);
    const index = allSessions.findIndex((entry) => entry.id === sessionId);

    session = await auth.getGameSessionForViewer(worldSlug, sessionId, ctx);
    if (!session) {
      notFound();
    }

    if (index > 0) {
      prevSessionId = allSessions[index - 1]?.id ?? null;
    }
    if (index >= 0 && index < allSessions.length - 1) {
      nextSessionId = allSessions[index + 1]?.id ?? null;
    }

    newlyUnlocked = await auth.listNewlyUnlockedPagesForSession(worldSlug, sessionId, ctx);

    notes = session.campaignId
      ? await auth.listPlayerNotesForViewer(worldSlug, ctx, {
          gameSessionId: sessionId,
          campaignId: session.campaignId,
        })
      : [];

    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { guestCommentsEnabled: true },
    });
    canComment = Boolean(
      session.campaignId && world && canCreatePlayerNote(ctx, world.guestCommentsEnabled),
    );
  } finally {
    await db.$disconnect();
  }

  const returnPath = `/auth/worlds/${worldSlug}/sessions/${sessionId}`;

  return (
    <article className="portal-content-card">
      <a href={`/auth/worlds/${worldSlug}/sessions`} className="uwe-back-link">
        ← Zurück zu Sessions
      </a>

      <header>
        <h1>
          Session {session.sessionNumber}: {session.title}
        </h1>
        {session.date && <p className="auth-lead">{session.date.toLocaleDateString("de-DE")}</p>}
        {(prevSessionId || nextSessionId) && (
          <nav className="uwe-inline-actions" aria-label="Session-Navigation" style={{ marginTop: "0.5rem" }}>
            {prevSessionId ? (
              <a href={`/auth/worlds/${worldSlug}/sessions/${prevSessionId}`}>← Vorherige Session</a>
            ) : null}
            {nextSessionId ? (
              <a href={`/auth/worlds/${worldSlug}/sessions/${nextSessionId}`}>Nächste Session →</a>
            ) : null}
          </nav>
        )}
      </header>

      <SessionRecapFeed
        worldSlug={worldSlug}
        session={session}
        newlyUnlocked={newlyUnlocked}
      />

      {session.campaignId && (
        <PlayerNotesPanel
          worldSlug={worldSlug}
          campaignId={session.campaignId}
          notes={notes}
          currentUserId={user?.id ?? null}
          canComment={canComment}
          gameSessionId={sessionId}
          returnPath={returnPath}
        />
      )}
    </article>
  );
}
