import { Card, CardContent, CardHeader, CardTitle, badgeVariants, cn } from "@/src/components/ui";

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
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{monthLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center text-sm font-semibold text-muted-foreground">
              {label}
            </div>
          ))}
          {cells.map((cell, index) => (
            <div
              key={`${cell.day ?? "empty"}-${index}`}
              className={cn(
                "min-h-[4.5rem] rounded-md border border-border p-1",
                cell.day ? "opacity-100" : "opacity-[0.35]",
              )}
            >
              {cell.day && <div className="font-semibold">{cell.day}</div>}
              {cell.events.slice(0, 2).map((event) => (
                <a
                  key={event.id}
                  href={`#event-${event.id}`}
                  className={cn(badgeVariants(), "mt-1 block no-underline")}
                >
                  {event.title}
                </a>
              ))}
              {cell.events.length > 2 && (
                <div className="text-sm text-muted-foreground">+{cell.events.length - 2}</div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
