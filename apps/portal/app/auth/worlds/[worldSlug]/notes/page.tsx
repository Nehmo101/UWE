import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerNotesPanel } from "@/src/components/PlayerNotesPanel";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import { canCreatePlayerNote } from "@uwe/auth";
import { PlayerNoteStatusBadge } from "@uwe/shared-ui";
import { createAuthService, createPrismaClient } from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalPlayerNotesPage({ params }: Props) {
  const { worldSlug } = await params;
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let notes;
  let canComment = false;
  let campaignId: string | null = null;
  const userId = user?.id ?? null;

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, name: true, guestCommentsEnabled: true },
    });
    if (!world) {
      notFound();
    }

    assertPortalCanReadWorld(ctx, world.id);

    notes = await auth.listPlayerNotesForViewer(worldSlug, ctx);
    canComment = canCreatePlayerNote(ctx, world.guestCommentsEnabled);

    const campaigns = await db.campaign.findMany({
      where: { world: { slug: worldSlug } },
      select: { id: true },
      take: 1,
    });
    campaignId = campaigns[0]?.id ?? null;
  } finally {
    await db.$disconnect();
  }

  const myNotes = notes.filter((note) => note.userId === userId);
  const partyNotes = notes.filter(
    (note) => note.userId !== userId && note.status === "accepted" && note.visibility === "party",
  );

  const returnPath = `/auth/worlds/${worldSlug}/notes`;

  return (
    <section className="portal-content-card">
      <h1>Meine Notizen</h1>
      <p className="auth-lead">
        Entwürfe, an den GM gesendete Notizen und vom Spielleiter freigegebene Gruppennotizen.
      </p>

      <section className="auth-block">
        <h2>Eigene Notizen</h2>
        {myNotes.length === 0 ? (
          <p className="auth-muted">Noch keine Notizen.</p>
        ) : (
          <ul className="auth-notes-list">
            {myNotes.map((note) => (
              <li key={note.id} className="auth-note-item">
                <header className="auth-note-header">
                  <PlayerNoteStatusBadge status={note.status} />
                  <span className="auth-muted">{note.updatedAt.toLocaleDateString("de-DE")}</span>
                </header>
                <p className="auth-note-content">{note.content}</p>
                {note.pageSlug && (
                  <Link href={`/auth/worlds/${worldSlug}/${note.pageSlug}`}>{note.pageTitle}</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {partyNotes.length > 0 && (
        <section className="auth-block">
          <h2>Gruppennotizen</h2>
          <ul className="auth-notes-list">
            {partyNotes.map((note) => (
              <li key={note.id} className="auth-note-item">
                <header className="auth-note-header">
                  <strong>{note.authorDisplayName}</strong>
                  <PlayerNoteStatusBadge status={note.status} />
                </header>
                <p className="auth-note-content">{note.content}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {campaignId && (
        <PlayerNotesPanel
          worldSlug={worldSlug}
          campaignId={campaignId}
          notes={[]}
          currentUserId={userId}
          canComment={canComment}
          returnPath={returnPath}
        />
      )}
    </section>
  );
}
