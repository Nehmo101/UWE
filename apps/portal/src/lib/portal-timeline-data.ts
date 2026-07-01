import {
  createAuthService,
  createPrismaClient,
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
  const db = createPrismaClient();
  const auth = createAuthService(db);
  const repo = getAppRepository();

  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      return null;
    }

    const calendars = createWorldCalendarService(db);
    const calendar = await calendars.getByWorldId(world.id);
    const months = parseWorldCalendarMonths(calendar?.months);
    const events = options.pageId
      ? await auth.listWorldEventsForPageViewer(worldSlug, options.pageId, ctx)
      : await auth.listWorldEventsForViewer(worldSlug, ctx);

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
    await db.$disconnect();
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
