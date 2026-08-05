import Link from "next/link";
import { DungeonPrepStatusBadge, SidebarSection, StatGrid } from "@uwe/shared-ui";
import { getAppRepository, prisma } from "@uwe/database/server";
import { createCampaignRadarService } from "@uwe/database/campaign-radar";
import { notFound } from "next/navigation";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { updateQuestStatusInPlaceAction } from "../../../kampagnen-actions";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; saved?: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

/** Übersichtsseite: Listen bleiben kompakt, die Vollansicht wohnt im Cockpit. */
const LIST_LIMIT = 8;

export default async function CampaignRadarPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, saved } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  // Dasselbe Muster wie im Dungeon-Cockpit: die Kampagne ist ein Filter in der
  // Kontextspalte, kein eigener Rahmen. Ein unbekannter Slug fällt auf „alle" zurück.
  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((campaign) => campaign.slug === campaignSlug)
    : null;

  const radar = await createCampaignRadarService(prisma).getRadar(
    worldSlug,
    selectedCampaign?.id ? { campaignId: selectedCampaign.id } : undefined,
  );
  if (!radar) notFound();

  const base = `/worlds/${worldSlug}`;
  const factions = radar.factions.slice(0, LIST_LIMIT);
  const openQuests = radar.openQuests.slice(0, LIST_LIMIT);
  const dungeons = radar.dungeons.slice(0, LIST_LIMIT);

  return (
    <>
      <ShellBreadcrumb
        items={worldSectionBreadcrumb(world.name, worldSlug, "Kampagnen-Radar", `${base}/radar`)}
      />
      <ShellContextPanel>
        <CampaignSidebar
          items={campaignNavItems(`${base}/radar`, campaigns, campaignSlug)}
          manageHref={`${base}/kampagnen`}
        />
        <SidebarSection title="Welt">
          <ul className="flex flex-col gap-2 text-sm">
            {radar.clockLabel ? (
              <li>
                <strong>{radar.clockLabel}</strong>
              </li>
            ) : (
              <li>
                <Link href={`${base}/calendar`}>World Clock einrichten →</Link>
              </li>
            )}
            <li>
              <Link href={`${base}/kampagnen`}>Kampagnen-Cockpit →</Link>
            </li>
            <li>
              <Link href={`${base}/dungeons`}>Dungeon Cockpit →</Link>
            </li>
            <li>
              <Link href={`${base}/inspector`}>Inspektor →</Link>
            </li>
            <li>
              <Link href={`${base}/quality`}>Wiki-Pflege →</Link>
            </li>
          </ul>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title="Kampagnen-Radar"
        summary={
          selectedCampaign
            ? `Was passiert gerade in „${selectedCampaign.name}“? Fraktionen, offene Quests, Dungeons, letzte Session und Kanon-Konflikte auf einen Blick.`
            : "Was passiert gerade in der Welt? Fraktionen, offene Quests, Dungeons, letzte Session und Kanon-Konflikte auf einen Blick."
        }
      />

      {saved ? (
        <Alert tone="success" className="mb-4">
          Quest-Status gespeichert.
        </Alert>
      ) : null}

      {radar.canonConflicts > 0 ? (
        <Alert tone="warning" className="mb-4" role="alert">
          {radar.canonConflicts} widersprüchliche Seite(n) —{" "}
          <Link href={`${base}/inspector`}>im Inspektor prüfen</Link>.
        </Alert>
      ) : null}

      <StatGrid
        stats={[
          { label: "Fraktionen", value: radar.factions.length, href: "#radar-fraktionen" },
          { label: "Offene Quests", value: radar.openQuests.length, href: "#radar-quests" },
          { label: "Dungeons", value: radar.dungeons.length, href: "#radar-dungeons" },
          {
            label: "NPCs",
            value: radar.npcSummary.total,
            href: `${base}/npcs`,
            hint:
              radar.npcSummary.flagged > 0
                ? `${radar.npcSummary.flagged} mit Kanon-Klärung`
                : undefined,
          },
          { label: "Kanon-Konflikte", value: radar.canonConflicts, href: `${base}/inspector` },
        ]}
      />

      <div className="flex flex-col gap-6">
        {selectedCampaign ? (
          <Card>
            <CardHeader>
              <CardTitle>Kampagne</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                <Link href={`${base}/kampagnen/${selectedCampaign.slug}`}>
                  „{selectedCampaign.name}“ im Kampagnen-Cockpit öffnen →
                </Link>
              </p>
            </CardContent>
          </Card>
        ) : campaigns.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Kampagnen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {campaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <Link href={`${base}/kampagnen/${campaign.slug}`}>
                      {campaign.name} — Cockpit öffnen →
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

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

        <Card id="radar-fraktionen">
          <CardHeader>
            <CardTitle>Fraktionen</CardTitle>
          </CardHeader>
          <CardContent>
            {factions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Fraktionen mit Zustand hinterlegt.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {factions.map((faction) => (
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
            {radar.factions.length > LIST_LIMIT ? (
              <p className="mt-2 text-sm">
                <Link href={`${base}/fraktionen`}>
                  Alle {radar.factions.length} Fraktionen anzeigen →
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card id="radar-quests">
          <CardHeader>
            <CardTitle>Offene Quests</CardTitle>
          </CardHeader>
          <CardContent>
            {openQuests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine offenen Quests.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {openQuests.map((quest) => (
                  <li key={quest.href} className="flex flex-wrap items-center gap-3">
                    <Link href={quest.href}>{quest.title}</Link>
                    <form action={updateQuestStatusInPlaceAction} className="inline-flex">
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="pageId" value={quest.id} />
                      <input type="hidden" name="returnTo" value="radar" />
                      <input type="hidden" name="questStatus" value="completed" />
                      <Button type="submit" variant="ghost" size="sm">
                        Abschließen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {radar.openQuests.length > LIST_LIMIT ? (
              <p className="mt-2 text-sm text-muted-foreground">
                … und {radar.openQuests.length - LIST_LIMIT} weitere — Vollansicht im{" "}
                <Link href={`${base}/kampagnen`}>Kampagnen-Cockpit</Link>.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card id="radar-dungeons">
          <CardHeader>
            <CardTitle>Dungeons</CardTitle>
          </CardHeader>
          <CardContent>
            {dungeons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {selectedCampaign
                  ? "Keine Dungeons in dieser Kampagne."
                  : "Keine Dungeons in dieser Welt."}{" "}
                <Link href={`${base}/dungeons/new`}>Neuen Dungeon anlegen →</Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {dungeons.map((dungeon) => (
                  <li key={dungeon.id} className="flex flex-wrap items-center gap-2">
                    <Link href={dungeon.href}>{dungeon.title}</Link>
                    <DungeonPrepStatusBadge status={dungeon.prepStatus} />
                    {dungeon.summary ? (
                      <span className="text-muted-foreground"> — {dungeon.summary}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {radar.dungeons.length > LIST_LIMIT ? (
              <p className="mt-2 text-sm">
                <Link href={`${base}/dungeons`}>Alle {radar.dungeons.length} Dungeons anzeigen →</Link>
              </p>
            ) : null}
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
              <Link href={`${base}/chronicle`}>Zur Chronik →</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
