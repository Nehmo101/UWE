/**
 * Monatsraster des Family-Kalenders.
 *
 * Server-Komponente ohne Client-JS: Blättern läuft über Links, die Termine
 * kommen fertig aus der Seite. Ein Tag zeigt höchstens drei Einträge und
 * verweist auf den Anker in der Liste darunter — das Raster ist Übersicht,
 * nicht Detailansicht.
 */

export interface FamilyCalendarEvent {
  id: string;
  title: string;
  /** ISO-String; die Serialisierung passiert in der Seite. */
  startAt: string;
  allDay: boolean;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MAX_PER_DAY = 3;

function timeLabel(iso: string, allDay: boolean): string {
  if (allDay) return "";
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function FamilyCalendarMonth({
  month,
  events,
  today = new Date(),
}: {
  month: Date;
  events: FamilyCalendarEvent[];
  today?: Date;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  // Montag als erster Tag der Woche: Sonntag (0) rutscht ans Ende.
  const leadingBlanks = (new Date(year, monthIndex, 1).getDay() + 6) % 7;

  const byDay = new Map<number, FamilyCalendarEvent[]>();
  for (const event of events) {
    const start = new Date(event.startAt);
    if (start.getFullYear() !== year || start.getMonth() !== monthIndex) continue;
    const bucket = byDay.get(start.getDate()) ?? [];
    bucket.push(event);
    byDay.set(start.getDate(), bucket);
  }

  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === monthIndex;

  return (
    <div className="family-cal-grid" role="grid" aria-label="Monatsübersicht">
      {WEEKDAYS.map((label) => (
        <div key={label} className="family-cal-weekday" role="columnheader">
          {label}
        </div>
      ))}
      {Array.from({ length: leadingBlanks }, (_, index) => (
        <div key={`blank-${index}`} className="family-cal-day family-cal-day-empty" aria-hidden />
      ))}
      {Array.from({ length: dayCount }, (_, index) => {
        const day = index + 1;
        const dayEvents = byDay.get(day) ?? [];
        const isToday = isCurrentMonth && today.getDate() === day;
        return (
          <div
            key={day}
            className={isToday ? "family-cal-day family-cal-day-today" : "family-cal-day"}
            role="gridcell"
          >
            <span className="family-cal-daynum">{day}</span>
            {dayEvents.slice(0, MAX_PER_DAY).map((event) => (
              <a key={event.id} href={`#event-${event.id}`} className="family-cal-event">
                {timeLabel(event.startAt, event.allDay)} {event.title}
              </a>
            ))}
            {dayEvents.length > MAX_PER_DAY ? (
              <span className="family-muted">+{dayEvents.length - MAX_PER_DAY}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
