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
import { parseWorldCalendarSettings } from "@uwe/database/world-calendar-settings";
import { updateWorldCalendarAction, advanceWorldCalendarAction } from "@/app/world-calendar-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/src/components/ui";

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
  const calendarSettings = parseWorldCalendarSettings(calendar.settings);
  const holidays = calendarSettings.holidays;

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
          <p className="text-sm text-muted-foreground">
            Der In-Game-Kalender ist die Basis für datierte Chronik-Einträge und die
            Spieler-Timeline.
          </p>
          <p className="mt-3 text-sm">
            <Link href={`/worlds/${worldSlug}/chronicle`}>Zur Welt-Chronik</Link>
          </p>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Weltuhr"
        summary="Konfiguriere Monate, Wochentage und das aktuelle In-Game-Datum dieser Welt."
      />

      {saved === "1" && <Alert tone="success">Kalender gespeichert.</Alert>}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Aktuelles Datum</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xl">
              <strong>{formattedDate}</strong>
              {calendar.epochLabel ? ` (${calendar.epochLabel})` : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {[1, 7, 30].map((days) => (
                <form key={days} action={advanceWorldCalendarAction} className="inline-flex">
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="advanceDays" value={days} />
                  <Button type="submit" variant="secondary" size="sm">
                    +{days} {days === 1 ? "Tag" : "Tage"}
                  </Button>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kalender bearbeiten</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateWorldCalendarAction} className="flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="monthCount" value={months.length} />
              <input type="hidden" name="dayNameCount" value={calendar.daysPerWeek} />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="calendar-name">Kalendername</Label>
                <Input id="calendar-name" name="name" defaultValue={calendar.name} required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="calendar-epoch">Epochenbezeichnung (optional)</Label>
                <Input
                  id="calendar-epoch"
                  name="epochLabel"
                  defaultValue={calendar.epochLabel ?? ""}
                  placeholder="z. B. Ära des Drachen"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="calendar-days-per-week">Tage pro Woche</Label>
                <Input
                  id="calendar-days-per-week"
                  name="daysPerWeek"
                  type="number"
                  min={1}
                  max={14}
                  defaultValue={calendar.daysPerWeek}
                  required
                />
              </div>

              <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
                <legend className="px-1 text-sm font-medium text-foreground">Aktuelles In-Game-Datum</legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="calendar-current-year">Jahr</Label>
                    <Input
                      id="calendar-current-year"
                      name="currentYear"
                      type="number"
                      defaultValue={currentDate.year}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="calendar-current-month">Monat (Index)</Label>
                    <Input
                      id="calendar-current-month"
                      name="currentMonth"
                      type="number"
                      min={1}
                      max={months.length}
                      defaultValue={currentDate.month}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="calendar-current-day">Tag</Label>
                    <Input
                      id="calendar-current-day"
                      name="currentDay"
                      type="number"
                      min={1}
                      defaultValue={currentDate.day}
                      required
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
                <legend className="px-1 text-sm font-medium text-foreground">Monate</legend>
                <div className="flex flex-col gap-3">
                  {months.map((month, index) => (
                    <div key={month.key} className="grid grid-cols-[1fr_2fr_1fr] gap-3">
                      <input type="hidden" name={`month_${index}_key`} value={month.key} />
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`month-${index}-key-display`}>Schlüssel</Label>
                        <Input id={`month-${index}-key-display`} value={month.key} readOnly />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`month-${index}-name`}>Name</Label>
                        <Input
                          id={`month-${index}-name`}
                          name={`month_${index}_name`}
                          defaultValue={month.name}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`month-${index}-days`}>Tage</Label>
                        <Input
                          id={`month-${index}-days`}
                          name={`month_${index}_days`}
                          type="number"
                          min={1}
                          defaultValue={month.daysInMonth}
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
                <legend className="px-1 text-sm font-medium text-foreground">Wochentage (optional)</legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-4">
                  {Array.from({ length: calendar.daysPerWeek }, (_, index) => (
                    <div key={index} className="flex flex-col gap-1.5">
                      <Label htmlFor={`day-name-${index}`}>Tag {index + 1}</Label>
                      <Input
                        id={`day-name-${index}`}
                        name={`dayName_${index}`}
                        defaultValue={dayNames?.[index] ?? ""}
                        placeholder={`Wochentag ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
                <legend className="px-1 text-sm font-medium text-foreground">Feiertage &amp; Weltevents</legend>
                <p className="text-sm text-muted-foreground">
                  Wiederkehrende Festtage im In-Game-Kalender (Monat = Index wie oben, Tag im Monat).
                </p>
                <input type="hidden" name="holidayCount" value={Math.max(holidays.length, 3)} />
                <div className="flex flex-col gap-3">
                  {Array.from({ length: Math.max(holidays.length, 3) }, (_, index) => {
                    const holiday = holidays[index];
                    return (
                      <div key={index} className="grid grid-cols-[2fr_1fr_1fr] gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`holiday-${index}-name`}>Name</Label>
                          <Input
                            id={`holiday-${index}-name`}
                            name={`holiday_${index}_name`}
                            defaultValue={holiday?.name ?? ""}
                            placeholder="z. B. Erntedank"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`holiday-${index}-month`}>Monat</Label>
                          <Input
                            id={`holiday-${index}-month`}
                            name={`holiday_${index}_month`}
                            type="number"
                            min={1}
                            max={months.length}
                            defaultValue={holiday?.month ?? ""}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`holiday-${index}-day`}>Tag</Label>
                          <Input
                            id={`holiday-${index}-day`}
                            name={`holiday_${index}_day`}
                            type="number"
                            min={1}
                            defaultValue={holiday?.day ?? ""}
                          />
                        </div>
                        <div className="col-span-full flex flex-col gap-1.5">
                          <Label htmlFor={`holiday-${index}-notes`}>Notizen (optional)</Label>
                          <Input
                            id={`holiday-${index}-notes`}
                            name={`holiday_${index}_notes`}
                            defaultValue={holiday?.notes ?? ""}
                            placeholder="Kurzbeschreibung für die Chronik"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              {holidays.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Gespeicherte Feiertage</h3>
                  <ul className="flex flex-col gap-1 text-sm">
                    {holidays.map((holiday) => (
                      <li key={`${holiday.month}-${holiday.day}-${holiday.name}`}>
                        <strong>{holiday.name}</strong> — Tag {holiday.day}, Monat {holiday.month}
                        {holiday.notes ? ` (${holiday.notes})` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div>
                <Button type="submit">Kalender speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </WorldShell>
  );
}
