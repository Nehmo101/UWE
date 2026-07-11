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
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  EmptyState,
  Input,
} from "@/src/components/ui";

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
            <p className="text-sm text-muted-foreground">{reviewQueue.length} in Review Queue</p>
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
        <EmptyState
          title={
            searchQuery
              ? "Keine Notizen passen zur Suche."
              : view === "all"
                ? "Keine Spielernotizen vorhanden."
                : "Keine Notizen in der Review Queue."
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {filteredNotes.map((note) => (
            <Card key={note.id}>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                <div>
                  <strong>{note.authorDisplayName}</strong>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {note.campaignName}
                    {note.pageTitle ? ` · Seite: ${note.pageTitle}` : ""}
                    {note.sessionTitle ? ` · Session ${note.sessionNumber}: ${note.sessionTitle}` : ""}
                  </span>
                </div>
                <PlayerNoteStatusBadge status={note.status} />
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
              </CardContent>
              <CardFooter className="flex flex-wrap items-center gap-2">
                {note.status === "visible_to_dm" && (
                  <form action={acceptPlayerNoteAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <Button type="submit" size="sm">
                      Freigeben
                    </Button>
                  </form>
                )}
                {note.status === "visible_to_dm" && note.pageId && (
                  <form action={adoptPlayerNoteAsContentBlockAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <input type="hidden" name="targetPageId" value={note.pageId} />
                    <Button type="submit" variant="outline" size="sm">
                      Als ContentBlock übernehmen
                    </Button>
                  </form>
                )}
                {note.status === "visible_to_dm" && (
                  <form
                    action={adoptPlayerNoteAsPageAction}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <Input
                      type="text"
                      name="title"
                      placeholder="Seitentitel (optional)"
                      className="h-8 w-48"
                    />
                    <Button type="submit" variant="outline" size="sm">
                      Als Seite übernehmen
                    </Button>
                  </form>
                )}
                {note.status === "visible_to_dm" && !note.pageId && pages.length > 0 && (
                  <form
                    action={adoptPlayerNoteAsContentBlockAction}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für
                        "Zielseite wählen…" — natives Select beibehalten. */}
                    <select
                      name="targetPageId"
                      required
                      className="h-8 w-48 rounded-[var(--radius)] border border-input bg-transparent px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Zielseite wählen…</option>
                      {pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.title}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="outline" size="sm">
                      Als ContentBlock übernehmen
                    </Button>
                  </form>
                )}
                {note.status !== "hidden" && note.status !== "deleted" && (
                  <form action={hidePlayerNoteAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Verbergen
                    </Button>
                  </form>
                )}
                {note.status !== "deleted" && (
                  <form action={deletePlayerNoteAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <Button type="submit" variant="destructive" size="sm">
                      Löschen
                    </Button>
                  </form>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </WorldShell>
  );
}
