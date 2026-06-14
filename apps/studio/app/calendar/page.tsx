import Link from "next/link";
import {
  AppShell,
  EmptyState,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  CALENDAR_EVENT_KIND_LABELS,
  CALENDAR_FEED_TYPE_LABELS,
  createCalendarService,
  getAppRepository,
  prisma,
  resolveCalendarConfig,
} from "@uwe/database/server";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { createCalendarEventAction, createCalendarFeedAction } from "../integration-actions";

const DATE_FMT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

export default async function CalendarPage() {
  const config = resolveCalendarConfig();
  const calendar = createCalendarService(prisma);
  const repo = getAppRepository();
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 86400000);

  const [events, feeds, worlds] = await Promise.all([
    calendar.listEvents({ from: now, to: in30Days }),
    calendar.listFeeds(true),
    repo.listWorldsWithGuestMode(),
  ]);

  return (
    <AppShell
      bottomNav={studioGlobalBottomNav("more")}
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Kalender" href="/calendar" />}
      sidebar={
        <SidebarSection title="UWE Admin">
          <SidebarNav items={adminSidebarNav("/calendar")} />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader
            title="Kalender"
            summary="Lokaler UWE-Kalender, CalDAV/iCal-Sync, Session-Termine und FamilyWall read-only."
            actions={
              <Link href="/api/calendar/events?export=ics" className="uwe-btn">
                .ics Export
              </Link>
            }
          />

          {!config.enabled && (
            <p className="uwe-notice uwe-notice-warn">Kalender-Integration ist deaktiviert.</p>
          )}

          <div className="uwe-dashboard-grid">
            <section className="uwe-card uwe-form">
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
                <button type="submit" className="uwe-btn uwe-btn-primary">
                  Speichern
                </button>
              </form>
            </section>

            <section className="uwe-card uwe-form">
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
                <p className="uwe-hint">
                  CalDAV-Passwort über ENV CALDAV_PASSWORD (serverseitig). Sync startet automatisch.
                </p>
                <button type="submit" className="uwe-btn uwe-btn-primary" disabled={!config.enabled}>
                  Feed + Sync
                </button>
              </form>
            </section>
          </div>

          <section style={{ marginTop: "1.5rem" }}>
            <h2 className="uwe-section-title">Feeds</h2>
            {feeds.length === 0 ? (
              <EmptyState title="Keine Feeds" description="Lokaler Kalender wird beim ersten Termin angelegt." />
            ) : (
              <ul className="uwe-list-cards">
                {feeds.map((feed) => (
                  <li key={feed.id} className="uwe-list-card">
                    <strong>{feed.name}</strong>
                    <span className="uwe-badge">{CALENDAR_FEED_TYPE_LABELS[feed.type]}</span>
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
            <h2 className="uwe-section-title">Nächste 30 Tage</h2>
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
        </>
      }
    />
  );
}
