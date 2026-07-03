import Link from "next/link";
import { SidebarSection, StatGrid } from "@uwe/shared-ui";
import { getAppRepository, prisma } from "@uwe/database/server";
import { createCampaignRadarService } from "@uwe/database/campaign-radar";
import { notFound } from "next/navigation";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

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
          <ul className="uwe-sidebar-links">
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

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Letzte Session</h2>
        {radar.lastSession ? (
          <p>
            <Link href={radar.lastSession.href}>
              Session {radar.lastSession.sessionNumber}: {radar.lastSession.title}
            </Link>
            {radar.lastSession.date ? (
              <span className="uwe-dashboard-muted"> · {DATE_FORMAT.format(radar.lastSession.date)}</span>
            ) : null}
          </p>
        ) : (
          <p className="uwe-dashboard-muted">Noch keine gespielte Session.</p>
        )}
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Fraktionen</h2>
        {radar.factions.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine Fraktionen mit Zustand hinterlegt.</p>
        ) : (
          <ul className="uwe-linked-list">
            {radar.factions.map((faction) => (
              <li key={faction.href}>
                <Link href={faction.href}>{faction.title}</Link>
                {faction.powerLevel != null ? (
                  <span className="uwe-badge"> Macht {faction.powerLevel}</span>
                ) : null}
                {faction.agenda ? (
                  <span className="uwe-dashboard-muted"> — {faction.agenda}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Offene Quests</h2>
        {radar.openQuests.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine offenen Quests.</p>
        ) : (
          <ul className="uwe-linked-list">
            {radar.openQuests.map((quest) => (
              <li key={quest.href}>
                <Link href={quest.href}>{quest.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Jüngste Ereignisse</h2>
        {radar.recentEvents.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine Welt-Ereignisse erfasst.</p>
        ) : (
          <ul className="uwe-linked-list">
            {radar.recentEvents.map((event) => (
              <li key={event.id}>
                <strong>{event.title}</strong>
                {event.summary ? (
                  <span className="uwe-dashboard-muted"> — {event.summary}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {radar.canonConflicts > 0 ? (
        <p className="uwe-form-error">
          {radar.canonConflicts} widersprüchliche Seite(n) —{" "}
          <Link href={`/worlds/${worldSlug}/inspector`}>im Inspektor prüfen</Link>.
        </p>
      ) : null}
    </WorldShell>
  );
}
