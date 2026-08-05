import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerNotesPanel, noteListTitle } from "@/src/components/PlayerNotesPanel";
import { submitPlayerNoteAction, updatePlayerNoteAction } from "@/app/note-actions";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import { canCreatePlayerNote } from "@uwe/auth";
import { PlayerNoteStatusBadge } from "@uwe/shared-ui";
import {
  createAuthService,
  createPrismaClient,
  PLAYER_NOTE_CATEGORIES,
  PLAYER_NOTE_CATEGORY_LABELS,
  type PlayerNoteCategory,
  type PortalPlayerNoteView,
} from "@uwe/database/server";
import { PageHeader } from "@/src/components/shell";
import { cn } from "@/src/components/ui/cn";
import { badgeVariants } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ kategorie?: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "full" });
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function parseCategory(raw: string | undefined): PlayerNoteCategory | null {
  return raw && (PLAYER_NOTE_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as PlayerNoteCategory)
    : null;
}

/** Notizen nach Spielabend bündeln, jüngster Abend zuerst; ohne Datum ans Ende. */
function groupBySessionDate(notes: PortalPlayerNoteView[]) {
  const groups = new Map<string, { date: Date | null; notes: PortalPlayerNoteView[] }>();
  for (const note of notes) {
    const key = note.sessionDate ? new Date(note.sessionDate).toISOString().slice(0, 10) : "";
    const bucket = groups.get(key) ?? {
      date: note.sessionDate ? new Date(note.sessionDate) : null,
      notes: [],
    };
    bucket.notes.push(note);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : b.localeCompare(a)))
    .map(([, bucket]) => bucket);
}

/**
 * Spielernotizen als Logbuch: gebündelt nach Spielabend, filterbar nach
 * Kategorie. Neuester Abend oben — so liest sich die Seite wie eine Chronik
 * der eigenen Runde, nicht wie ein Zettelkasten.
 */
export default async function PortalPlayerNotesPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { kategorie } = await searchParams;
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const categoryFilter = parseCategory(kategorie);

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let notes: PortalPlayerNoteView[];
  let canComment = false;
  let campaignId: string | null = null;
  let sessionOptions: Array<{ id: string; label: string }> = [];
  let activeSessionId: string | null = null;
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

    // Session-Bezug (F5): sichtbare Sessions als Auswahl, vorausgewählt die
    // aktive (jüngste). Die Kampagne folgt der Session — früher wurde stumpf
    // die erste Kampagne der Welt genommen, bei mehreren Kampagnen landeten
    // Notizen damit in der falschen.
    const sessions = [...(await auth.listGameSessionsForViewer(worldSlug, ctx))].sort(
      (a, b) => b.sessionNumber - a.sessionNumber,
    );
    sessionOptions = sessions.map((session) => ({
      id: session.id,
      label: `Session ${session.sessionNumber}: ${session.title}`,
    }));
    activeSessionId = sessions[0]?.id ?? null;
    campaignId = sessions[0]?.campaignId ?? null;

    if (!campaignId) {
      const campaigns = await db.campaign.findMany({
        where: { world: { slug: worldSlug } },
        select: { id: true },
        take: 1,
      });
      campaignId = campaigns[0]?.id ?? null;
    }
  } finally {
    await db.$disconnect();
  }

  const myNotes = notes.filter((note) => note.userId === userId);
  const partyNotes = notes.filter(
    (note) => note.userId !== userId && note.status === "accepted" && note.visibility === "party",
  );

  const filteredMyNotes = categoryFilter
    ? myNotes.filter((note) => note.category === categoryFilter)
    : myNotes;

  const sessionGroups = groupBySessionDate(filteredMyNotes);
  const usedCategories = new Set(myNotes.map((note) => note.category));
  const basePath = `/auth/worlds/${worldSlug}/notes`;
  const returnPath = categoryFilter ? `${basePath}?kategorie=${categoryFilter}` : basePath;

  return (
    <>
      <PageHeader
        title="Spielernotizen"
        summary="Dein Logbuch dieser Welt — nach Spielabend geordnet, nach Kategorie filterbar."
      />

      {usedCategories.size > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={basePath}
            className={cn(badgeVariants({ variant: !categoryFilter ? "accent" : "default" }))}
          >
            Alle
          </Link>
          {PLAYER_NOTE_CATEGORIES.filter((category) => usedCategories.has(category)).map(
            (category) => (
              <Link
                key={category}
                href={`${basePath}?kategorie=${category}`}
                className={cn(
                  badgeVariants({ variant: categoryFilter === category ? "accent" : "default" }),
                )}
              >
                {PLAYER_NOTE_CATEGORY_LABELS[category]}
              </Link>
            ),
          )}
        </div>
      ) : null}

      {sessionGroups.map((group, index) => (
        <Card key={group.date ? group.date.toISOString() : `ohne-${index}`} className="mb-4">
          <CardHeader>
            <CardTitle>
              {group.date ? DATE_FORMAT.format(group.date) : "Ohne Spielabend"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {group.notes.map((note) => (
                <li key={note.id} className="rounded-[var(--radius)] border border-border p-4">
                  <header className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <strong>{noteListTitle(note)}</strong>
                    <PlayerNoteStatusBadge status={note.status} />
                  </header>
                  <p className="text-sm text-muted-foreground">
                    {PLAYER_NOTE_CATEGORY_LABELS[note.category]}
                    {note.sessionTitle ? ` · ${note.sessionTitle}` : null}
                    {" · notiert "}
                    {SHORT_DATE_FORMAT.format(note.updatedAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{note.content}</p>
                  {note.pageSlug ? (
                    <Link
                      href={`/auth/worlds/${worldSlug}/${note.pageSlug}`}
                      className="mt-2 inline-block text-sm text-primary hover:underline"
                    >
                      {note.pageTitle}
                    </Link>
                  ) : null}
                  {note.status === "draft" ? (
                    <div className="auth-note-actions">
                      <form action={submitPlayerNoteAction}>
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="noteId" value={note.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <button type="submit" className="auth-btn auth-btn-small">
                          An GM senden
                        </button>
                      </form>
                      <details className="auth-note-edit">
                        <summary>Bearbeiten</summary>
                        <form action={updatePlayerNoteAction} className="auth-note-form">
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="noteId" value={note.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <label>
                            Titel
                            <input
                              type="text"
                              name="title"
                              defaultValue={note.title ?? ""}
                              maxLength={200}
                            />
                          </label>
                          <label>
                            Kategorie
                            <select name="category" defaultValue={note.category}>
                              {PLAYER_NOTE_CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {PLAYER_NOTE_CATEGORY_LABELS[category]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Spielabend
                            <input
                              type="date"
                              name="sessionDate"
                              defaultValue={
                                note.sessionDate
                                  ? new Date(note.sessionDate).toISOString().slice(0, 10)
                                  : ""
                              }
                            />
                          </label>
                          <textarea name="content" defaultValue={note.content} rows={3} required />
                          <button type="submit" className="auth-btn auth-btn-small">
                            Speichern
                          </button>
                        </form>
                      </details>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {filteredMyNotes.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {categoryFilter
            ? "Keine Notizen in dieser Kategorie."
            : "Noch keine eigenen Notizen — leg unten die erste an."}
        </p>
      ) : null}

      {campaignId ? (
        <PlayerNotesPanel
          worldSlug={worldSlug}
          campaignId={campaignId}
          notes={[]}
          currentUserId={userId}
          canComment={canComment}
          sessions={sessionOptions}
          defaultSessionId={activeSessionId}
          returnPath={returnPath}
        />
      ) : null}

      {partyNotes.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Gruppennotizen</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {partyNotes.map((note) => (
                <li key={note.id} className="rounded-[var(--radius)] border border-border p-4">
                  <header className="mb-2 flex flex-wrap items-center gap-2">
                    <strong>{noteListTitle(note)}</strong>
                    <PlayerNoteStatusBadge status={note.status} />
                  </header>
                  <p className="text-sm text-muted-foreground">
                    {note.authorDisplayName}
                    {note.sessionDate
                      ? ` · Spielabend ${SHORT_DATE_FORMAT.format(new Date(note.sessionDate))}`
                      : null}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{note.content}</p>
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
