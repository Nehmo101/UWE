import { Card, CardContent, CardHeader, CardTitle, badgeVariants, cn } from "@/src/components/ui";
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
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{`${weekLabel} – ${weekEndLabel}`}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5">
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
                <div className="text-center text-sm font-semibold text-muted-foreground">
                  {WEEKDAY_LABELS[index]}
                </div>
                <div className="mt-1 min-h-32 rounded-md border border-border p-1.5">
                  <div className="font-semibold">
                    {dayNumber}. {monthShort}
                  </div>
                  {dayEvents.map((event) => (
                    <a
                      key={event.id}
                      href={`#event-${event.id}`}
                      className={cn(badgeVariants(), "mt-1 block no-underline")}
                    >
                      {event.title}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
