import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildWorldWikiIndex,
  DUNGEON_PREP_STATUS_LABELS,
  getAppRepository,
  prisma,
  type DungeonPrepStatus,
} from "@uwe/database/server";
import { getWorldWikiGraph } from "@uwe/database/page-service";
import { createCampaignCockpitService } from "@uwe/campaign-cockpit";
import { DungeonPrepStatusBadge, QuestStatusBadge, SidebarSection, WikiContent } from "@uwe/shared-ui";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { campaignCockpitBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { requireStudioWorldRead } from "@/src/lib/authz";
import {
  assignQuestToArcAction,
  updateQuestStatusInPlaceAction,
  updateStoryArcAction,
} from "../../../../../../kampagnen-actions";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  buttonVariants,
} from "@/src/components/ui";

/**
 * Kapitel-Cockpit (Analogie zur Dungeon-Ebene): Kapiteltext, Quests mit
 * Statuswechsel und abgeleiteten Beziehungen aus den [[Wiki-Links]],
 * verknüpfte Chronik-Ereignisse, Quest-Zuordnung.
 */

interface Props {
  params: Promise<{ worldSlug: string; campaignSlug: string; kapitelSlug: string }>;
  searchParams: Promise<{ saved?: string; created?: string }>;
}

/** TODO(design-kit): natives Select wie im Dungeon-Cockpit — Kit-Select ist Client-only. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function ChapterCockpitPage({ params, searchParams }: Props) {
  const { worldSlug, campaignSlug, kapitelSlug } = await params;
  const { saved, created } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();
  await requireStudioWorldRead(worldSlug);

  const [wikiIndex, graph] = await Promise.all([
    buildWorldWikiIndex(repo, worldSlug),
    getWorldWikiGraph(repo, worldSlug),
  ]);

  const view = await createCampaignCockpitService(prisma).getChapterView(
    worldSlug,
    campaignSlug,
    kapitelSlug,
    { wikiIndex, graph },
  );
  if (!view) notFound();

  const base = `/worlds/${worldSlug}`;
  const cockpitPath = `${base}/kampagnen/${campaignSlug}`;
  const kapitelPath = `${cockpitPath}/kapitel/${kapitelSlug}`;
  const { campaign, chapter, quests } = view;

  return (
    <>
      <ShellBreadcrumb
        items={campaignCockpitBreadcrumb(world.name, worldSlug, [
          { label: campaign.name, href: cockpitPath },
          { label: chapter.title, href: kapitelPath },
        ])}
      />
      <ShellContextPanel>
        <SidebarSection title="Kampagne">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href={cockpitPath}>← {campaign.name}</Link>
            </li>
            <li>
              <Link href={`${cockpitPath}/abschluss`}>Session abschließen →</Link>
            </li>
          </ul>
        </SidebarSection>
        <SidebarSection title="Quests in diesem Kapitel">
          {quests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {quests.map((quest) => (
                <li key={quest.id}>
                  <Link href={`#quest-${quest.slug}`}>{quest.title}</Link>
                </li>
              ))}
            </ul>
          )}
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title={chapter.title}
        summary={chapter.summary ?? `Kapitel der Kampagne „${campaign.name}".`}
        actions={
          <Link
            href={`/api/worlds/${worldSlug}/kampagnen/kapitel-druck?kapitelId=${chapter.id}&variante=dm`}
            target="_blank"
            className={buttonVariants({ variant: "outline" })}
          >
            Druckversion
          </Link>
        }
      />

      {saved === "1" ? (
        <Alert tone="success" className="mb-4">
          Gespeichert.
        </Alert>
      ) : null}
      {created === "1" ? (
        <Alert tone="success" className="mb-4">
          Kapitel angelegt.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>Status</CardTitle>
              <DungeonPrepStatusBadge status={chapter.prepStatus} />
            </div>
          </CardHeader>
          <CardContent>
            <form action={updateStoryArcAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="campaignSlug" value={campaignSlug} />
              <input type="hidden" name="kapitelSlug" value={kapitelSlug} />
              <input type="hidden" name="chapterId" value={chapter.id} />
              <label htmlFor="chapter-prep-status" className="text-sm">
                Kapitel-Status
              </label>
              <select
                id="chapter-prep-status"
                name="prepStatus"
                defaultValue={chapter.prepStatus ?? "unprepared"}
                className={NATIVE_SELECT_CLASS}
              >
                {(Object.keys(DUNGEON_PREP_STATUS_LABELS) as DungeonPrepStatus[]).map(
                  (status) => (
                    <option key={status} value={status}>
                      {DUNGEON_PREP_STATUS_LABELS[status]}
                    </option>
                  ),
                )}
              </select>
              <Button type="submit" size="sm">
                Speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        {view.html ? (
          <Card>
            <CardHeader>
              <CardTitle>Kapiteltext</CardTitle>
            </CardHeader>
            <CardContent>
              <WikiContent html={view.html} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Quests</CardTitle>
          </CardHeader>
          <CardContent>
            {quests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Diesem Kapitel ist noch keine Quest zugeordnet.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {quests.map((quest) => (
                  <li
                    key={quest.id}
                    id={`quest-${quest.slug}`}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={quest.href} className="font-medium">
                        {quest.title}
                      </Link>
                      <QuestStatusBadge status={quest.status} />
                      {quest.status === "open" ? (
                        <span className="inline-flex gap-1">
                          <form action={updateQuestStatusInPlaceAction} className="inline-flex">
                            <input type="hidden" name="worldSlug" value={worldSlug} />
                            <input type="hidden" name="pageId" value={quest.id} />
                            <input type="hidden" name="returnTo" value="kapitel" />
                            <input type="hidden" name="campaignSlug" value={campaignSlug} />
                            <input type="hidden" name="kapitelSlug" value={kapitelSlug} />
                            <input type="hidden" name="questStatus" value="completed" />
                            <Button type="submit" variant="ghost" size="sm">
                              Abschließen
                            </Button>
                          </form>
                          <form action={updateQuestStatusInPlaceAction} className="inline-flex">
                            <input type="hidden" name="worldSlug" value={worldSlug} />
                            <input type="hidden" name="pageId" value={quest.id} />
                            <input type="hidden" name="returnTo" value="kapitel" />
                            <input type="hidden" name="campaignSlug" value={campaignSlug} />
                            <input type="hidden" name="kapitelSlug" value={kapitelSlug} />
                            <input type="hidden" name="questStatus" value="failed" />
                            <Button type="submit" variant="ghost" size="sm">
                              Gescheitert
                            </Button>
                          </form>
                        </span>
                      ) : (
                        <form action={updateQuestStatusInPlaceAction} className="inline-flex">
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="pageId" value={quest.id} />
                          <input type="hidden" name="returnTo" value="kapitel" />
                          <input type="hidden" name="campaignSlug" value={campaignSlug} />
                          <input type="hidden" name="kapitelSlug" value={kapitelSlug} />
                          <input type="hidden" name="questStatus" value="open" />
                          <Button type="submit" variant="ghost" size="sm">
                            Wieder öffnen
                          </Button>
                        </form>
                      )}
                    </div>
                    {quest.relations.npcs.length > 0 ||
                    quest.relations.locations.length > 0 ||
                    quest.relations.factions.length > 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {quest.relations.npcs.length > 0 ? (
                          <>
                            NSCs:{" "}
                            {quest.relations.npcs.map((target, index) => (
                              <span key={target.id}>
                                {index > 0 ? ", " : ""}
                                <Link href={target.href}>{target.title}</Link>
                              </span>
                            ))}
                            {" · "}
                          </>
                        ) : null}
                        {quest.relations.locations.length > 0 ? (
                          <>
                            Orte:{" "}
                            {quest.relations.locations.map((target, index) => (
                              <span key={target.id}>
                                {index > 0 ? ", " : ""}
                                <Link href={target.href}>{target.title}</Link>
                              </span>
                            ))}
                            {" · "}
                          </>
                        ) : null}
                        {quest.relations.factions.length > 0 ? (
                          <>
                            Fraktionen:{" "}
                            {quest.relations.factions.map((target, index) => (
                              <span key={target.id}>
                                {index > 0 ? ", " : ""}
                                <Link href={target.href}>{target.title}</Link>
                              </span>
                            ))}
                          </>
                        ) : null}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Keine [[Wiki-Links]] im Quest-Text — Beziehungen erscheinen hier
                        automatisch, sobald der Text NSCs, Orte oder Fraktionen verlinkt.
                      </p>
                    )}
                    {quest.linkedEvents.length > 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Chronik:{" "}
                        {quest.linkedEvents.map((event, index) => (
                          <span key={`${event.eventId}-${event.role}`}>
                            {index > 0 ? ", " : ""}
                            {event.title} ({event.roleLabel})
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <details className="mt-4 rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Quest diesem Kapitel zuordnen
              </summary>
              {view.assignableQuests.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Keine weiteren Kampagnen-Quests.{" "}
                  <Link href={`${base}/pages/new?template=quest`}>Neue Quest anlegen →</Link>
                </p>
              ) : (
                <form
                  action={assignQuestToArcAction}
                  className="mt-3 flex flex-wrap items-center gap-3"
                >
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="campaignSlug" value={campaignSlug} />
                  <input type="hidden" name="kapitelSlug" value={kapitelSlug} />
                  <input type="hidden" name="chapterId" value={chapter.id} />
                  <label htmlFor="assign-quest" className="text-sm">
                    Quest
                  </label>
                  <select id="assign-quest" name="questId" className={NATIVE_SELECT_CLASS}>
                    {view.assignableQuests.map((quest) => (
                      <option key={quest.id} value={quest.id}>
                        {quest.title}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm">
                    Zuordnen
                  </Button>
                  <Link href={`${base}/pages/new?template=quest`} className="text-sm">
                    Neue Quest anlegen →
                  </Link>
                </form>
              )}
            </details>
          </CardContent>
        </Card>

        {view.backlinks.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Seiten, die auf dieses Kapitel verweisen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {view.backlinks.map((target) => (
                  <li key={target.id}>
                    <Link href={target.href}>{target.title}</Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
