import Link from "next/link";
import { familyPrisma } from "@uwe/database/family-client";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";
import {
  CALENDAR_EVENT_KIND_LABELS,
  CALENDAR_FEED_TYPE_LABELS,
  createCalendarService,
  getAppRepository,
  prisma,
  resolveCalendarConfig,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { CalendarMonthGrid } from "@/components/CalendarMonthGrid";
import { CalendarWeekGrid } from "@/components/CalendarWeekGrid";
import { CalendarEventFocus } from "@/components/CalendarEventFocus";
import {
  createCalendarEventAction,
  createCalendarFeedAction,
  deleteCalendarEventAction,
  syncCalendarFeedAction,
  updateCalendarEventAction,
} from "../integration-actions";
import {
  calendarPageHref,
  parseCalendarFocusDate,
  shiftCalendarMonth,
  startOfWeekMonday,
  toDateTimeLocalValue,
} from "@/src/lib/calendar-nav";

const DATE_FMT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

// Radix Select erlaubt keinen Item-Wert value="" — Felder mit echtem Leerwert
// (Feed/Welt "keine Auswahl") bleiben native <select>, gestylt wie Kit-Input.
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";

interface Props {
  searchParams: Promise<{ view?: string; year?: string; month?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const calendarView = params.view === "week" ? "week" : "month";
  const now = new Date();
  const focusDate = parseCalendarFocusDate(params.year, params.month, now);
  const prevMonth = shiftCalendarMonth(focusDate, -1);
  const nextMonth = shiftCalendarMonth(focusDate, 1);

  const config = resolveCalendarConfig();
  const calendar = createCalendarService(familyPrisma, prisma);
  const repo = getAppRepository();
  const rangeStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const rangeEnd = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const [events, feeds, worlds] = await Promise.all([
    calendar.listEvents({ from: rangeStart, to: rangeEnd }),
    calendar.listFeeds(true),
    repo.listWorldsWithGuestMode(),
  ]);

  const writeableFeeds = feeds.filter(
    (feed) => feed.type === "caldav" && feed.direction === "read_write",
  );

  const gridEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    startAt: event.startAt.toISOString(),
    kind: event.kind,
  }));

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Kalender" }]} />}>
      <CalendarEventFocus />
      <PageHeader
        title="Kalender"
        summary="Lokaler UWE-Kalender, CalDAV/iCal-Sync, Session-Termine und FamilyWall read-only."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={calendarPageHref("month", prevMonth)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              ←
            </Link>
            <Link href={calendarPageHref("month", nextMonth)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              →
            </Link>
            <Link
              href={calendarPageHref("month", focusDate)}
              className={buttonVariants({ variant: calendarView === "month" ? "default" : "outline", size: "sm" })}
            >
              Monat
            </Link>
            <Link
              href={calendarPageHref("week", focusDate)}
              className={buttonVariants({ variant: calendarView === "week" ? "default" : "outline", size: "sm" })}
            >
              Woche
            </Link>
            <Link href="/api/calendar/events?export=ics" className={buttonVariants({ variant: "outline", size: "sm" })}>
              .ics Export
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        {!config.enabled && <Alert tone="warning">Kalender-Integration ist deaktiviert.</Alert>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Termin anlegen</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createCalendarEventAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-new-title">Titel</Label>
                  <Input id="calendar-new-title" name="title" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-new-kind">Art</Label>
                  <Select name="kind" defaultValue="session">
                    <SelectTrigger id="calendar-new-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CALENDAR_EVENT_KIND_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {writeableFeeds.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="calendar-new-feed">CalDAV-Feed (Zwei-Wege)</Label>
                    {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für
                        "Lokal (UWE)" — natives Select beibehalten. */}
                    <select id="calendar-new-feed" name="feedId" defaultValue="" className={NATIVE_SELECT_CLASS}>
                      <option value="">Lokal (UWE)</option>
                      {writeableFeeds.map((feed) => (
                        <option key={feed.id} value={feed.id}>
                          {feed.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-new-world">Welt (optional)</Label>
                  {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für "—". */}
                  <select id="calendar-new-world" name="worldId" defaultValue="" className={NATIVE_SELECT_CLASS}>
                    <option value="">—</option>
                    {worlds.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-new-start">Start</Label>
                  <Input id="calendar-new-start" name="startAt" type="datetime-local" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-new-end">Ende (optional)</Label>
                  <Input id="calendar-new-end" name="endAt" type="datetime-local" />
                </div>
                {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
                <label className={CHECKBOX_ROW_CLASS}>
                  <input name="allDay" type="checkbox" className={CHECKBOX_CLASS} /> Ganztägig
                </label>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-new-description">Beschreibung</Label>
                  <Textarea id="calendar-new-description" name="description" rows={2} />
                </div>
                <div>
                  <Button type="submit">Speichern</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feed hinzufügen</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createCalendarFeedAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-feed-name">Name</Label>
                  <Input id="calendar-feed-name" name="name" required placeholder="iCloud / FamilyWall / Nextcloud" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-feed-type">Typ</Label>
                  <Select name="type" defaultValue="ical_url">
                    <SelectTrigger id="calendar-feed-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CALENDAR_FEED_TYPE_LABELS)
                        .filter(([v]) => v !== "local")
                        .map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-feed-url">iCal-URL (FamilyWall, iCloud public, Nextcloud)</Label>
                  <Input id="calendar-feed-url" name="url" type="url" placeholder="https://…/calendar.ics" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-feed-caldav-url">CalDAV-URL (optional)</Label>
                  <Input id="calendar-feed-caldav-url" name="caldavUrl" type="url" placeholder="https://…/caldav/…" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-feed-username">Benutzername (CalDAV)</Label>
                  <Input id="calendar-feed-username" name="username" autoComplete="off" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="calendar-feed-password">CalDAV-Passwort (pro Feed, verschlüsselt gespeichert)</Label>
                  <Input id="calendar-feed-password" name="password" type="password" autoComplete="new-password" />
                </div>
                {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
                <label className={CHECKBOX_ROW_CLASS}>
                  <input name="readWrite" type="checkbox" className={CHECKBOX_CLASS} /> Zwei-Wege-Sync (CalDAV read/write)
                </label>
                <p className="text-sm text-muted-foreground">
                  Alternativ weiterhin global über ENV CALDAV_PASSWORD. Sync startet automatisch.
                </p>
                <div>
                  <Button type="submit" disabled={!config.enabled}>
                    Feed + Sync
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {calendarView === "week" ? (
          <CalendarWeekGrid weekStart={startOfWeekMonday(focusDate)} events={gridEvents} />
        ) : (
          <CalendarMonthGrid month={focusDate} events={gridEvents} />
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Feeds</h2>
          {feeds.length === 0 ? (
            <EmptyState title="Keine Feeds" description="Lokaler Kalender wird beim ersten Termin angelegt." />
          ) : (
            <ul className="grid gap-2">
              {feeds.map((feed) => (
                <li key={feed.id}>
                  <Card>
                    <CardContent className="flex flex-wrap items-center gap-2 p-4">
                      <strong>{feed.name}</strong>
                      <Badge>{CALENDAR_FEED_TYPE_LABELS[feed.type]}</Badge>
                      {feed.direction === "read_write" && (
                        <>
                          {/* TODO(design-kit): keine "player-visible"-Badge-Variante im Kit — nächstliegend: info. */}
                          <Badge variant="info">Zwei-Wege</Badge>
                        </>
                      )}
                      {feed.lastSyncAt && (
                        <span className="text-sm text-muted-foreground">
                          Sync: {DATE_FMT.format(feed.lastSyncAt)}
                        </span>
                      )}
                      {feed.syncError && <span className="text-sm text-warning">{feed.syncError}</span>}
                      <form action={syncCalendarFeedAction} className="mt-1 w-full">
                        <input type="hidden" name="feedId" value={feed.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Jetzt synchronisieren
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Termine im{" "}
            {new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(focusDate)}
          </h2>
          {events.length === 0 ? (
            <EmptyState title="Keine Termine" description="Lege einen Termin an oder synchronisiere einen Feed." />
          ) : (
            <ul className="grid gap-2">
              {events.map((event) => (
                <li key={event.id} id={`event-${event.id}`}>
                  <Card>
                    <CardContent className="p-4">
                      <details>
                        <summary className="cursor-pointer">
                          <strong>{event.title}</strong>{" "}
                          <Badge>{CALENDAR_EVENT_KIND_LABELS[event.kind]}</Badge>
                          <span className="text-sm text-muted-foreground"> — {DATE_FMT.format(event.startAt)}</span>
                        </summary>
                        <div className="mt-3 flex flex-col gap-4">
                          <form action={updateCalendarEventAction} className="flex flex-col gap-4">
                            <input type="hidden" name="id" value={event.id} />
                            <div className="flex flex-col gap-1.5">
                              <Label htmlFor={`event-${event.id}-title`}>Titel</Label>
                              <Input id={`event-${event.id}-title`} name="title" defaultValue={event.title} required />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label htmlFor={`event-${event.id}-kind`}>Art</Label>
                              <Select name="kind" defaultValue={event.kind}>
                                <SelectTrigger id={`event-${event.id}-kind`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(CALENDAR_EVENT_KIND_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label htmlFor={`event-${event.id}-start`}>Start</Label>
                              <Input
                                id={`event-${event.id}-start`}
                                name="startAt"
                                type="datetime-local"
                                defaultValue={toDateTimeLocalValue(event.startAt)}
                                required
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label htmlFor={`event-${event.id}-end`}>Ende (optional)</Label>
                              <Input
                                id={`event-${event.id}-end`}
                                name="endAt"
                                type="datetime-local"
                                defaultValue={event.endAt ? toDateTimeLocalValue(event.endAt) : ""}
                              />
                            </div>
                            {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */}
                            <label className={CHECKBOX_ROW_CLASS}>
                              <input name="allDay" type="checkbox" defaultChecked={event.allDay} className={CHECKBOX_CLASS} /> Ganztägig
                            </label>
                            <div className="flex flex-col gap-1.5">
                              <Label htmlFor={`event-${event.id}-description`}>Beschreibung</Label>
                              <Textarea
                                id={`event-${event.id}-description`}
                                name="description"
                                rows={2}
                                defaultValue={event.description ?? ""}
                              />
                            </div>
                            <div>
                              <Button type="submit">Speichern</Button>
                            </div>
                          </form>
                          <form action={deleteCalendarEventAction}>
                            <input type="hidden" name="id" value={event.id} />
                            <Button type="submit" variant="outline">
                              Termin löschen
                            </Button>
                          </form>
                        </div>
                      </details>
                      {event.feed && <p className="mt-2 text-sm text-muted-foreground">Feed: {event.feed.name}</p>}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
