import { notFound } from "next/navigation";
import {
  GlobalSearchForm,
  PlayerNoteStatusBadge,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createAuthService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import {
  acceptPlayerNoteAction,
  adoptPlayerNoteAsContentBlockAction,
  adoptPlayerNoteAsPageAction,
  deletePlayerNoteAction,
  hidePlayerNoteAction,
} from "../../../note-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; view?: string; q?: string }>;
}

export default async function StudioPlayerNotesPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, view, q } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : null;

  const db = createPrismaClient();
  const auth = createAuthService(db);

  const reviewQueue = await auth.listPlayerNoteReviewQueue(
    worldSlug,
    selectedCampaign?.id,
  );

  const allNotes =
    view === "all"
      ? await auth.listPlayerNotesForDm(worldSlug, {
          campaignId: selectedCampaign?.id,
        })
      : reviewQueue;

  await db.$disconnect();

  const pages = await repo.listPagesByWorld(worldSlug, {
    campaignId: selectedCampaign?.id,
  });

  const notesBase = `/worlds/${worldSlug}/notes`;
  const viewAllSuffix = view === "all" ? "?view=all" : "";
  const searchQuery = q?.trim().toLowerCase() ?? "";

  const filteredNotes = searchQuery
    ? allNotes.filter((note) => {
        const haystack = [
          note.content,
          note.authorDisplayName,
          note.campaignName,
          note.pageTitle,
          note.sessionTitle,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(searchQuery);
      })
    : allNotes;

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Spielernotizen", `/worlds/${worldSlug}/notes`)}
        />
      }
      contextPanel={
        <>
          <CampaignSidebar
            title="Ansicht"
            items={[
              {
                label: "Review Queue",
                href: `${notesBase}${campaignSlug ? `?campaign=${campaignSlug}` : ""}`,
                active: view !== "all",
              },
              {
                label: "Alle Notizen",
                href: `${notesBase}?view=all${campaignSlug ? `&campaign=${campaignSlug}` : ""}`,
                active: view === "all",
              },
            ]}
          />
          <CampaignSidebar
            items={[
              {
                label: "Alle",
                href: `${notesBase}${viewAllSuffix}`,
                active: !campaignSlug,
              },
              ...campaigns.map((c) => ({
                label: c.name,
                href: `${notesBase}?${view === "all" ? "view=all&" : ""}campaign=${c.slug}`,
                active: campaignSlug === c.slug,
              })),
            ]}
          />
          <SidebarSection title="Kontext">
            <p className="uwe-hint" style={{ margin: 0 }}>
              {reviewQueue.length} in Review Queue
            </p>
          </SidebarSection>
        </>
      }
    >
      <PageHeader
        title={view === "all" ? "Alle Spielernotizen" : "Review Queue"}
        summary={
          view === "all"
            ? "Alle Spielernotizen dieser Welt — inkl. Entwürfe und übernommene Notizen."
            : "Notizen, die Spieler an den GM gesendet haben — übernehmen, verbergen oder löschen."
        }
      />

      <GlobalSearchForm
        action={notesBase}
        query={q}
        placeholder="Notizen durchsuchen (Inhalt, Autor, Seite, Session)…"
        extraFields={
          <>
            {view === "all" ? <input type="hidden" name="view" value="all" /> : null}
            {campaignSlug ? <input type="hidden" name="campaign" value={campaignSlug} /> : null}
          </>
        }
      />

      {filteredNotes.length === 0 ? (
        <p className="uwe-v2-empty">
          {searchQuery
            ? "Keine Notizen passen zur Suche."
            : view === "all"
              ? "Keine Spielernotizen vorhanden."
              : "Keine Notizen in der Review Queue."}
        </p>
      ) : (
        <div className="uwe-notes-queue">
          {filteredNotes.map((note) => (
            <article key={note.id} className="uwe-note-card">
              <header className="uwe-note-card-header">
                <div>
                  <strong>{note.authorDisplayName}</strong>
                  <span className="uwe-note-meta">
                    {note.campaignName}
                    {note.pageTitle ? ` · Seite: ${note.pageTitle}` : ""}
                    {note.sessionTitle ? ` · Session ${note.sessionNumber}: ${note.sessionTitle}` : ""}
                  </span>
                </div>
                <PlayerNoteStatusBadge status={note.status} />
              </header>
              <p className="uwe-note-card-content">{note.content}</p>
              <footer className="uwe-note-card-actions">
                {note.status === "visible_to_dm" && (
                  <form action={acceptPlayerNoteAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
                      Freigeben
                    </button>
                  </form>
                )}
                {note.status === "visible_to_dm" && note.pageId && (
                  <form action={adoptPlayerNoteAsContentBlockAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <input type="hidden" name="targetPageId" value={note.pageId} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                      Als ContentBlock übernehmen
                    </button>
                  </form>
                )}
                {note.status === "visible_to_dm" && (
                  <form action={adoptPlayerNoteAsPageAction} className="uwe-note-adopt-page">
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <input
                      type="text"
                      name="title"
                      placeholder="Seitentitel (optional)"
                      className="uwe-input-inline"
                    />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                      Als Seite übernehmen
                    </button>
                  </form>
                )}
                {note.status === "visible_to_dm" && !note.pageId && pages.length > 0 && (
                  <form action={adoptPlayerNoteAsContentBlockAction} className="uwe-note-adopt-block">
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <select name="targetPageId" required className="uwe-input-inline">
                      <option value="">Zielseite wählen…</option>
                      {pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.title}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                      Als ContentBlock übernehmen
                    </button>
                  </form>
                )}
                {note.status !== "hidden" && note.status !== "deleted" && (
                  <form action={hidePlayerNoteAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                      Verbergen
                    </button>
                  </form>
                )}
                {note.status !== "deleted" && (
                  <form action={deletePlayerNoteAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-danger uwe-v2-btn-sm">
                      Löschen
                    </button>
                  </form>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </WorldShell>
  );
}
