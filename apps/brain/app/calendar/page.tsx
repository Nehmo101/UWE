import { createCalendarService, prisma } from "@uwe/database/server";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date, allDay: boolean): string {
  return value.toLocaleString("de-DE", {
    month: "short",
    day: "numeric",
    ...(allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

export default async function BrainCalendarPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/calendar" title="Kalender">
        <BrainDenied />
      </BrainShell>
    );
  }

  const events = await createCalendarService(prisma).listEvents();

  return (
    <BrainShell active="/calendar" title="Kalender">
      <p>{events.length} Termin(e) — persönliche und externe Kalender, lokal.</p>
      {events.length === 0 ? (
        <p>Keine Termine.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0", display: "grid", gap: "0.6rem" }}>
          {events.map((event) => (
            <li key={event.id} className="brain-row">
              <strong>{event.title}</strong>
              <span className="brain-tag">{event.kind}</span>
              <span className="brain-muted"> · {formatDateTime(event.startAt, event.allDay)}</span>
              {event.location ? (
                <span className="brain-muted"> · {event.location}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </BrainShell>
  );
}
