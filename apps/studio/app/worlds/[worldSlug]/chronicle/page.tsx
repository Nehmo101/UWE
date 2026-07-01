import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SECRET_LEVEL_LABELS,
  SidebarSection,
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
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}

export default async function WorldChroniclePage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { saved, deleted } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const db = createPrismaClient();
  const events = createWorldEventService(db);
  const calendars = createWorldCalendarService(db);
  const [worldEvents, calendar] = await Promise.all([
    events.listForWorld(world.id),
    calendars.getByWorldId(world.id),
  ]);
  await db.$disconnect();

  const months = parseWorldCalendarMonths(calendar?.months);
  const currentDate = calendar ? parseInGameDate(calendar.currentDate) : { year: 1, month: 1, day: 1 };
  const sortedEvents = [...worldEvents].sort((a, b) => {
    const left = parseInGameDate(a.inGameDate);
    const right = parseInGameDate(b.inGameDate);
    if (left.year !== right.year) return left.year - right.year;
    if (left.month !== right.month) return left.month - right.month;
    return left.day - right.day;
  });

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Chronik",
            `/worlds/${worldSlug}/chronicle`,
          )}
        />
      }
      contextPanel={
        <SidebarSection title="Weltuhr">
          {calendar ? (
            <>
              <p style={{ margin: 0 }}>
                Aktuelles Datum:{" "}
                <strong>{formatInGameDate(parseInGameDate(calendar.currentDate), months)}</strong>
              </p>
              <p style={{ margin: "0.75rem 0 0" }}>
                <Link href={`/worlds/${worldSlug}/calendar`}>Kalender bearbeiten</Link>
              </p>
            </>
          ) : (
            <p className="uwe-hint" style={{ margin: 0 }}>
              <Link href={`/worlds/${worldSlug}/calendar`}>Weltuhr einrichten</Link>
            </p>
          )}
        </SidebarSection>
      }
    >
      <PageHeader
        title="Welt-Chronik"
        summary="Datierte Ereignisse der Kampagne — Grundlage für die Spieler-Timeline im Portal."
      />

      {saved === "1" && (
        <p className="uwe-banner uwe-banner-success" role="status">
          Chronik-Eintrag gespeichert.
        </p>
      )}
      {deleted === "1" && (
        <p className="uwe-banner uwe-banner-success" role="status">
          Chronik-Eintrag gelöscht.
        </p>
      )}

      <section className="uwe-v2-card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Neues Ereignis</h2>
        <form action={createWorldEventAction} className="uwe-v2-form">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="returnTo" value="chronicle" />

          <label>
            Titel
            <input name="title" required />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
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
            Spieler-Zusammenfassung
            <textarea name="summaryPlayer" rows={3} />
          </label>

          <label>
            DM-Notiz
            <textarea name="summaryDm" rows={2} />
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
            Ereignis anlegen
          </button>
        </form>
      </section>

      <section className="uwe-v2-card">
        <h2 style={{ marginTop: 0 }}>Ereignisse ({sortedEvents.length})</h2>
        {sortedEvents.length === 0 ? (
          <p className="uwe-hint">Noch keine Ereignisse erfasst.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {sortedEvents.map((event) => {
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
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.875rem" }}>{event.summaryPlayer}</p>
                  )}
                  {event.summaryDm && (
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", opacity: 0.85 }}>
                      <em>DM:</em> {event.summaryDm}
                    </p>
                  )}
                  {event.entityLinks.length > 0 && (
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem" }}>
                      Verknüpft:{" "}
                      {event.entityLinks.map((link) => link.page.title).join(", ")}
                    </p>
                  )}
                  <form action={deleteWorldEventAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="returnTo" value="chronicle" />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-danger">
                      Löschen
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </WorldShell>
  );
}
