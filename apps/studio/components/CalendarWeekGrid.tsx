import type { CalendarGridEvent } from "./CalendarMonthGrid";

interface CalendarWeekGridProps {
  weekStart: Date;
  events: CalendarGridEvent[];
}

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function CalendarWeekGrid({ weekStart, events }: CalendarWeekGridProps) {
  const start = startOfWeek(weekStart);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });

  const weekLabel = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(days[0]);
  const weekEndLabel = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: days[6].getMonth() !== days[0].getMonth() ? "numeric" : undefined,
  }).format(days[6]);

  return (
    <section className="uwe-v2-card" style={{ marginTop: "1.5rem" }}>
      <h2 className="uwe-v2-section-title">{`${weekLabel} – ${weekEndLabel}`}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "0.35rem",
        }}
      >
        {days.map((day, index) => {
          const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
          const dayEvents = events.filter((event) => {
            const eventStart = new Date(event.startAt);
            return eventStart >= dayStart && eventStart < dayEnd;
          });
          const dayNumber = day.getDate();
          const monthShort = new Intl.DateTimeFormat("de-DE", { month: "short" }).format(day);

          return (
            <div key={day.toISOString()}>
              <div className="uwe-dashboard-muted" style={{ fontWeight: 600, textAlign: "center" }}>
                {WEEKDAY_LABELS[index]}
              </div>
              <div
                style={{
                  minHeight: "8rem",
                  border: "1px solid var(--uwe-border, #333)",
                  borderRadius: "6px",
                  padding: "0.35rem",
                  marginTop: "0.25rem",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {dayNumber}. {monthShort}
                </div>
                {dayEvents.map((event) => (
                  <div key={event.id} className="uwe-badge" style={{ display: "block", marginTop: "0.2rem" }}>
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
