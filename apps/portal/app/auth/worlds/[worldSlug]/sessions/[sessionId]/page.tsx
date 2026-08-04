import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PlayerNotesPanel } from "@/src/components/PlayerNotesPanel";
import { SessionRecapFeed } from "@/src/components/SessionRecapFeed";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { canCreatePlayerNote } from "@uwe/auth";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";

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

  const db = getSharedPrismaClient();
  const auth = createAuthService(db);

  let session;
  let notes;
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

    notes = session.campaignId
      ? await auth.listPlayerNotesForViewer(worldSlug, ctx, {
          gameSessionId: sessionId,
          campaignId: session.campaignId,
        })
      : [];

    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    canComment = Boolean(
      session.campaignId && world && canCreatePlayerNote(ctx),
    );
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }

  const returnPath = `/auth/worlds/${worldSlug}/sessions/${sessionId}`;

  return (
    <article className="grid gap-6">
      <Link
        href={`/auth/worlds/${worldSlug}/sessions`}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Zurück zu Sessions
      </Link>

      <header className="space-y-2 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Session {session.sessionNumber}: {session.title}
        </h1>
        {session.date ? (
          <p className="text-sm text-muted-foreground">
            {session.date.toLocaleDateString("de-DE")}
          </p>
        ) : null}
        {prevSessionId || nextSessionId ? (
          <nav className="mt-2 flex flex-wrap gap-4 text-sm" aria-label="Session-Navigation">
            {prevSessionId ? (
              <Link
                href={`/auth/worlds/${worldSlug}/sessions/${prevSessionId}`}
                className="text-primary hover:underline"
              >
                ← Vorherige Session
              </Link>
            ) : null}
            {nextSessionId ? (
              <Link
                href={`/auth/worlds/${worldSlug}/sessions/${nextSessionId}`}
                className="text-primary hover:underline"
              >
                Nächste Session →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </header>

      <SessionRecapFeed
        worldSlug={worldSlug}
        session={session}
      />

      {session.campaignId ? (
        <PlayerNotesPanel
          worldSlug={worldSlug}
          campaignId={session.campaignId}
          notes={notes}
          currentUserId={user?.id ?? null}
          canComment={canComment}
          gameSessionId={sessionId}
          returnPath={returnPath}
        />
      ) : null}
    </article>
  );
}
