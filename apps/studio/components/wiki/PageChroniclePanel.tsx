import Link from "next/link";
import {
  CollapsibleSection,
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
  VisibilityEnum,
} from "@uwe/database/server";
import {
  createWorldEventAction,
  deleteWorldEventAction,
} from "@/app/worlds/[worldSlug]/world-event-actions";
import { Button, Card, CardContent, Input, Label, Textarea } from "@/src/components/ui";

/** TODO(design-kit): natives Select bleibt — Server-Action-Formular (FormData)
    braucht name/defaultValue ohne Client-State, siehe SessionDetailClient.tsx. */
const SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
      <p className="text-sm text-muted-foreground">
        Datierte Ereignisse, die mit dieser Seite verknüpft sind. Spieler sehen nur freigegebene
        Zusammenfassungen in der Portal-Timeline.
      </p>

      {pageEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Chronik-Einträge für diese Seite.</p>
      ) : (
        <ul className="mb-4 grid list-none gap-3 p-0">
          {pageEvents.map((event) => {
            const inGameDate = parseInGameDate(event.inGameDate);
            return (
              <li key={event.id}>
                <Card>
                  <CardContent className="flex flex-col gap-2 py-4">
                    <p>
                      <strong>{formatInGameDate(inGameDate, months)}</strong> — {event.title}
                    </p>
                    {event.summaryPlayer && (
                      <p className="text-sm">{event.summaryPlayer}</p>
                    )}
                    <form action={deleteWorldEventAction}>
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="pageId" value={pageId} />
                      <input type="hidden" name="pageSlug" value={pageSlug} />
                      <input type="hidden" name="category" value={category} />
                      <Button type="submit" variant="destructive" size="sm">
                        Eintrag löschen
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <form action={createWorldEventAction} className="flex flex-col gap-4">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chronicle-event-title">Titel</Label>
          <Input id="chronicle-event-title" name="title" required placeholder="Ereignis auf dieser Seite" />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chronicle-event-year">Jahr</Label>
            <Input
              id="chronicle-event-year"
              name="inGameYear"
              type="number"
              defaultValue={currentDate.year}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chronicle-event-month">Monat</Label>
            <Input
              id="chronicle-event-month"
              name="inGameMonth"
              type="number"
              min={1}
              defaultValue={currentDate.month}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chronicle-event-day">Tag</Label>
            <Input
              id="chronicle-event-day"
              name="inGameDay"
              type="number"
              min={1}
              defaultValue={currentDate.day}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chronicle-event-summary-player">Spieler-Zusammenfassung (optional)</Label>
          <Textarea
            id="chronicle-event-summary-player"
            name="summaryPlayer"
            rows={3}
            placeholder="Spoilerfreier Text für die Timeline"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chronicle-event-summary-dm">DM-Notiz (optional)</Label>
          <Textarea
            id="chronicle-event-summary-dm"
            name="summaryDm"
            rows={2}
            placeholder="Nur im Studio sichtbar"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chronicle-event-visibility">Sichtbarkeit</Label>
          <select
            id="chronicle-event-visibility"
            name="visibility"
            defaultValue="private"
            className={SELECT_CLASS}
          >
            {Object.values(VisibilityEnum).map((value) => (
              <option key={value} value={value}>
                {VISIBILITY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" className="self-start">
          Chronik-Eintrag anlegen
        </Button>
      </form>

      <p className="mt-4">
        <Link href={`/worlds/${worldSlug}/chronicle`}>Alle Welt-Ereignisse anzeigen</Link>
      </p>
    </CollapsibleSection>
  );
}
