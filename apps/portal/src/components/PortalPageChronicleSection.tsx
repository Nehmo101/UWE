import Link from "next/link";
import {
  buildPageUrl,
  createAuthService,
  createPrismaClient,
  createWorldCalendarService,
  formatInGameDate,
  getAppRepository,
  parseWorldCalendarMonths,
  type PageType,
} from "@uwe/database/server";
import type { AccessContext } from "@uwe/auth";

interface Props {
  worldSlug: string;
  pageId: string;
  ctx: AccessContext;
}

export async function PortalPageChronicleSection({ worldSlug, pageId, ctx }: Props) {
  const db = createPrismaClient();
  const auth = createAuthService(db);
  const repo = getAppRepository();

  let events;
  let months = parseWorldCalendarMonths(undefined);

  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      return null;
    }

    const calendars = createWorldCalendarService(db);
    const calendar = await calendars.getByWorldId(world.id);
    months = parseWorldCalendarMonths(calendar?.months);
    events = await auth.listWorldEventsForPageViewer(worldSlug, pageId, ctx);
  } finally {
    await db.$disconnect();
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <section className="auth-block" style={{ marginTop: "1.5rem" }}>
      <h2 className="auth-section-title">Chronik</h2>
      <p className="auth-muted">Bekannte Ereignisse zu dieser Seite — spoilerarme Zusammenfassungen.</p>
      <ol className="auth-page-list">
        {events.map((event) => (
          <li key={event.id}>
            <strong>{formatInGameDate(event.inGameDate, months)}</strong>
            <span>{event.title}</span>
            {event.summaryPlayer && <p className="auth-muted">{event.summaryPlayer}</p>}
            {event.linkedPages.length > 1 && (
              <p className="auth-muted">
                {event.linkedPages.map((page, index) => (
                  <span key={page.id}>
                    {index > 0 ? ", " : null}
                    <Link href={buildPageUrl(worldSlug, page.type as PageType, page.slug)}>
                      {page.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ol>
      <p>
        <Link href={`/auth/worlds/${worldSlug}/timeline`}>Gesamte Timeline</Link>
      </p>
    </section>
  );
}
