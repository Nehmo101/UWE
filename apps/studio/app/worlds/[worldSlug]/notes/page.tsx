import { notFound } from "next/navigation";
import {
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
import { WorldCampaignSidebar, WorldContextSidebar, WorldModuleShell } from "@/components/WorldModuleShell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; view?: string }>;
}

export default async function StudioPlayerNotesPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, view } = await searchParams;
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

  return (
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="notes"
      breadcrumb={worldSectionBreadcrumb(world.name, worldSlug, "Spielernotizen", `/worlds/${worldSlug}/notes`)}
      pageHeader={{
        title: view === "all" ? "Alle Spielernotizen" : "Review Queue",
        summary:
          view === "all"
            ? "Alle Spielernotizen dieser Welt — inkl. Entwürfe und übernommene Notizen."
            : "Notizen, die Spieler an den GM gesendet haben — übernehmen, verbergen oder löschen.",
      }}
      sidebarExtra={
        <>
          <WorldContextSidebar
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
          <WorldCampaignSidebar
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
        </>
      }
      context={
        <SidebarSection title="Kontext">
          <p className="uwe-hint" style={{ margin: 0 }}>
            {reviewQueue.length} in Review Queue
          </p>
        </SidebarSection>
      }
    >
      {allNotes.length === 0 ? (
        <p className="uwe-empty">
          {view === "all" ? "Keine Spielernotizen vorhanden." : "Keine Notizen in der Review Queue."}
        </p>
      ) : (
        <div className="uwe-notes-queue">
          {allNotes.map((note) => (
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
                    <button type="submit" className="uwe-btn uwe-btn-primary uwe-btn-small">
                      Freigeben
                    </button>
                  </form>
                )}
                {note.status === "visible_to_dm" && note.pageId && (
                  <form action={adoptPlayerNoteAsContentBlockAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <input type="hidden" name="targetPageId" value={note.pageId} />
                    <button type="submit" className="uwe-btn uwe-btn-small">
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
                    <button type="submit" className="uwe-btn uwe-btn-small">
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
                    <button type="submit" className="uwe-btn uwe-btn-small">
                      Als ContentBlock übernehmen
                    </button>
                  </form>
                )}
                {note.status !== "hidden" && note.status !== "deleted" && (
                  <form action={hidePlayerNoteAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <button type="submit" className="uwe-btn uwe-btn-ghost uwe-btn-small">
                      Verbergen
                    </button>
                  </form>
                )}
                {note.status !== "deleted" && (
                  <form action={deletePlayerNoteAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <button type="submit" className="uwe-btn uwe-btn-danger uwe-btn-small">
                      Löschen
                    </button>
                  </form>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </WorldModuleShell>
  );
}
