import { notFound } from "next/navigation";
import Link from "next/link";
import { SidebarSection } from "@uwe/shared-ui";
import {
  createPrismaClient,
  createWorldCalendarService,
  formatInGameDate,
  getAppRepository,
  parseDayNames,
  parseInGameDate,
  parseWorldCalendarMonths,
} from "@uwe/database/server";
import { updateWorldCalendarAction, advanceWorldCalendarAction } from "@/app/world-calendar-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ saved?: string }>;
}

export default async function WorldCalendarPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { saved } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const db = createPrismaClient();
  const calendars = createWorldCalendarService(db);
  let calendar = await calendars.getByWorldId(world.id);
  if (!calendar) {
    calendar = await calendars.upsertForWorld({ worldId: world.id });
  }
  await db.$disconnect();

  const months = parseWorldCalendarMonths(calendar.months);
  const currentDate = parseInGameDate(calendar.currentDate);
  const dayNames = parseDayNames(calendar.dayNames);
  const formattedDate = formatInGameDate(currentDate, months);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Weltuhr",
            `/worlds/${worldSlug}/calendar`,
          )}
        />
      }
      contextPanel={
        <SidebarSection title="Chronik-Tools">
          <p className="uwe-hint" style={{ margin: 0 }}>
            Der In-Game-Kalender ist die Basis für datierte Chronik-Einträge und die
            Spieler-Timeline.
          </p>
          <p style={{ margin: "0.75rem 0 0" }}>
            <Link href={`/worlds/${worldSlug}/chronicle`}>Zur Welt-Chronik</Link>
          </p>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Weltuhr"
        summary="Konfiguriere Monate, Wochentage und das aktuelle In-Game-Datum dieser Welt."
      />

      {saved === "1" && (
        <p className="uwe-banner uwe-banner-success" role="status">
          Kalender gespeichert.
        </p>
      )}

      <section className="uwe-v2-card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Aktuelles Datum</h2>
        <p style={{ fontSize: "1.25rem", margin: 0 }}>
          <strong>{formattedDate}</strong>
          {calendar.epochLabel ? ` (${calendar.epochLabel})` : null}
        </p>
        <div className="uwe-inline-actions" style={{ marginTop: "1rem", gap: "0.5rem" }}>
          {[1, 7, 30].map((days) => (
            <form key={days} action={advanceWorldCalendarAction} style={{ display: "inline" }}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="advanceDays" value={days} />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                +{days} {days === 1 ? "Tag" : "Tage"}
              </button>
            </form>
          ))}
        </div>
      </section>

      <form action={updateWorldCalendarAction} className="uwe-v2-form uwe-v2-card">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="monthCount" value={months.length} />
        <input type="hidden" name="dayNameCount" value={calendar.daysPerWeek} />

        <label>
          Kalendername
          <input name="name" defaultValue={calendar.name} required />
        </label>

        <label>
          Epochenbezeichnung (optional)
          <input name="epochLabel" defaultValue={calendar.epochLabel ?? ""} placeholder="z. B. Ära des Drachen" />
        </label>

        <label>
          Tage pro Woche
          <input
            name="daysPerWeek"
            type="number"
            min={1}
            max={14}
            defaultValue={calendar.daysPerWeek}
            required
          />
        </label>

        <fieldset>
          <legend>Aktuelles In-Game-Datum</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
            <label>
              Jahr
              <input name="currentYear" type="number" defaultValue={currentDate.year} required />
            </label>
            <label>
              Monat (Index)
              <input
                name="currentMonth"
                type="number"
                min={1}
                max={months.length}
                defaultValue={currentDate.month}
                required
              />
            </label>
            <label>
              Tag
              <input name="currentDay" type="number" min={1} defaultValue={currentDate.day} required />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Monate</legend>
          {months.map((month, index) => (
            <div
              key={month.key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr 1fr",
                gap: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <input type="hidden" name={`month_${index}_key`} value={month.key} />
              <label>
                Schlüssel
                <input value={month.key} readOnly />
              </label>
              <label>
                Name
                <input name={`month_${index}_name`} defaultValue={month.name} required />
              </label>
              <label>
                Tage
                <input
                  name={`month_${index}_days`}
                  type="number"
                  min={1}
                  defaultValue={month.daysInMonth}
                  required
                />
              </label>
            </div>
          ))}
        </fieldset>

        <fieldset>
          <legend>Wochentage (optional)</legend>
          {Array.from({ length: calendar.daysPerWeek }, (_, index) => (
            <label key={index}>
              Tag {index + 1}
              <input
                name={`dayName_${index}`}
                defaultValue={dayNames?.[index] ?? ""}
                placeholder={`Wochentag ${index + 1}`}
              />
            </label>
          ))}
        </fieldset>

        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
          Kalender speichern
        </button>
      </form>
    </WorldShell>
  );
}
