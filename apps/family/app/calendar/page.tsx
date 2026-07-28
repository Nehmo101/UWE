import Link from "next/link";
import {
  CALENDAR_EVENT_KIND_LABELS,
  CALENDAR_FEED_TYPE_LABELS,
  createCalendarService,
  prisma,
} from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { FamilyCalendarMonth } from "@/src/components/FamilyCalendarMonth";
import {
  createEventAction,
  deleteEventAction,
  updateEventAction,
} from "../calendar-actions";

/**
 * Kalender (H11) — die einzige Fassung.
 *
 * Monatsraster zum Überblicken, Liste zum Arbeiten. Fremde Feeds (CalDAV,
 * iCal, FamilyWall) sind schreibgeschützt sichtbar: sie werden über die
 * Kalender-API angelegt und von einem Job abgeholt, nicht hier bearbeitet — eine
 * Änderung würde beim nächsten Sync überschrieben.
 */

export const dynamic = "force-dynamic";

const KINDS: Array<[string, string]> = [
  ["personal", CALENDAR_EVENT_KIND_LABELS.personal],
  ["session", CALENDAR_EVENT_KIND_LABELS.session],
  ["prep", CALENDAR_EVENT_KIND_LABELS.prep],
  ["dnd", CALENDAR_EVENT_KIND_LABELS.dnd],
];

/** Date → "YYYY-MM-DDTHH:mm" für <input type="datetime-local"> (Host-Zeit). */
function toLocalInput(value: Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWhen(value: Date, allDay: boolean): string {
  return new Date(value).toLocaleString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

function parseMonth(year?: string, month?: string, now = new Date()): Date {
  const y = Number.parseInt(year ?? "", 10);
  const m = Number.parseInt(month ?? "", 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(y, m - 1, 1);
}

function monthHref(focus: Date): string {
  return `/calendar?year=${focus.getFullYear()}&month=${focus.getMonth() + 1}`;
}

function EventFields({
  event,
}: {
  event?: {
    title: string;
    description: string | null;
    location: string | null;
    startAt: Date;
    endAt: Date | null;
    allDay: boolean;
    kind: string;
  };
}) {
  return (
    <>
      <label>
        Titel
        <input name="title" defaultValue={event?.title ?? ""} required placeholder="z. B. Zahnarzt" />
      </label>
      <div className="family-form-row">
        <label>
          Beginn
          <input
            name="startAt"
            type="datetime-local"
            defaultValue={toLocalInput(event?.startAt ?? null)}
            required
          />
        </label>
        <label>
          Ende
          <input name="endAt" type="datetime-local" defaultValue={toLocalInput(event?.endAt ?? null)} />
        </label>
      </div>
      <div className="family-form-row">
        <label>
          Art
          <select name="kind" defaultValue={event?.kind ?? "personal"}>
            {KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ort
          <input name="location" defaultValue={event?.location ?? ""} placeholder="optional" />
        </label>
        <label className="family-check">
          <input name="allDay" type="checkbox" defaultChecked={event?.allDay ?? false} />
          Ganztägig
        </label>
      </div>
      <label>
        Notiz
        <textarea name="description" rows={2} defaultValue={event?.description ?? ""} />
      </label>
    </>
  );
}

export default async function FamilyCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/calendar" title="Kalender">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const { year, month } = await searchParams;
  const now = new Date();
  const focus = parseMonth(year, month, now);
  const rangeStart = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const rangeEnd = new Date(focus.getFullYear(), focus.getMonth() + 1, 0, 23, 59, 59, 999);

  const calendar = createCalendarService(familyPrisma, prisma);
  const [events, feeds] = await Promise.all([
    calendar.listEvents({ from: rangeStart, to: rangeEnd, limit: 400 }),
    calendar.listFeeds(true),
  ]);

  const monthLabel = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(focus);
  const externalFeeds = feeds.filter((feed) => feed.type !== "local");

  return (
    <FamilyShell
      active="/calendar"
      title="Kalender"
      eyebrow="Gemeinsamer Bereich"
      lede={`${events.length} Termin(e) im ${monthLabel}. Eigene Termine sind änderbar, synchronisierte nur sichtbar.`}
      actions={
        <span className="family-head-actions">
          <Link
            href={monthHref(new Date(focus.getFullYear(), focus.getMonth() - 1, 1))}
            className="family-btn family-btn-ghost family-btn-sm"
          >
            ← Vormonat
          </Link>
          <Link
            href={monthHref(new Date(now.getFullYear(), now.getMonth(), 1))}
            className="family-btn family-btn-ghost family-btn-sm"
          >
            Heute
          </Link>
          <Link
            href={monthHref(new Date(focus.getFullYear(), focus.getMonth() + 1, 1))}
            className="family-btn family-btn-ghost family-btn-sm"
          >
            Folgemonat →
          </Link>
        </span>
      }
    >
      <section className="family-section">
        <h2>{monthLabel}</h2>
        <FamilyCalendarMonth
          month={focus}
          today={now}
          events={events.map((event) => ({
            id: event.id,
            title: event.title,
            startAt: event.startAt.toISOString(),
            allDay: event.allDay,
          }))}
        />
      </section>

      <section className="family-section">
        <h2>Neuer Termin</h2>
        <form action={createEventAction} className="family-form family-card">
          <EventFields />
          <div>
            <button type="submit" className="family-btn">
              Termin anlegen
            </button>
          </div>
        </form>
      </section>

      <section className="family-section">
        <h2>Termine · {events.length}</h2>
        {events.length === 0 ? (
          <p className="family-muted">In diesem Monat ist nichts eingetragen.</p>
        ) : (
          <ul className="family-list">
            {events.map((event) => {
              const external = event.kind === "external" || Boolean(event.feed && event.feed.type !== "local");
              return (
                <li key={event.id} id={`event-${event.id}`} className="family-row">
                  <div className="family-row-head">
                    <strong>{event.title}</strong>
                    <span className="family-tag">{CALENDAR_EVENT_KIND_LABELS[event.kind]}</span>
                    <span className="family-muted">
                      {formatWhen(event.startAt, event.allDay)}
                      {event.location ? ` · ${event.location}` : ""}
                    </span>
                    {external ? (
                      <span className="family-muted" style={{ marginLeft: "auto" }}>
                        {event.feed?.name ?? "extern"} · synchronisiert
                      </span>
                    ) : (
                      <form action={deleteEventAction} style={{ marginLeft: "auto" }}>
                        <input type="hidden" name="id" value={event.id} />
                        <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                          Löschen
                        </button>
                      </form>
                    )}
                  </div>
                  {external ? null : (
                    <details className="family-edit">
                      <summary>Bearbeiten</summary>
                      <form action={updateEventAction} className="family-form">
                        <input type="hidden" name="id" value={event.id} />
                        <EventFields event={event} />
                        <div>
                          <button type="submit" className="family-btn family-btn-sm">
                            Speichern
                          </button>
                        </div>
                      </form>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {externalFeeds.length > 0 ? (
        <section className="family-section">
          <h2>Fremde Kalender · {externalFeeds.length}</h2>
          <ul className="family-list">
            {externalFeeds.map((feed) => (
              <li key={feed.id} className="family-row">
                <div className="family-row-head">
                  <strong>{feed.name}</strong>
                  <span className="family-tag">{CALENDAR_FEED_TYPE_LABELS[feed.type]}</span>
                  {feed.enabled ? null : <span className="family-tag family-tag-warn">aus</span>}
                  <span className="family-muted">
                    {feed.lastSyncAt
                      ? `zuletzt ${feed.lastSyncAt.toLocaleString("de-DE")}`
                      : "noch nie synchronisiert"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="family-muted">
            Fremde Kalender kommen über die Kalender-API herein
            (<code>POST /api/calendar/feeds</code>) und werden von einem Job abgeholt. Hier stehen
            sie nur zum Nachsehen — was von außen kommt, wird nicht von Hand geändert.
          </p>
        </section>
      ) : null}
    </FamilyShell>
  );
}
