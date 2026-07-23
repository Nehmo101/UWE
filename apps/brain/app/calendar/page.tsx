import { createCalendarService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { createEventAction, deleteEventAction, updateEventAction } from "../brain-actions";

export const dynamic = "force-dynamic";

const KINDS: Array<{ value: string; label: string }> = [
  { value: "personal", label: "Persönlich" },
  { value: "dnd", label: "D&D" },
  { value: "prep", label: "Vorbereitung" },
  { value: "session", label: "Session" },
];

function formatDateTime(value: Date, allDay: boolean): string {
  return new Date(value).toLocaleString("de-DE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

/** Date → "YYYY-MM-DDTHH:mm" for <input type="datetime-local"> (host-local time). */
function toLocalInput(value: Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  const events = await createCalendarService(brainPrisma, prisma).listEvents();

  return (
    <BrainShell
      active="/calendar"
      title="Kalender"
      lede={`${events.length} Termin(e) — eigene Termine anlegen; extern synchronisierte Kalender werden nur angezeigt.`}
    >
      <section className="brain-section">
        <h2>Neuer Termin</h2>
        <form action={createEventAction} className="brain-form brain-card">
          <label>
            Titel
            <input name="title" required placeholder="z. B. Zahnarzt" />
          </label>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Beginn
              <input name="startAt" type="datetime-local" required />
            </label>
            <label>
              Ende
              <input name="endAt" type="datetime-local" />
            </label>
          </div>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr auto" }}>
            <label>
              Art
              <select name="kind" defaultValue="personal">
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ort
              <input name="location" placeholder="optional" />
            </label>
            <label
              style={{
                alignSelf: "center",
                display: "flex",
                flexDirection: "row",
                gap: "0.4rem",
                alignItems: "center",
              }}
            >
              <input name="allDay" type="checkbox" style={{ width: "auto" }} />
              Ganztägig
            </label>
          </div>
          <label>
            Notiz
            <textarea name="description" rows={2} />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Termin anlegen
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Termine · {events.length}</h2>
        {events.length === 0 ? (
          <p className="brain-muted">Keine Termine.</p>
        ) : (
          <ul className="brain-list">
            {events.map((event) => {
              const external = Boolean(event.feedId) || event.kind === "external";
              return (
                <li key={event.id} className="brain-row">
                  <div className="brain-row-head">
                    <strong>{event.title}</strong>
                    <span className="brain-tag">{event.kind}</span>
                    <span className="brain-muted">
                      {formatDateTime(event.startAt, event.allDay)}
                      {event.location ? ` · ${event.location}` : ""}
                    </span>
                    {external ? (
                      <span className="brain-muted" style={{ marginLeft: "auto" }}>
                        extern · synchronisiert
                      </span>
                    ) : (
                      <form action={deleteEventAction} style={{ marginLeft: "auto" }}>
                        <input type="hidden" name="id" value={event.id} />
                        <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                          Löschen
                        </button>
                      </form>
                    )}
                  </div>
                  {external ? null : (
                    <details className="brain-edit">
                      <summary>Bearbeiten</summary>
                      <form action={updateEventAction} className="brain-form">
                        <input type="hidden" name="id" value={event.id} />
                        <label>
                          Titel
                          <input name="title" defaultValue={event.title} required />
                        </label>
                        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
                          <label>
                            Beginn
                            <input
                              name="startAt"
                              type="datetime-local"
                              defaultValue={toLocalInput(event.startAt)}
                              required
                            />
                          </label>
                          <label>
                            Ende
                            <input name="endAt" type="datetime-local" defaultValue={toLocalInput(event.endAt)} />
                          </label>
                        </div>
                        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr auto" }}>
                          <label>
                            Art
                            <select name="kind" defaultValue={event.kind}>
                              {KINDS.map((k) => (
                                <option key={k.value} value={k.value}>
                                  {k.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Ort
                            <input name="location" defaultValue={event.location ?? ""} />
                          </label>
                          <label
                            style={{
                              alignSelf: "center",
                              display: "flex",
                              flexDirection: "row",
                              gap: "0.4rem",
                              alignItems: "center",
                            }}
                          >
                            <input
                              name="allDay"
                              type="checkbox"
                              defaultChecked={event.allDay}
                              style={{ width: "auto" }}
                            />
                            Ganztägig
                          </label>
                        </div>
                        <label>
                          Notiz
                          <textarea name="description" rows={2} defaultValue={event.description ?? ""} />
                        </label>
                        <div>
                          <button type="submit" className="brain-btn brain-btn-sm">
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
    </BrainShell>
  );
}
