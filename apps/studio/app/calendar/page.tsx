import Link from "next/link";
import {
  EmptyState,
} from "@uwe/shared-ui";
import {
  CALENDAR_EVENT_KIND_LABELS,
  CALENDAR_FEED_TYPE_LABELS,
  createCalendarService,
  getAppRepository,
  prisma,
  resolveCalendarConfig,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { CalendarMonthGrid } from "@/components/CalendarMonthGrid";
import { CalendarWeekGrid } from "@/components/CalendarWeekGrid";
import { createCalendarEventAction, createCalendarFeedAction } from "../integration-actions";

const DATE_FMT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

interface Props {
  searchParams: Promise<{ view?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const { view } = await searchParams;
  const calendarView = view === "week" ? "week" : "month";

  const config = resolveCalendarConfig();
  const calendar = createCalendarService(prisma);
  const repo = getAppRepository();
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 86400000);

  const [events, feeds, worlds] = await Promise.all([
    calendar.listEvents({ from: new Date(now.getFullYear(), now.getMonth(), 1), to: in30Days }),
    calendar.listFeeds(true),
    repo.listWorldsWithGuestMode(),
  ]);

  const writeableFeeds = feeds.filter(
    (feed) => feed.type === "caldav" && feed.direction === "read_write",
  );

  const gridEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    startAt: event.startAt.toISOString(),
    kind: event.kind,
  }));

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Kalender" }]} />}>
      <PageHeader
        title="Kalender"
        summary="Lokaler UWE-Kalender, CalDAV/iCal-Sync, Session-Termine und FamilyWall read-only."
        actions={
          <>
            <Link
              href="/calendar?view=month"
              className={`uwe-v2-btn ${calendarView === "month" ? "uwe-v2-btn-primary" : ""}`}
            >
              Monat
            </Link>
            <Link
              href="/calendar?view=week"
              className={`uwe-v2-btn ${calendarView === "week" ? "uwe-v2-btn-primary" : ""}`}
            >
              Woche
            </Link>
            <Link href="/api/calendar/events?export=ics" className="uwe-v2-btn">
              .ics Export
            </Link>
          </>
        }
      />
          {!config.enabled && (
            <p className="uwe-notice uwe-notice-warn">Kalender-Integration ist deaktiviert.</p>
          )}

          <div className="uwe-dashboard-grid">
            <section className="uwe-v2-card uwe-v2-card-padded uwe-form">
              <h2>Termin anlegen</h2>
              <form action={createCalendarEventAction} className="uwe-form">
                <label>
                  Titel
                  <input name="title" required />
                </label>
                <label>
                  Art
                  <select name="kind" defaultValue="session">
                    {Object.entries(CALENDAR_EVENT_KIND_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                {writeableFeeds.length > 0 && (
                  <label>
                    CalDAV-Feed (Zwei-Wege)
                    <select name="feedId" defaultValue="">
                      <option value="">Lokal (UWE)</option>
                      {writeableFeeds.map((feed) => (
                        <option key={feed.id} value={feed.id}>
                          {feed.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Welt (optional)
                  <select name="worldId" defaultValue="">
                    <option value="">—</option>
                    {worlds.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start
                  <input name="startAt" type="datetime-local" required />
                </label>
                <label>
                  Ende (optional)
                  <input name="endAt" type="datetime-local" />
                </label>
                <label>
                  <input name="allDay" type="checkbox" /> Ganztägig
                </label>
                <label>
                  Beschreibung
                  <textarea name="description" rows={2} />
                </label>
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                  Speichern
                </button>
              </form>
            </section>

            <section className="uwe-v2-card uwe-v2-card-padded uwe-form">
              <h2>Feed hinzufügen</h2>
              <form action={createCalendarFeedAction} className="uwe-form">
                <label>
                  Name
                  <input name="name" required placeholder="iCloud / FamilyWall / Nextcloud" />
                </label>
                <label>
                  Typ
                  <select name="type" defaultValue="ical_url">
                    {Object.entries(CALENDAR_FEED_TYPE_LABELS)
                      .filter(([v]) => v !== "local")
                      .map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  iCal-URL (FamilyWall, iCloud public, Nextcloud)
                  <input name="url" type="url" placeholder="https://…/calendar.ics" />
                </label>
                <label>
                  CalDAV-URL (optional)
                  <input name="caldavUrl" type="url" placeholder="https://…/caldav/…" />
                </label>
                <label>
                  Benutzername (CalDAV)
                  <input name="username" autoComplete="off" />
                </label>
                <label>
                  CalDAV-Passwort (pro Feed, verschlüsselt gespeichert)
                  <input name="password" type="password" autoComplete="new-password" />
                </label>
                <label>
                  <input name="readWrite" type="checkbox" /> Zwei-Wege-Sync (CalDAV read/write)
                </label>
                <p className="uwe-hint">
                  Alternativ weiterhin global über ENV CALDAV_PASSWORD. Sync startet automatisch.
                </p>
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={!config.enabled}>
                  Feed + Sync
                </button>
              </form>
            </section>
          </div>

          {calendarView === "week" ? (
            <CalendarWeekGrid weekStart={now} events={gridEvents} />
          ) : (
            <CalendarMonthGrid month={now} events={gridEvents} />
          )}

          <section style={{ marginTop: "1.5rem" }}>
            <h2 className="uwe-v2-section-title">Feeds</h2>
            {feeds.length === 0 ? (
              <EmptyState title="Keine Feeds" description="Lokaler Kalender wird beim ersten Termin angelegt." />
            ) : (
              <ul className="uwe-list-cards">
                {feeds.map((feed) => (
                  <li key={feed.id} className="uwe-list-card">
                    <strong>{feed.name}</strong>
                    <span className="uwe-badge">{CALENDAR_FEED_TYPE_LABELS[feed.type]}</span>
                    {feed.direction === "read_write" && (
                      <span className="uwe-badge uwe-badge-player">Zwei-Wege</span>
                    )}
                    {feed.lastSyncAt && (
                      <span className="uwe-dashboard-muted">
                        Sync: {DATE_FMT.format(feed.lastSyncAt)}
                      </span>
                    )}
                    {feed.syncError && <span className="uwe-notice-warn">{feed.syncError}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{ marginTop: "1.5rem" }}>
            <h2 className="uwe-v2-section-title">Nächste 30 Tage</h2>
            {events.length === 0 ? (
              <EmptyState title="Keine Termine" description="Lege einen Termin an oder synchronisiere einen Feed." />
            ) : (
              <ul className="uwe-list-cards">
                {events.map((event) => (
                  <li key={event.id} className="uwe-list-card">
                    <strong>{event.title}</strong>
                    <span className="uwe-badge">{CALENDAR_EVENT_KIND_LABELS[event.kind]}</span>
                    <p className="uwe-dashboard-muted">{DATE_FMT.format(event.startAt)}</p>
                    {event.feed && <span className="uwe-dashboard-muted">Feed: {event.feed.name}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
    </StudioShell>
  );
}
