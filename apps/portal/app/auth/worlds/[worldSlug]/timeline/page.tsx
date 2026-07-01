import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccessContextForWorld } from "@/src/lib/auth";
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

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalTimelinePage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const repo = getAppRepository();

  let events;
  let months = parseWorldCalendarMonths(undefined);

  try {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      notFound();
    }

    const calendars = createWorldCalendarService(db);
    const calendar = await calendars.getByWorldId(world.id);
    months = parseWorldCalendarMonths(calendar?.months);
    events = await auth.listWorldEventsForViewer(worldSlug, ctx);
  } finally {
    await db.$disconnect();
  }

  return (
    <section className="portal-content-card">
      <h1>Timeline</h1>
      <p className="auth-lead">
        Chronologische Ereignisse — nur freigegebene, spoilerarme Zusammenfassungen.
      </p>

      {events.length === 0 ? (
        <p className="auth-muted">Noch keine sichtbaren Ereignisse in der Timeline.</p>
      ) : (
        <ol className="auth-page-list">
          {events.map((event) => (
            <li key={event.id}>
              <strong>{formatInGameDate(event.inGameDate, months)}</strong>
              <span>{event.title}</span>
              {event.summaryPlayer && <p className="auth-muted">{event.summaryPlayer}</p>}
              {event.linkedPages.length > 0 && (
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
      )}
    </section>
  );
}
