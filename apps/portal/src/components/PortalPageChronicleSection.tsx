import Link from "next/link";
import type { AccessContext } from "@uwe/auth";
import {
  buildPortalTimelineGroups,
  loadPortalTimelineData,
} from "@/src/lib/portal-timeline-data";
import { PortalStoryTimeline } from "@/src/components/PortalStoryTimeline";

interface Props {
  worldSlug: string;
  pageId: string;
  ctx: AccessContext;
}

export async function PortalPageChronicleSection({ worldSlug, pageId, ctx }: Props) {
  const data = await loadPortalTimelineData(worldSlug, ctx, { pageId });
  if (!data || data.events.length === 0) {
    return null;
  }

  const groups = buildPortalTimelineGroups(data.events, data.months, data.epochLabel);

  return (
    <section className="auth-block portal-story-section" style={{ marginTop: "1.5rem" }}>
      <h2 className="auth-section-title">Chronik</h2>
      <p className="auth-muted">Bekannte Ereignisse zu dieser Seite — spoilerarme Zusammenfassungen.</p>
      <PortalStoryTimeline worldSlug={worldSlug} groups={groups} compact />
      <p className="portal-story-more">
        <Link href={`/auth/worlds/${worldSlug}/timeline`}>Gesamte Timeline</Link>
      </p>
    </section>
  );
}
