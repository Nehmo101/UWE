import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/src/components/AuthHeader";
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

  try {
    session = await auth.getGameSessionForViewer(worldSlug, sessionId, ctx);
    if (!session) {
      notFound();
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
    <main className="auth-page">
      <AuthHeader user={user} />
      <article className="auth-card auth-card-wide">
        <div className="auth-breadcrumb">
          <Link href="/auth/worlds">Welten</Link> /{" "}
          <Link href={`/auth/worlds/${worldSlug}`}>{worldSlug}</Link> /{" "}
          <Link href={`/auth/worlds/${worldSlug}/sessions`}>Sessions</Link> /{" "}
          {session.title}
        </div>

        <header>
          <h1>
            Session {session.sessionNumber}: {session.title}
          </h1>
          {session.date && (
            <p className="auth-lead">{session.date.toLocaleDateString("de-DE")}</p>
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
    </main>
  );
}
