export interface CalendarGridEvent {
  id: string;
  title: string;
  startAt: string;
  kind: string;
}

interface CalendarMonthGridProps {
  month: Date;
  events: CalendarGridEvent[];
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function CalendarMonthGrid({ month, events }: CalendarMonthGridProps) {
  const first = startOfMonth(month);
  const totalDays = daysInMonth(month);
  const startOffset = (first.getDay() + 6) % 7;
  const cells: Array<{ day: number | null; events: CalendarGridEvent[] }> = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, events: [] });
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayStart = new Date(month.getFullYear(), month.getMonth(), day);
    const dayEnd = new Date(month.getFullYear(), month.getMonth(), day + 1);
    const dayEvents = events.filter((event) => {
      const start = new Date(event.startAt);
      return start >= dayStart && start < dayEnd;
    });
    cells.push({ day, events: dayEvents });
  }

  const monthLabel = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(month);

  return (
    <section className="uwe-v2-card" style={{ marginTop: "1.5rem" }}>
      <h2 className="uwe-v2-section-title">{monthLabel}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "0.35rem",
        }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="uwe-dashboard-muted" style={{ fontWeight: 600, textAlign: "center" }}>
            {label}
          </div>
        ))}
        {cells.map((cell, index) => (
          <div
            key={`${cell.day ?? "empty"}-${index}`}
            style={{
              minHeight: "4.5rem",
              border: "1px solid var(--uwe-border)",
              borderRadius: "6px",
              padding: "0.25rem",
              opacity: cell.day ? 1 : 0.35,
            }}
          >
            {cell.day && <div style={{ fontWeight: 600 }}>{cell.day}</div>}
            {cell.events.slice(0, 2).map((event) => (
              <a
                key={event.id}
                href={`#event-${event.id}`}
                className="uwe-badge"
                style={{ display: "block", marginTop: "0.15rem", textDecoration: "none" }}
              >
                {event.title}
              </a>
            ))}
            {cell.events.length > 2 && (
              <div className="uwe-dashboard-muted">+{cell.events.length - 2}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
