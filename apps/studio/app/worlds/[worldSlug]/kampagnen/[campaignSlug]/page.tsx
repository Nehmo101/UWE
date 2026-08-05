import Link from "next/link";
import { notFound } from "next/navigation";
import { createCharacterService, getAppRepository, prisma } from "@uwe/database/server";
import { createCampaignCockpitService, findCurrentChapter } from "@uwe/campaign-cockpit";
import { DungeonPrepStatusBadge, QuestStatusBadge, SidebarSection, StatGrid } from "@uwe/shared-ui";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { AiContextPanel } from "@/components/AiContextPanel";
import { CampaignSidebar } from "@/src/components/wiki";
import { CampaignCharacterCard } from "@/src/components/campaign/CampaignCharacterCard";
import { campaignCockpitBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { requireStudioWorldRead } from "@/src/lib/authz";
import {
  createStoryArcAction,
  moveStoryArcAction,
  updateQuestStatusInPlaceAction,
} from "../../../../kampagnen-actions";
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
 * Das Kampagnen-Cockpit — exakte Analogie zum Dungeon-Cockpit:
 * Kampagne → Story-Bögen/Kapitel → Quests. Alles server-gerendert,
 * Interaktion über Links und Formulare, jede Sicht per URL teilbar.
 */

interface Props {
  params: Promise<{ worldSlug: string; campaignSlug: string }>;
  searchParams: Promise<{ saved?: string; created?: string; zugewiesen?: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export default async function CampaignCockpitPage({ params, searchParams }: Props) {
  const { worldSlug, campaignSlug } = await params;
  const { saved, created, zugewiesen } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();
  await requireStudioWorldRead(worldSlug);

  const overview = await createCampaignCockpitService(prisma).getCampaignOverview(
    worldSlug,
    campaignSlug,
  );
  if (!overview) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  // Charaktere entstehen im Portal; hier wird nur die Kampagne vergeben.
  const characters = await createCharacterService(prisma).listForWorld(world.id);
  const base = `/worlds/${worldSlug}`;
  const cockpitPath = `${base}/kampagnen/${campaignSlug}`;
  const { campaign, chapters, unassignedQuests, factions, progress } = overview;
  // Das erste noch nicht gespielte Kapitel in Lesereihenfolge — Druck-Einstieg.
  const currentChapter = findCurrentChapter(
    chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      sortIndex: chapter.sortIndex,
      prepStatus: chapter.prepStatus,
    })),
  );

  return (
    <>
      <ShellBreadcrumb
        items={campaignCockpitBreadcrumb(world.name, worldSlug, [
          { label: campaign.name, href: cockpitPath },
        ])}
      />
      <ShellContextPanel>
        <SidebarSection title="Kapitel">
          {chapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Kapitel.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {chapters.map((chapter, index) => (
                <li key={chapter.id}>
                  <Link href={chapter.href}>
                    {index + 1}. {chapter.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SidebarSection>
        <CampaignSidebar
          title="Andere Kampagne"
          items={campaigns
            .filter((candidate) => candidate.id !== campaign.id)
            .map((candidate) => ({
              label: candidate.name,
              href: `${base}/kampagnen/${candidate.slug}`,
            }))}
          manageHref={`${base}/kampagnen`}
        />
        <SidebarSection title="KI-Werkstatt">
          <AiContextPanel kind="campaign" worldSlug={worldSlug} campaignSlug={campaignSlug} />
        </SidebarSection>
        <SidebarSection title="Werkzeuge">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href={`${base}/radar?campaign=${campaignSlug}`}>Kampagnen-Radar →</Link>
            </li>
            <li>
              <Link href={`${base}/prepare-session`}>Session vorbereiten →</Link>
            </li>
            <li>
              <Link href={`${base}/lesen`}>Lesemodus →</Link>
            </li>
            <li>
              <Link href={`${base}/chronicle`}>Chronik →</Link>
            </li>
          </ul>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title={campaign.name}
        summary={
          campaign.description ??
          "Kampagnen-Cockpit: Story-Bögen, Quests, Fraktionen, Sessions und Chronik dieser Kampagne."
        }
        actions={
          <span className="inline-flex flex-wrap gap-2">
            {currentChapter ? (
              <Link
                href={`/api/worlds/${worldSlug}/kampagnen/kapitel-druck?kapitelId=${currentChapter.id}&variante=dm`}
                target="_blank"
                className={buttonVariants({ variant: "outline" })}
              >
                Aktuelles Kapitel drucken
              </Link>
            ) : null}
            <Link href={`${cockpitPath}/abschluss`} className={buttonVariants()}>
              Session abschließen
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
      {zugewiesen === "1" ? (
        <Alert tone="success" className="mb-4">
          Charakter-Zuordnung gespeichert.
        </Alert>
      ) : null}
      {overview.canonConflicts > 0 ? (
        <Alert tone="warning" className="mb-4" role="alert">
          {overview.canonConflicts} widersprüchliche Seite(n) in dieser Kampagne —{" "}
          <Link href={`${base}/inspector`}>im Inspektor prüfen</Link>.
        </Alert>
      ) : null}

      <StatGrid
        stats={[
          {
            label: "Kapitel",
            value: chapters.length,
            hint: progress.label || undefined,
            href: "#cockpit-kapitel",
          },
          {
            label: "Offene Quests",
            value:
              chapters.reduce((sum, chapter) => sum + chapter.questCounts.open, 0) +
              unassignedQuests.filter((quest) => quest.status === "open").length,
            href: "#cockpit-quests",
          },
          { label: "Fraktionen", value: factions.length, href: "#cockpit-fraktionen" },
          {
            label: "Spielernotizen",
            value: overview.noteQueueCount,
            hint: overview.noteQueueCount > 0 ? "warten auf Review" : undefined,
            href: `${cockpitPath}/abschluss`,
          },
          { label: "Kanon-Konflikte", value: overview.canonConflicts, href: `${base}/inspector` },
        ]}
      />

      <div className="flex flex-col gap-6">
        <Card id="cockpit-kapitel">
          <CardHeader>
            <CardTitle>Story-Bögen &amp; Kapitel</CardTitle>
          </CardHeader>
          <CardContent>
            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Kapitel. Lege unten das erste an — oder importiere ein Kampagnenbuch,
                dessen Kapitel hier ankommen.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {chapters.map((chapter, index) => (
                  <li
                    key={chapter.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
                  >
                    <span className="text-sm text-muted-foreground">{index + 1}.</span>
                    <Link href={chapter.href} className="font-medium">
                      {chapter.title}
                    </Link>
                    <DungeonPrepStatusBadge status={chapter.prepStatus} />
                    <span className="text-sm text-muted-foreground">
                      {chapter.questCounts.total > 0
                        ? `${chapter.questCounts.open} offen · ${chapter.questCounts.completed} erledigt${chapter.questCounts.failed > 0 ? ` · ${chapter.questCounts.failed} gescheitert` : ""}`
                        : "keine Quests"}
                    </span>
                    <span className="ml-auto inline-flex gap-1">
                      <form action={moveStoryArcAction}>
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="campaignSlug" value={campaignSlug} />
                        <input type="hidden" name="chapterId" value={chapter.id} />
                        <input type="hidden" name="direction" value="up" />
                        <Button type="submit" variant="ghost" size="sm" aria-label={`${chapter.title} nach oben`}>
                          ↑
                        </Button>
                      </form>
                      <form action={moveStoryArcAction}>
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="campaignSlug" value={campaignSlug} />
                        <input type="hidden" name="chapterId" value={chapter.id} />
                        <input type="hidden" name="direction" value="down" />
                        <Button type="submit" variant="ghost" size="sm" aria-label={`${chapter.title} nach unten`}>
                          ↓
                        </Button>
                      </form>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <details className="mt-4 rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Neues Kapitel</summary>
              <form action={createStoryArcAction} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="campaignSlug" value={campaignSlug} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-chapter-title">Titel</Label>
                  <Input
                    id="new-chapter-title"
                    name="title"
                    required
                    maxLength={160}
                    placeholder="z. B. Akt II — Der Sturm zieht auf"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-chapter-summary">Kurzbeschreibung (optional)</Label>
                  <Input id="new-chapter-summary" name="summary" maxLength={240} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-chapter-content">Kapiteltext (optional, Wikitext)</Label>
                  <Textarea id="new-chapter-content" name="content" rows={4} />
                </div>
                <Button type="submit" className="self-start">
                  Kapitel anlegen
                </Button>
              </form>
            </details>
          </CardContent>
        </Card>

        <Card id="cockpit-quests">
          <CardHeader>
            <CardTitle>Quests ohne Kapitel</CardTitle>
          </CardHeader>
          <CardContent>
            {unassignedQuests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Alle Kampagnen-Quests hängen an einem Kapitel.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {unassignedQuests.map((quest) => (
                  <li key={quest.id} className="flex flex-wrap items-center gap-3">
                    <Link href={quest.href}>{quest.title}</Link>
                    <QuestStatusBadge status={quest.status} />
                    {quest.status === "open" ? (
                      <form action={updateQuestStatusInPlaceAction} className="inline-flex">
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="pageId" value={quest.id} />
                        <input type="hidden" name="returnTo" value="cockpit" />
                        <input type="hidden" name="campaignSlug" value={campaignSlug} />
                        <input type="hidden" name="questStatus" value="completed" />
                        <Button type="submit" variant="ghost" size="sm">
                          Abschließen
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Zuordnen zu einem Kapitel geht auf der jeweiligen Kapitel-Seite.
            </p>
          </CardContent>
        </Card>

        <CampaignCharacterCard
          worldSlug={worldSlug}
          campaignId={campaign.id}
          campaignName={campaign.name}
          returnTo={cockpitPath}
          characters={characters.map((character) => ({
            id: character.id,
            displayName: character.displayName,
            ownerDisplayName: character.owner?.displayName ?? "—",
            level: character.level,
            campaignId: character.campaignId,
          }))}
        />

        <Card id="cockpit-fraktionen">
          <CardHeader>
            <CardTitle>Fraktionen</CardTitle>
          </CardHeader>
          <CardContent>
            {factions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Fraktionen mit Zustand in dieser Kampagne.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {factions.map((faction) => (
                  <li key={faction.pageId} className="flex flex-wrap items-center gap-2">
                    <Link href={faction.href}>{faction.title}</Link>
                    {faction.powerLevel != null ? (
                      <span className="text-muted-foreground">Macht {faction.powerLevel}</span>
                    ) : null}
                    {faction.agenda ? (
                      <span className="text-muted-foreground"> — {faction.agenda}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {overview.lastSession ? (
              <p>
                Zuletzt gespielt:{" "}
                <Link href={overview.lastSession.href}>
                  Session {overview.lastSession.sessionNumber}: {overview.lastSession.title}
                </Link>
                {overview.lastSession.date ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {DATE_FORMAT.format(overview.lastSession.date)}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-muted-foreground">Noch keine gespielte Session.</p>
            )}
            {overview.nextSession ? (
              <p>
                Als Nächstes:{" "}
                <Link href={overview.nextSession.href}>
                  Session {overview.nextSession.sessionNumber}: {overview.nextSession.title}
                </Link>
              </p>
            ) : null}
            <p>
              <Link href={`${base}/sessions`}>Alle Sessions →</Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chronik dieser Kampagne</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Ereignisse mit Bezug zu dieser Kampagne. Der Session-Abschluss legt sie
                an.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {overview.recentEvents.map((event) => (
                  <li key={event.id}>
                    <span className="text-muted-foreground">{event.dateLabel}</span>{" "}
                    <strong>{event.title}</strong>
                    {event.summary ? (
                      <span className="text-muted-foreground"> — {event.summary}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm">
              <Link href={`${base}/chronicle`}>Zur Welt-Chronik →</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
