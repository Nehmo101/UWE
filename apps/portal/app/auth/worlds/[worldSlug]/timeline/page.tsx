import { notFound } from "next/navigation";
import { getAccessContextForWorld } from "@/src/lib/auth";
import {
  buildPortalTimelineGroups,
  loadPortalTimelineData,
} from "@/src/lib/portal-timeline-data";
import { PortalStoryTimeline } from "@/src/components/PortalStoryTimeline";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalTimelinePage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const data = await loadPortalTimelineData(worldSlug, ctx);
  if (!data) {
    notFound();
  }

  const groups = buildPortalTimelineGroups(data.events, data.months, data.epochLabel);

  return (
    <section className="portal-content-card">
      <h1>Timeline</h1>
      <p className="auth-lead">
        Die Geschichte eurer Kampagne — chronologisch, spoilerarm und nur mit freigegebenen
        Zusammenfassungen.
      </p>

      {groups.length === 0 ? (
        <PortalEmptyState title="Noch keine Timeline-Ereignisse" icon="clock" />
      ) : (
        <PortalStoryTimeline
          worldSlug={worldSlug}
          groups={groups}
          currentDateLabel={data.currentDateLabel}
          eventsThroughCurrentDate={data.eventsThroughCurrentDate}
          totalEvents={data.events.length}
        />
      )}
    </section>
  );
}
