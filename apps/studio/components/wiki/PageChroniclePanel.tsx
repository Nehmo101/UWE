import Link from "next/link";
import {
  CollapsibleSection,
  SECRET_LEVEL_LABELS,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import {
  createPrismaClient,
  createWorldCalendarService,
  createWorldEventService,
  formatInGameDate,
  getAppRepository,
  parseInGameDate,
  parseWorldCalendarMonths,
  SecretLevelEnum,
  VisibilityEnum,
} from "@uwe/database/server";
import {
  createWorldEventAction,
  deleteWorldEventAction,
} from "@/app/worlds/[worldSlug]/world-event-actions";

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
}

export async function PageChroniclePanel({ worldSlug, pageId, pageSlug, category }: Props) {
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    return null;
  }

  const db = createPrismaClient();
  const events = createWorldEventService(db);
  const calendars = createWorldCalendarService(db);
  const [pageEvents, calendar] = await Promise.all([
    events.listForPage(pageId),
    calendars.getByWorldId(world.id),
  ]);
  await db.$disconnect();

  const months = parseWorldCalendarMonths(calendar?.months);
  const currentDate = calendar ? parseInGameDate(calendar.currentDate) : { year: 1, month: 1, day: 1 };

  return (
    <CollapsibleSection title="Chronik" defaultOpen={pageEvents.length > 0}>
      <p className="uwe-hint">
        Datierte Ereignisse, die mit dieser Seite verknüpft sind. Spieler sehen nur freigegebene
        Zusammenfassungen in der Portal-Timeline.
      </p>

      {pageEvents.length === 0 ? (
        <p className="uwe-hint">Noch keine Chronik-Einträge für diese Seite.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem" }}>
          {pageEvents.map((event) => {
            const inGameDate = parseInGameDate(event.inGameDate);
            return (
              <li
                key={event.id}
                style={{
                  marginBottom: "1rem",
                  padding: "1rem",
                  border: "1px solid rgba(148,163,184,0.12)",
                  borderRadius: "0.65rem",
                }}
              >
                <p style={{ margin: "0 0 0.35rem" }}>
                  <strong>{formatInGameDate(inGameDate, months)}</strong> — {event.title}
                </p>
                {event.summaryPlayer && (
                  <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem" }}>{event.summaryPlayer}</p>
                )}
                <form action={deleteWorldEventAction}>
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="pageId" value={pageId} />
                  <input type="hidden" name="pageSlug" value={pageSlug} />
                  <input type="hidden" name="category" value={category} />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-danger">
                    Eintrag löschen
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <form action={createWorldEventAction} className="uwe-v2-form">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />

        <label>
          Titel
          <input name="title" required placeholder="Ereignis auf dieser Seite" />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 11rem), 1fr))", gap: "1rem" }}>
          <label>
            Jahr
            <input name="inGameYear" type="number" defaultValue={currentDate.year} required />
          </label>
          <label>
            Monat
            <input name="inGameMonth" type="number" min={1} defaultValue={currentDate.month} required />
          </label>
          <label>
            Tag
            <input name="inGameDay" type="number" min={1} defaultValue={currentDate.day} required />
          </label>
        </div>

        <label>
          Spieler-Zusammenfassung (optional)
          <textarea name="summaryPlayer" rows={3} placeholder="Spoilerfreier Text für die Timeline" />
        </label>

        <label>
          DM-Notiz (optional)
          <textarea name="summaryDm" rows={2} placeholder="Nur im Studio sichtbar" />
        </label>

        <label>
          Sichtbarkeit
          <select name="visibility" defaultValue="private">
            {Object.values(VisibilityEnum).map((value) => (
              <option key={value} value={value}>
                {VISIBILITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Geheimnis-Stufe
          <select name="secretLevel" defaultValue="none">
            {Object.values(SecretLevelEnum).map((value) => (
              <option key={value} value={value}>
                {SECRET_LEVEL_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
          Chronik-Eintrag anlegen
        </button>
      </form>

      <p style={{ marginTop: "1rem" }}>
        <Link href={`/worlds/${worldSlug}/chronicle`}>Alle Welt-Ereignisse anzeigen</Link>
      </p>
    </CollapsibleSection>
  );
}
