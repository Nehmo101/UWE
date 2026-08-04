import {
  createAuthService,
  createWorldCalendarService,
  countPortalTimelineEventsThroughDate,
  enrichPortalTimelineEvents,
  formatInGameDate,
  getAppRepository,
  groupPortalTimelineEventsByYear,
  parseInGameDate,
  parseWorldCalendarMonths,
  type PortalWorldEventView,
} from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import type { AccessContext } from "@uwe/auth";

export interface PortalTimelineData {
  events: PortalWorldEventView[];
  months: ReturnType<typeof parseWorldCalendarMonths>;
  currentDateLabel: string | null;
  epochLabel: string | null;
  eventsThroughCurrentDate: number;
}

export async function loadPortalTimelineData(
  worldSlug: string,
  ctx: AccessContext,
  options: { pageId?: string } = {},
): Promise<PortalTimelineData | null> {
  const db = getSharedPrismaClient();
  const auth = createAuthService(db);
  const repo = getAppRepository();

  try {
    // Welt-Lookup und Events hängen nicht voneinander ab — parallel laden.
    // Nur der Kalender braucht die world.id und bleibt dahinter.
    const [world, events] = await Promise.all([
      repo.getWorldBySlug(worldSlug),
      options.pageId
        ? auth.listWorldEventsForPageViewer(worldSlug, options.pageId, ctx)
        : auth.listWorldEventsForViewer(worldSlug, ctx),
    ]);
    if (!world) {
      return null;
    }

    const calendars = createWorldCalendarService(db);
    const calendar = await calendars.getByWorldId(world.id);
    const months = parseWorldCalendarMonths(calendar?.months);

    const currentDate = calendar ? parseInGameDate(calendar.currentDate) : null;
    const enriched = enrichPortalTimelineEvents(events, months);

    return {
      events,
      months,
      currentDateLabel: currentDate ? formatInGameDate(currentDate, months) : null,
      epochLabel: calendar?.epochLabel ?? null,
      eventsThroughCurrentDate: currentDate
        ? countPortalTimelineEventsThroughDate(enriched, currentDate)
        : enriched.length,
    };
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }
}

export function buildPortalTimelineGroups(
  events: PortalWorldEventView[],
  months: ReturnType<typeof parseWorldCalendarMonths>,
  epochLabel?: string | null,
) {
  const enriched = enrichPortalTimelineEvents(events, months);
  return groupPortalTimelineEventsByYear(enriched, { epochLabel });
}
