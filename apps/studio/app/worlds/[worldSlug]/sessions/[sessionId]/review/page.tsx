import Link from "next/link";
import { notFound } from "next/navigation";
import { GameSessionStatusBadge } from "@uwe/shared-ui";
import {
  buildPageUrl,
  buildRecapDraft,
  buildSessionReviewDraft,
  createAuthService,
  createPrismaClient,
  createSessionLiveService,
  getAppRepository,
  sessionLiveKindLabel,
  type SessionLiveEntryRecord,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { isLikelyGameSessionId } from "@/src/lib/session-route";
import { saveSessionRecapDraftAction } from "@/app/session-live-actions";

interface Props {
  params: Promise<{ worldSlug: string; sessionId: string }>;
  searchParams: Promise<{ saved?: string }>;
}

const TIME_FORMAT = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

function ActionableList({
  title,
  entries,
  hrefFor,
  hint,
}: {
  title: string;
  entries: SessionLiveEntryRecord[];
  hrefFor: (entry: SessionLiveEntryRecord) => string | null;
  hint: string;
}) {
  if (entries.length === 0) return null;
  return (
    <section className="uwe-v2-section">
      <h2 className="uwe-v2-section-title">
        {title} ({entries.length})
      </h2>
      <p className="uwe-dashboard-muted">{hint}</p>
      <ul className="uwe-linked-list">
        {entries.map((entry) => {
          const href = hrefFor(entry);
          return (
            <li key={entry.id}>
              <span className="uwe-dashboard-muted">{TIME_FORMAT.format(entry.createdAt)}</span>{" "}
              {entry.content}
              {href ? (
                <>
                  {" — "}
                  <Link href={href}>betroffene Seite öffnen →</Link>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function SessionReviewPage({ params, searchParams }: Props) {
  const { worldSlug, sessionId } = await params;
  const { saved } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();
  if (!isLikelyGameSessionId(sessionId)) notFound();

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const session = await auth.getGameSessionForDm(worldSlug, sessionId);
  const entries = session ? await createSessionLiveService(db).listEntries(sessionId) : [];
  await db.$disconnect();

  if (!session) notFound();

  const draft = buildSessionReviewDraft(entries);
  const pageById = new Map(session.linkedPages.map((page) => [page.id, page]));
  const hrefFor = (entry: SessionLiveEntryRecord): string | null => {
    if (!entry.refPageId) return null;
    const page = pageById.get(entry.refPageId);
    return page ? buildPageUrl(worldSlug, page.type, page.slug) : null;
  };

  const recapSuggestion = session.summaryDm?.trim() || buildRecapDraft(entries);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={[
            ...worldDetailBreadcrumb(
              world.name,
              worldSlug,
              "Sessions",
              `/worlds/${worldSlug}/sessions`,
              session.title,
            ),
            { label: "Review" },
          ]}
        />
      }
    >
      <PageHeader
        title={`Review · Session ${session.sessionNumber}`}
        summary="Vorgemerkte Ereignisse aus dem Live-Modus. Prüfe und übernimm sie bewusst — nichts wird automatisch Kanon."
        meta={<GameSessionStatusBadge status={session.status} />}
        actions={
          <Link href={`/worlds/${worldSlug}/sessions/${sessionId}`} className="uwe-v2-btn">
            Zur Session
          </Link>
        }
      />

      {saved ? (
        <p className="uwe-inspector-ok" role="status">
          ✓ Recap-Entwurf gespeichert.
        </p>
      ) : null}

      {draft.total === 0 ? (
        <p className="uwe-dashboard-muted">
          Für diese Session wurden keine Live-Einträge vorgemerkt.
        </p>
      ) : null}

      <ActionableList
        title="Quest-Änderungen"
        entries={draft.questUpdates}
        hrefFor={hrefFor}
        hint="Setze den Quest-Status auf der jeweiligen Quest-Seite."
      />
      <ActionableList
        title="Beute"
        entries={draft.loot}
        hrefFor={hrefFor}
        hint="Übertrage die Beute in den Gruppenschatz oder das Charakter-Inventar."
      />
      <ActionableList
        title="NPC-Änderungen"
        entries={draft.npcUpdates}
        hrefFor={hrefFor}
        hint="Aktualisiere die NPC-Seiten; kanonische Fakten laufen über den normalen Review."
      />

      {draft.bookmarks.length > 0 || draft.notes.length > 0 ? (
        <section className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">Verlauf & Lesezeichen</h2>
          <ul className="uwe-linked-list">
            {[...draft.notes, ...draft.bookmarks].map((entry) => (
              <li key={entry.id}>
                <span className="uwe-dashboard-muted">{TIME_FORMAT.format(entry.createdAt)}</span>{" "}
                <span className="uwe-badge">{sessionLiveKindLabel(entry.kind)}</span> {entry.content}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Recap-Entwurf (DM)</h2>
        <p className="uwe-dashboard-muted">
          Aus den Einträgen vorgeschlagen. Bearbeiten und als DM-Zusammenfassung der
          Session speichern.
        </p>
        <form action={saveSessionRecapDraftAction}>
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <textarea name="summaryDm" rows={12} defaultValue={recapSuggestion} />
          <div className="uwe-form-actions">
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
              Recap-Entwurf speichern
            </button>
          </div>
        </form>
      </section>
    </WorldShell>
  );
}
