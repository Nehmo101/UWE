import Link from "next/link";
import {
  buildPageUrl,
  type PageType,
  type PortalTimelineYearGroup,
} from "@uwe/database/server";

interface Props {
  worldSlug: string;
  groups: PortalTimelineYearGroup[];
  currentDateLabel?: string | null;
  eventsThroughCurrentDate?: number;
  totalEvents?: number;
  compact?: boolean;
}

export function PortalStoryTimeline({
  worldSlug,
  groups,
  currentDateLabel,
  eventsThroughCurrentDate,
  totalEvents,
  compact = false,
}: Props) {
  if (groups.length === 0) {
    return null;
  }

  const showProgress =
    typeof eventsThroughCurrentDate === "number" &&
    typeof totalEvents === "number" &&
    totalEvents > 0 &&
    currentDateLabel;

  return (
    <div className={`portal-story-timeline${compact ? " portal-story-timeline-compact" : ""}`}>
      {currentDateLabel ? (
        <aside className="portal-story-now" aria-label="Aktuelles In-Game-Datum">
          <span className="portal-story-now-label">Jetzt in der Kampagne</span>
          <strong>{currentDateLabel}</strong>
          {showProgress ? (
            <span className="portal-story-now-progress">
              {eventsThroughCurrentDate} von {totalEvents} Ereignissen liegen davor
            </span>
          ) : null}
        </aside>
      ) : null}

      {groups.map((group) => (
        <section key={group.year} className="portal-story-year-group" aria-label={group.label}>
          <h2 className="portal-story-year">{group.label}</h2>
          <ol className="portal-story-events">
            {group.events.map((event) => (
              <li key={event.id} className="portal-story-event">
                <div className="portal-story-event-meta">
                  <time dateTime={`${event.inGameDate.year}-${event.inGameDate.month}-${event.inGameDate.day}`}>
                    {event.dateLabel}
                  </time>
                </div>
                <h3 className="portal-story-event-title">{event.title}</h3>
                {event.summaryPlayer ? (
                  <p className="portal-story-event-summary">{event.summaryPlayer}</p>
                ) : null}
                {event.linkedPages.length > 0 ? (
                  <ul className="portal-story-links">
                    {event.linkedPages.map((page) => (
                      <li key={page.id}>
                        <Link href={buildPageUrl(worldSlug, page.type as PageType, page.slug)}>
                          {page.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
