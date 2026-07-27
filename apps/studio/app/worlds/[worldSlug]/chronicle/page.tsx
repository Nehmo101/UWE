import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SidebarSection,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  createPrismaClient,
  createWorldCalendarService,
  createWorldEventService,
  formatInGameDate,
  getAppRepository,
  parseInGameDate,
  parseWorldCalendarMonths,
  VisibilityEnum,
} from "@uwe/database/server";
import {
  createWorldEventAction,
  deleteWorldEventAction,
} from "@/app/worlds/[worldSlug]/world-event-actions";
import { simulateAllFactionsAction } from "@/app/worlds/[worldSlug]/faction-state-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { ChronicleTimeline } from "@/src/components/world/ChronicleTimeline";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    saved?: string;
    deleted?: string;
    factionTick?: string;
    factionTotal?: string;
  }>;
}

export default async function WorldChroniclePage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { saved, deleted, factionTick, factionTotal } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  const db = createPrismaClient();
  const events = createWorldEventService(db);
  const calendars = createWorldCalendarService(db);
  const [worldEvents, calendar, allPages] = await Promise.all([
    events.listForWorld(world.id),
    calendars.getByWorldId(world.id),
    repo.listPagesByWorld(worldSlug),
  ]);
  await db.$disconnect();

  const factionPages = allPages.filter((page) => page.type === "faction");

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
              <p className="text-sm">
                Aktuelles Datum:{" "}
                <strong>{formatInGameDate(parseInGameDate(calendar.currentDate), months)}</strong>
              </p>
              <p className="mt-3 text-sm">
                <Link href={`/worlds/${worldSlug}/calendar`}>Kalender bearbeiten</Link>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
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

      {saved === "1" && <Alert tone="success">Chronik-Eintrag gespeichert.</Alert>}
      {deleted === "1" && <Alert tone="success">Chronik-Eintrag gelöscht.</Alert>}
      {factionTick !== undefined && (
        <Alert tone="success">
          Fraktions-Tick gestartet: {factionTick} von {factionTotal ?? factionTick} Simulationen
          laufen. Vorschläge erscheinen unter{" "}
          <Link href={`/worlds/${worldSlug}/ai-runs`}>AI Runs</Link> zur Review.
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Fraktions-Simulation (Zwischen-Session-Tick)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {factionPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Fraktions-Seiten in dieser Welt — lege Seiten vom Typ „Fraktion“ an, um die
                Simulation zu nutzen.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Simuliert für alle {factionPages.length} Fraktion(en), was seit der letzten Session
                  passiert ist (Weltuhr:{" "}
                  {calendar
                    ? formatInGameDate(parseInGameDate(calendar.currentDate), months)
                    : "nicht gesetzt"}
                  ). Ergebnisse werden als Vorschläge erzeugt und erst nach Review in die Chronik
                  übernommen.
                </p>
                <p className="text-sm text-muted-foreground">
                  {factionPages.map((page, index) => (
                    <span key={page.id}>
                      {index > 0 && " · "}
                      <Link href={buildPageUrl(worldSlug, page.type, page.slug)}>{page.title}</Link>
                    </span>
                  ))}
                </p>
                <form action={simulateAllFactionsAction}>
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <Button type="submit" variant="secondary">
                    Alle Fraktionen simulieren
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Neues Ereignis</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createWorldEventAction} className="flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="returnTo" value="chronicle" />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-title">Titel</Label>
                <Input id="event-title" name="title" required />
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="event-year">Jahr</Label>
                  <Input id="event-year" name="inGameYear" type="number" defaultValue={currentDate.year} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="event-month">Monat</Label>
                  <Input
                    id="event-month"
                    name="inGameMonth"
                    type="number"
                    min={1}
                    defaultValue={currentDate.month}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="event-day">Tag</Label>
                  <Input id="event-day" name="inGameDay" type="number" min={1} defaultValue={currentDate.day} required />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-summary-player">Spieler-Zusammenfassung</Label>
                <Textarea id="event-summary-player" name="summaryPlayer" rows={3} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-summary-dm">DM-Notiz</Label>
                <Textarea id="event-summary-dm" name="summaryDm" rows={2} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-visibility">Sichtbarkeit</Label>
                <Select name="visibility" defaultValue="private">
                  <SelectTrigger id="event-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(VisibilityEnum).map((value) => (
                      <SelectItem key={value} value={value}>
                        {VISIBILITY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Button type="submit">Ereignis anlegen</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ereignisse ({sortedEvents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ChronicleTimeline
              events={sortedEvents.map((event) => {
                const inGameDate = parseInGameDate(event.inGameDate);
                return {
                  id: event.id,
                  dateLabel: formatInGameDate(inGameDate, months),
                  title: event.title,
                  summaryPlayer: event.summaryPlayer,
                  summaryDm: event.summaryDm,
                  entityLinks:
                    event.entityLinks.length > 0
                      ? `Verknüpft: ${event.entityLinks.map((link) => link.page.title).join(", ")}`
                      : "",
                  deleteForm: (
                    <form action={deleteWorldEventAction}>
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="returnTo" value="chronicle" />
                      <Button type="submit" variant="destructive" size="sm">
                        Löschen
                      </Button>
                    </form>
                  ),
                };
              })}
            />
          </CardContent>
        </Card>
      </div>
    </WorldShell>
  );
}
