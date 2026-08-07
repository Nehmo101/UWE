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
  assignDungeonToArcAction,
  assignQuestToArcAction,
  createStoryArcAction,
  pinPageToStoryArcAction,
  preparePrintListFromChapterAction,
  unpinPageFromStoryArcAction,
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
  Input,
  Label,
  Textarea,
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

  // Kandidaten fürs Pinnen: NSC-, Orts-, Fraktions- und Handout-Seiten der
  // Welt, die noch nicht an diesem Kapitel hängen.
  const pinnedIds = new Set(view.pins.map((pin) => pin.target.id));
  const pinnableTypes = new Set([
    "npc",
    "player_character",
    "monster",
    "location",
    "region",
    "faction",
    "handout",
  ]);
  const pinCandidates = wikiIndex
    .filter((node) => pinnableTypes.has(node.type) && !pinnedIds.has(node.id))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));

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
          <span className="inline-flex flex-wrap gap-2">
            {chapter.parentChapterId === null ? (
              <>
                <Link
                  href={`${base}/prepare-session?campaign=${campaignSlug}&chapter=${chapter.slug}`}
                  className={buttonVariants()}
                >
                  Akt vorbereiten
                </Link>
                <Link
                  href={`${base}/sessions/new?campaign=${campaignSlug}&chapter=${chapter.slug}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Session anlegen
                </Link>
              </>
            ) : null}
            <Link
              href={`/api/worlds/${worldSlug}/kampagnen/kapitel-druck?kapitelId=${chapter.id}&variante=dm`}
              target="_blank"
              className={buttonVariants({ variant: "outline" })}
            >
              Druck (DM)
            </Link>
            <Link
              href={`/api/worlds/${worldSlug}/kampagnen/kapitel-druck?kapitelId=${chapter.id}&variante=spieler`}
              target="_blank"
              className={buttonVariants({ variant: "outline" })}
            >
              Druck (Spieler)
            </Link>
            <Link
              href={`/api/worlds/${worldSlug}/kampagnen/kapitel-druck?kapitelId=${chapter.id}&format=markdown&variante=dm`}
              target="_blank"
              className={buttonVariants({ variant: "ghost" })}
            >
              Markdown
            </Link>
          </span>
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

        {chapter.parentChapterId === null ? (
          <Card>
            <CardHeader>
              <CardTitle>Ablauf dieses Akts</CardTitle>
            </CardHeader>
            <CardContent>
              {view.subchapters.length > 0 ? (
                <ol className="ml-5 flex list-decimal flex-col gap-3 text-sm">
                  {view.subchapters.map((subchapter) => (
                  <li key={subchapter.id}>
                    <Link href={subchapter.href} className="font-medium">
                      {subchapter.title}
                    </Link>
                    {subchapter.summary ? (
                      <p className="mb-0 mt-1 text-muted-foreground">{subchapter.summary}</p>
                    ) : (
                      <p className="mb-0 mt-1 text-muted-foreground">
                        Noch kein DM-Leitsatz für diesen Abschnitt.
                      </p>
                    )}
                  </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Noch keine Unterkapitel. Der Akt kann trotzdem direkt für eine Session genutzt werden.
                </p>
              )}
              <details className="mt-4 rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Unterkapitel ergänzen</summary>
                <form action={createStoryArcAction} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="campaignSlug" value={campaignSlug} />
                  <input type="hidden" name="parentChapterId" value={chapter.id} />
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="subchapter-title">Titel</Label>
                    <Input id="subchapter-title" name="title" required maxLength={160} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="subchapter-summary">Was muss der DM hier erreichen?</Label>
                    <Input id="subchapter-summary" name="summary" maxLength={500} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="subchapter-content">Leitfaden (Wikitext)</Label>
                    <Textarea id="subchapter-content" name="content" rows={4} />
                  </div>
                  <Button type="submit" className="self-start">Unterkapitel anlegen</Button>
                </form>
              </details>
            </CardContent>
          </Card>
        ) : null}

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

        <Card id="kapitel-akt-tafel">
          <CardHeader>
            <CardTitle>Im Akt wichtig</CardTitle>
          </CardHeader>
          <CardContent>
            {view.actRelations.npcs.length === 0 &&
            view.actRelations.locations.length === 0 &&
            view.actRelations.factions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine [[Wiki-Links]] im Kapitel- oder Quest-Text — NSCs, Orte und Fraktionen
                erscheinen hier automatisch, sobald sie verlinkt sind.
              </p>
            ) : (
              <dl className="flex flex-col gap-2 text-sm">
                {(
                  [
                    ["NSCs", view.actRelations.npcs],
                    ["Orte", view.actRelations.locations],
                    ["Fraktionen", view.actRelations.factions],
                  ] as const
                ).map(([label, targets]) =>
                  targets.length > 0 ? (
                    <div key={label} className="flex flex-wrap gap-2">
                      <dt className="font-medium text-muted-foreground">{label}:</dt>
                      <dd className="flex flex-wrap gap-2">
                        {targets.map((target, index) => (
                          <span key={target.id}>
                            {index > 0 ? "· " : null}
                            <Link href={target.href}>{target.title}</Link>
                          </span>
                        ))}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Abgeleitet aus dem Kapiteltext und allen Quest-Texten dieses Akts — plus
              gepinnte Seiten. Am Spieltisch erscheint diese Tafel im Live-Modus der
              Session.
            </p>

            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
              {view.pins.length > 0 ? (
                <ul className="flex flex-wrap gap-2 text-sm">
                  {view.pins.map((pin) => (
                    <li
                      key={pin.id}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1"
                    >
                      <span aria-hidden>📌</span>
                      <Link href={pin.target.href}>{pin.target.title}</Link>
                      <form action={unpinPageFromStoryArcAction} className="inline">
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="campaignSlug" value={campaignSlug} />
                        <input type="hidden" name="kapitelSlug" value={kapitelSlug} />
                        <input type="hidden" name="linkId" value={pin.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          aria-label={`${pin.target.title} lösen`}
                        >
                          ×
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : null}
              {pinCandidates.length > 0 ? (
                <form
                  action={pinPageToStoryArcAction}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="campaignSlug" value={campaignSlug} />
                  <input type="hidden" name="kapitelSlug" value={kapitelSlug} />
                  <input type="hidden" name="chapterId" value={chapter.id} />
                  {/* TODO(design-kit): natives Select — Leerwert nötig. */}
                  <select name="pageId" required className={NATIVE_SELECT_CLASS}>
                    <option value="">Seite an den Akt pinnen…</option>
                    {pinCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title} ({candidate.type})
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="ghost" size="sm">
                    Pinnen
                  </Button>
                </form>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card id="kapitel-dungeons">
          <CardHeader>
            <CardTitle>Dungeons in diesem Kapitel</CardTitle>
          </CardHeader>
          <CardContent>
            {view.dungeons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Kein Dungeon zugeordnet — der Spielabend zeigt Dungeons dieses Kapitels
                direkt auf der Akt-Tafel.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {view.dungeons.map((dungeon) => (
                  <li key={dungeon.id} className="flex flex-wrap items-center gap-2">
                    <Link href={dungeon.href}>{dungeon.title}</Link>
                    <DungeonPrepStatusBadge status={dungeon.prepStatus} />
                    {dungeon.summary ? (
                      <span className="text-muted-foreground"> — {dungeon.summary}</span>
                    ) : null}
                    <form action={assignDungeonToArcAction} className="inline-flex">
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="campaignSlug" value={campaignSlug} />
                      <input type="hidden" name="kapitelSlug" value={kapitelSlug} />
                      <input type="hidden" name="dungeonId" value={dungeon.id} />
                      <input type="hidden" name="chapterId" value="" />
                      <Button type="submit" variant="ghost" size="sm">
                        Lösen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {view.assignableDungeons.length > 0 ? (
              <form
                action={assignDungeonToArcAction}
                className="mt-3 flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="campaignSlug" value={campaignSlug} />
                <input type="hidden" name="kapitelSlug" value={kapitelSlug} />
                <input type="hidden" name="chapterId" value={chapter.id} />
                {/* TODO(design-kit): natives Select — Leerwert nötig. */}
                <select name="dungeonId" required className={NATIVE_SELECT_CLASS}>
                  <option value="">Dungeon diesem Kapitel zuordnen…</option>
                  {view.assignableDungeons.map((dungeon) => (
                    <option key={dungeon.id} value={dungeon.id}>
                      {dungeon.title}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="ghost" size="sm">
                  Zuordnen
                </Button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                <Link href={`${base}/dungeons/new?campaign=${campaignSlug}`}>
                  Neuen Dungeon anlegen →
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle>Papier für den Spieltisch</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Die Druckversion oben rendert Kapiteltext und Quests als A4-Dokument (DM mit
              gestrichelten DM-Kästen, Spieler-Variante ohne DM-Bereiche). Zusätzlich lässt sich
              das Kapitel als Druckliste ins Print-Center legen — für 6×4-Handouts und Karten.
            </p>
            <form
              action={preparePrintListFromChapterAction}
              className="flex flex-wrap items-center gap-3"
            >
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="campaignSlug" value={campaignSlug} />
              <input type="hidden" name="chapterId" value={chapter.id} />
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="forNextSession" /> für die nächste Session
              </label>
              <Button type="submit" variant="outline" size="sm">
                Druckliste vorbereiten
              </Button>
            </form>
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
