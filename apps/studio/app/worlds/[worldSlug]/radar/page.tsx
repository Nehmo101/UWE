import Link from "next/link";
import { SidebarSection, StatGrid } from "@uwe/shared-ui";
import { getAppRepository, prisma } from "@uwe/database/server";
import { createCampaignRadarService } from "@uwe/database/campaign-radar";
import { notFound } from "next/navigation";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { updateQuestStatusAction } from "../quest-status-actions";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export default async function CampaignRadarPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const radar = await createCampaignRadarService(prisma).getRadar(worldSlug);
  if (!radar) notFound();

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Kampagnen-Radar",
            `/worlds/${worldSlug}/radar`,
          )}
        />
      }
      contextPanel={
        <SidebarSection title="Welt">
          <ul className="flex flex-col gap-2 text-sm">
            {radar.clockLabel ? (
              <li>
                <strong>{radar.clockLabel}</strong>
              </li>
            ) : (
              <li>
                <Link href={`/worlds/${worldSlug}/calendar`}>World Clock einrichten →</Link>
              </li>
            )}
            <li>
              <Link href={`/worlds/${worldSlug}/inspector`}>Inspektor →</Link>
            </li>
            <li>
              <Link href={`/worlds/${worldSlug}/quality`}>Wiki-Pflege →</Link>
            </li>
          </ul>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Kampagnen-Radar"
        summary="Was passiert gerade in der Welt? Fraktionen, offene Quests, Zeit, letzte Session und Kanon-Konflikte auf einen Blick."
      />

      <StatGrid
        stats={[
          { label: "Fraktionen", value: radar.factions.length },
          { label: "Offene Quests", value: radar.openQuests.length },
          { label: "NPCs", value: radar.npcSummary.total },
          { label: "Kanon-Konflikte", value: radar.canonConflicts },
        ]}
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Letzte Session</CardTitle>
          </CardHeader>
          <CardContent>
            {radar.lastSession ? (
              <p className="text-sm">
                <Link href={radar.lastSession.href}>
                  Session {radar.lastSession.sessionNumber}: {radar.lastSession.title}
                </Link>
                {radar.lastSession.date ? (
                  <span className="text-muted-foreground"> · {DATE_FORMAT.format(radar.lastSession.date)}</span>
                ) : null}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine gespielte Session.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fraktionen</CardTitle>
          </CardHeader>
          <CardContent>
            {radar.factions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Fraktionen mit Zustand hinterlegt.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {radar.factions.map((faction) => (
                  <li key={faction.href} className="flex flex-wrap items-center gap-2">
                    <Link href={faction.href}>{faction.title}</Link>
                    {faction.powerLevel != null ? (
                      <Badge variant="secondary">Macht {faction.powerLevel}</Badge>
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
            <CardTitle>Offene Quests</CardTitle>
          </CardHeader>
          <CardContent>
            {radar.openQuests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine offenen Quests.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {radar.openQuests.map((quest) => (
                  <li key={quest.href} className="flex flex-wrap items-center gap-3">
                    <Link href={quest.href}>{quest.title}</Link>
                    <form action={updateQuestStatusAction} className="inline-flex">
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="pageId" value={quest.id} />
                      <input type="hidden" name="pageSlug" value={quest.slug} />
                      <input type="hidden" name="category" value="quests" />
                      <input type="hidden" name="questStatus" value="completed" />
                      <Button type="submit" variant="ghost" size="sm">
                        Abschließen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jüngste Ereignisse</CardTitle>
          </CardHeader>
          <CardContent>
            {radar.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Welt-Ereignisse erfasst.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {radar.recentEvents.map((event) => (
                  <li key={event.id}>
                    <strong>{event.title}</strong>
                    {event.summary ? (
                      <span className="text-muted-foreground"> — {event.summary}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {radar.canonConflicts > 0 ? (
          <p role="alert" className="text-sm text-destructive">
            {radar.canonConflicts} widersprüchliche Seite(n) —{" "}
            <Link href={`/worlds/${worldSlug}/inspector`}>im Inspektor prüfen</Link>.
          </p>
        ) : null}
      </div>
    </WorldShell>
  );
}
