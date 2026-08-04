import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerNotesPanel } from "@/src/components/PlayerNotesPanel";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import { canCreatePlayerNote } from "@uwe/auth";
import { PlayerNoteStatusBadge } from "@uwe/shared-ui";
import { createAuthService } from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { PageHeader } from "@/src/components/shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

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

  const db = getSharedPrismaClient();
  const auth = createAuthService(db);

  let notes;
  let canComment = false;
  let campaignId: string | null = null;
  const userId = user?.id ?? null;

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, name: true },
    });
    if (!world) {
      notFound();
    }

    assertPortalCanReadWorld(ctx, world.id);

    notes = await auth.listPlayerNotesForViewer(worldSlug, ctx);
    canComment = canCreatePlayerNote(ctx);

    const campaigns = await db.campaign.findMany({
      where: { world: { slug: worldSlug } },
      select: { id: true },
      take: 1,
    });
    campaignId = campaigns[0]?.id ?? null;
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }

  const myNotes = notes.filter((note) => note.userId === userId);
  const partyNotes = notes.filter(
    (note) => note.userId !== userId && note.status === "accepted" && note.visibility === "party",
  );

  const returnPath = `/auth/worlds/${worldSlug}/notes`;

  return (
    <>
      <PageHeader
        title="Meine Notizen"
        summary="Entwürfe, an den GM gesendete Notizen und vom Spielleiter freigegebene Gruppennotizen."
      />

      {campaignId ? (
        <PlayerNotesPanel
          worldSlug={worldSlug}
          campaignId={campaignId}
          notes={myNotes}
          currentUserId={userId}
          canComment={canComment}
          returnPath={returnPath}
        />
      ) : (
        myNotes.length > 0 && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Eigene Notizen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3">
                {myNotes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-[var(--radius)] border border-border p-4"
                  >
                    <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <PlayerNoteStatusBadge status={note.status} />
                      <span className="text-sm text-muted-foreground">
                        {note.updatedAt.toLocaleDateString("de-DE")}
                      </span>
                    </header>
                    <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                    {note.pageSlug ? (
                      <Link
                        href={`/auth/worlds/${worldSlug}/${note.pageSlug}`}
                        className="mt-2 inline-block text-sm text-primary hover:underline"
                      >
                        {note.pageTitle}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      )}

      {partyNotes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Gruppennotizen</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {partyNotes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-[var(--radius)] border border-border p-4"
                >
                  <header className="mb-2 flex flex-wrap items-center gap-2">
                    <strong>{note.authorDisplayName}</strong>
                    <PlayerNoteStatusBadge status={note.status} />
                  </header>
                  <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                  {note.pageSlug ? (
                    <Link
                      href={`/auth/worlds/${worldSlug}/${note.pageSlug}`}
                      className="mt-2 inline-block text-sm text-primary hover:underline"
                    >
                      {note.pageTitle}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
