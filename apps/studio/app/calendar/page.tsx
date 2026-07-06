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
import { CalendarEventFocus } from "@/components/CalendarEventFocus";
import {
  createCalendarEventAction,
  createCalendarFeedAction,
  deleteCalendarEventAction,
  updateCalendarEventAction,
} from "../integration-actions";
import {
  calendarPageHref,
  parseCalendarFocusDate,
  shiftCalendarMonth,
  startOfWeekMonday,
  toDateTimeLocalValue,
} from "@/src/lib/calendar-nav";

const DATE_FMT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

interface Props {
  searchParams: Promise<{ view?: string; year?: string; month?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const calendarView = params.view === "week" ? "week" : "month";
  const now = new Date();
  const focusDate = parseCalendarFocusDate(params.year, params.month, now);
  const prevMonth = shiftCalendarMonth(focusDate, -1);
  const nextMonth = shiftCalendarMonth(focusDate, 1);

  const config = resolveCalendarConfig();
  const calendar = createCalendarService(prisma);
  const repo = getAppRepository();
  const rangeStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const rangeEnd = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const [events, feeds, worlds] = await Promise.all([
    calendar.listEvents({ from: rangeStart, to: rangeEnd }),
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
      <CalendarEventFocus />
      <PageHeader
        title="Kalender"
        summary="Lokaler UWE-Kalender, CalDAV/iCal-Sync, Session-Termine und FamilyWall read-only."
        actions={
          <>
            <Link href={calendarPageHref("month", prevMonth)} className="uwe-v2-btn">
              ←
            </Link>
            <Link href={calendarPageHref("month", nextMonth)} className="uwe-v2-btn">
              →
            </Link>
            <Link
              href={calendarPageHref("month", focusDate)}
              className={`uwe-v2-btn ${calendarView === "month" ? "uwe-v2-btn-primary" : ""}`}
            >
              Monat
            </Link>
            <Link
              href={calendarPageHref("week", focusDate)}
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
            <CalendarWeekGrid weekStart={startOfWeekMonday(focusDate)} events={gridEvents} />
          ) : (
            <CalendarMonthGrid month={focusDate} events={gridEvents} />
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
            <h2 className="uwe-v2-section-title">
              Termine im{" "}
              {new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(focusDate)}
            </h2>
            {events.length === 0 ? (
              <EmptyState title="Keine Termine" description="Lege einen Termin an oder synchronisiere einen Feed." />
            ) : (
              <ul className="uwe-list-cards">
                {events.map((event) => (
                  <li key={event.id} className="uwe-list-card" id={`event-${event.id}`}>
                    <details>
                      <summary style={{ cursor: "pointer" }}>
                        <strong>{event.title}</strong>{" "}
                        <span className="uwe-badge">{CALENDAR_EVENT_KIND_LABELS[event.kind]}</span>
                        <span className="uwe-dashboard-muted"> — {DATE_FMT.format(event.startAt)}</span>
                      </summary>
                      <div className="uwe-form" style={{ marginTop: "0.75rem" }}>
                        <form action={updateCalendarEventAction} className="uwe-form">
                          <input type="hidden" name="id" value={event.id} />
                          <label>
                            Titel
                            <input name="title" defaultValue={event.title} required />
                          </label>
                          <label>
                            Art
                            <select name="kind" defaultValue={event.kind}>
                              {Object.entries(CALENDAR_EVENT_KIND_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Start
                            <input
                              name="startAt"
                              type="datetime-local"
                              defaultValue={toDateTimeLocalValue(event.startAt)}
                              required
                            />
                          </label>
                          <label>
                            Ende (optional)
                            <input
                              name="endAt"
                              type="datetime-local"
                              defaultValue={event.endAt ? toDateTimeLocalValue(event.endAt) : ""}
                            />
                          </label>
                          <label>
                            <input name="allDay" type="checkbox" defaultChecked={event.allDay} /> Ganztägig
                          </label>
                          <label>
                            Beschreibung
                            <textarea name="description" rows={2} defaultValue={event.description ?? ""} />
                          </label>
                          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                            Speichern
                          </button>
                        </form>
                        <form action={deleteCalendarEventAction} style={{ marginTop: "0.75rem" }}>
                          <input type="hidden" name="id" value={event.id} />
                          <button type="submit" className="uwe-v2-btn">
                            Termin löschen
                          </button>
                        </form>
                      </div>
                    </details>
                    {event.feed && <span className="uwe-dashboard-muted">Feed: {event.feed.name}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
    </StudioShell>
  );
}
