import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppRepository, prisma } from "@uwe/database/server";
import { createSessionWrapUpService } from "@uwe/campaign-cockpit";
import { SidebarSection } from "@uwe/shared-ui";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { campaignCockpitBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { requireStudioWorldRead } from "@/src/lib/authz";
import { advanceWorldCalendarAction } from "../../../../../world-calendar-actions";
import {
  adoptNoteAsEventAction,
  attachNoteToQuestAction,
  createEventFromWrapUpAction,
  ignoreNoteInWrapUpAction,
  markSessionWrappedAction,
  updateQuestStatusInPlaceAction,
} from "../../../../../kampagnen-actions";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";

/**
 * Session-Abschluss-Flow („Kanonisierung"): Session wählen → Ereignisse in die
 * Chronik → Quests abhaken → Weltuhr weiterstellen → geteilte Spielernotizen
 * reviewen → Session als ausgewertet markieren. Schrittführung über
 * Query-Parameter, jede Aktion kehrt mit Anker hierher zurück.
 */

interface Props {
  params: Promise<{ worldSlug: string; campaignSlug: string }>;
  searchParams: Promise<{
    session?: string;
    saved?: string;
    event?: string;
    note?: string;
    clock?: string;
  }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

/** TODO(design-kit): natives Select wie im Dungeon-Cockpit — Kit-Select ist Client-only. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function SessionWrapUpPage({ params, searchParams }: Props) {
  const { worldSlug, campaignSlug } = await params;
  const { session: sessionId, saved, event, note, clock } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();
  await requireStudioWorldRead(worldSlug);

  const wrapUp = await createSessionWrapUpService(prisma).getSessionWrapUp(
    worldSlug,
    campaignSlug,
    sessionId ?? null,
  );
  if (!wrapUp) notFound();

  const base = `/worlds/${worldSlug}`;
  const cockpitPath = `${base}/kampagnen/${campaignSlug}`;
  const abschlussPath = `${cockpitPath}/abschluss`;
  const { campaign, session } = wrapUp;

  return (
    <>
      <ShellBreadcrumb
        items={campaignCockpitBreadcrumb(world.name, worldSlug, [
          { label: campaign.name, href: cockpitPath },
          { label: "Session-Abschluss", href: abschlussPath },
        ])}
      />
      <ShellContextPanel>
        <SidebarSection title="Kampagne">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href={cockpitPath}>← {campaign.name}</Link>
            </li>
            {session ? (
              <li>
                <Link href={`${base}/sessions/${session.id}/review`}>
                  Live-Protokoll &amp; Recap →
                </Link>
              </li>
            ) : null}
            <li>
              <Link href={`${base}/chronicle`}>Chronik →</Link>
            </li>
          </ul>
        </SidebarSection>
        {session ? (
          <SidebarSection title="Schritte">
            <ol className="flex flex-col gap-1.5 text-sm">
              <li>
                <Link href="#schritt-ereignisse">1. Ereignisse</Link>
              </li>
              <li>
                <Link href="#schritt-quests">2. Quests</Link>
              </li>
              <li>
                <Link href="#schritt-weltuhr">3. Weltuhr</Link>
              </li>
              <li>
                <Link href="#schritt-notizen">4. Spielernotizen</Link>
              </li>
              <li>
                <Link href="#schritt-fertig">5. Abschließen</Link>
              </li>
            </ol>
          </SidebarSection>
        ) : null}
      </ShellContextPanel>
      <PageHeader
        title="Session-Abschluss"
        summary={
          session
            ? `Session ${session.sessionNumber}: ${session.title} — Ereignisse, Quests, Weltuhr und Spielernotizen in einem Rutsch kanonisieren.`
            : `Welche Session von „${campaign.name}" soll ausgewertet werden?`
        }
      />

      {saved === "1" ? (
        <Alert tone="success" className="mb-4">
          Gespeichert.
        </Alert>
      ) : null}
      {event === "1" ? (
        <Alert tone="success" className="mb-4">
          Ereignis in die Chronik übernommen.
        </Alert>
      ) : null}
      {note === "1" ? (
        <Alert tone="success" className="mb-4">
          Notiz verarbeitet.
        </Alert>
      ) : null}
      {clock === "1" ? (
        <Alert tone="success" className="mb-4">
          Weltuhr weitergestellt.
        </Alert>
      ) : null}

      {!session ? (
        <Card>
          <CardHeader>
            <CardTitle>Session wählen</CardTitle>
          </CardHeader>
          <CardContent>
            {wrapUp.sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Diese Kampagne hat noch keine Sessions.{" "}
                <Link href={`${base}/sessions`}>Session anlegen →</Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {[...wrapUp.sessions]
                  .sort((a, b) => Number(a.wrapped) - Number(b.wrapped))
                  .map((candidate) => (
                    <li key={candidate.id} className="flex flex-wrap items-center gap-3">
                      <Link href={`${abschlussPath}?session=${candidate.id}`}>
                        Session {candidate.sessionNumber}: {candidate.title}
                      </Link>
                      {candidate.date ? (
                        <span className="text-muted-foreground">
                          {DATE_FORMAT.format(candidate.date)}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground">
                        {candidate.wrapped ? "ausgewertet" : `Status: ${candidate.status}`}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Card id="schritt-ereignisse">
            <CardHeader>
              <CardTitle>1. Ereignisse in die Chronik</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {wrapUp.reviewDraft && wrapUp.reviewDraft.total > 0 ? (
                <div className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">Gedächtnisstütze aus dem Live-Protokoll:</p>
                  <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
                    {[...wrapUp.reviewDraft.questUpdates, ...wrapUp.reviewDraft.notes]
                      .slice(0, 8)
                      .map((entry) => (
                        <li key={entry.id}>• {entry.content}</li>
                      ))}
                    {wrapUp.reviewDraft.loot.length > 0 ? (
                      <li>• Beute: {wrapUp.reviewDraft.loot.map((entry) => entry.content).join(", ")}</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {wrapUp.sessionEvents.length > 0 ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {wrapUp.sessionEvents.map((sessionEvent) => (
                    <li key={sessionEvent.id}>
                      <span className="text-muted-foreground">{sessionEvent.dateLabel}</span>{" "}
                      <strong>{sessionEvent.title}</strong>
                      {sessionEvent.summary ? (
                        <span className="text-muted-foreground"> — {sessionEvent.summary}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Noch kein Ereignis für diese Session erfasst.
                </p>
              )}

              <details className="rounded-md border border-border p-3" open>
                <summary className="cursor-pointer text-sm font-medium">Ereignis erfassen</summary>
                <form action={createEventFromWrapUpAction} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="campaignSlug" value={campaignSlug} />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="event-title">Titel</Label>
                    <Input id="event-title" name="title" required maxLength={160} />
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="event-day">Tag</Label>
                      <Input
                        id="event-day"
                        name="eventDay"
                        type="number"
                        className="w-20"
                        defaultValue={wrapUp.clock.current?.day ?? 1}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="event-month">Monat</Label>
                      <Input
                        id="event-month"
                        name="eventMonth"
                        type="number"
                        className="w-20"
                        defaultValue={wrapUp.clock.current?.month ?? 1}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="event-year">Jahr</Label>
                      <Input
                        id="event-year"
                        name="eventYear"
                        type="number"
                        className="w-24"
                        defaultValue={wrapUp.clock.current?.year ?? 1}
                      />
                    </div>
                    {wrapUp.clock.label ? (
                      <p className="text-sm text-muted-foreground">Weltuhr: {wrapUp.clock.label}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="event-summary-player">Spieler-Zusammenfassung (optional)</Label>
                    <Textarea id="event-summary-player" name="summaryPlayer" rows={2} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="event-summary-dm">DM-Notiz (optional, nur Studio)</Label>
                    <Textarea id="event-summary-dm" name="summaryDm" rows={2} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="event-quest" className="text-sm">
                      Quest verknüpfen
                    </label>
                    <select id="event-quest" name="questPageId" className={NATIVE_SELECT_CLASS}>
                      <option value="">— keine —</option>
                      {wrapUp.openQuests.map((quest) => (
                        <option key={quest.id} value={quest.id}>
                          {quest.title}
                        </option>
                      ))}
                    </select>
                    <select name="questRole" className={NATIVE_SELECT_CLASS} aria-label="Rolle der Quest">
                      <option value="trigger">als Auslöser</option>
                      <option value="consequence">als Folge</option>
                      <option value="involved">beteiligt</option>
                    </select>
                  </div>
                  {wrapUp.factions.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <label htmlFor="event-faction" className="text-sm">
                        Fraktion verknüpfen
                      </label>
                      <select id="event-faction" name="factionPageId" className={NATIVE_SELECT_CLASS}>
                        <option value="">— keine —</option>
                        {wrapUp.factions.map((faction) => (
                          <option key={faction.id} value={faction.id}>
                            {faction.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <Button type="submit" className="self-start">
                    In die Chronik
                  </Button>
                </form>
              </details>
            </CardContent>
          </Card>

          <Card id="schritt-quests">
            <CardHeader>
              <CardTitle>2. Quests abhaken</CardTitle>
            </CardHeader>
            <CardContent>
              {wrapUp.openQuests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine offenen Quests in dieser Kampagne.
                </p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {wrapUp.openQuests.map((quest) => (
                    <li key={quest.id} className="flex flex-wrap items-center gap-3">
                      <Link href={quest.href}>{quest.title}</Link>
                      <span className="inline-flex gap-1">
                        <form action={updateQuestStatusInPlaceAction} className="inline-flex">
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="pageId" value={quest.id} />
                          <input type="hidden" name="returnTo" value="abschluss" />
                          <input type="hidden" name="campaignSlug" value={campaignSlug} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="questStatus" value="completed" />
                          <Button type="submit" variant="ghost" size="sm">
                            Abgeschlossen
                          </Button>
                        </form>
                        <form action={updateQuestStatusInPlaceAction} className="inline-flex">
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="pageId" value={quest.id} />
                          <input type="hidden" name="returnTo" value="abschluss" />
                          <input type="hidden" name="campaignSlug" value={campaignSlug} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="questStatus" value="failed" />
                          <Button type="submit" variant="ghost" size="sm">
                            Gescheitert
                          </Button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card id="schritt-weltuhr">
            <CardHeader>
              <CardTitle>3. Weltuhr weiterstellen</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {wrapUp.clock.label ? (
                  <>
                    Aktuell: <strong>{wrapUp.clock.label}</strong>
                  </>
                ) : (
                  <>
                    Noch keine Weltuhr eingerichtet —{" "}
                    <Link href={`${base}/calendar`}>zum Kalender →</Link>
                  </>
                )}
              </p>
              {wrapUp.clock.current ? (
                <form
                  action={advanceWorldCalendarAction}
                  className="mt-3 flex flex-wrap items-center gap-3"
                >
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="returnTo" value="abschluss" />
                  <input type="hidden" name="campaignSlug" value={campaignSlug} />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <Label htmlFor="advance-days">Tage vor</Label>
                  <Input
                    id="advance-days"
                    name="advanceDays"
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={1}
                    className="w-24"
                  />
                  <Button type="submit" size="sm">
                    Weiterstellen
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>

          <Card id="schritt-notizen">
            <CardHeader>
              <CardTitle>4. Geteilte Spielernotizen</CardTitle>
            </CardHeader>
            <CardContent>
              {wrapUp.sharedNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine geteilten Notizen zu dieser Session. Private Notizen der Spieler erscheinen
                  hier grundsätzlich nicht.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {wrapUp.sharedNotes.map((sharedNote) => (
                    <li key={sharedNote.id} className="rounded-md border border-border p-3">
                      <p className="text-sm">
                        <strong>{sharedNote.authorDisplayName}</strong>
                        {sharedNote.pageTitle ? (
                          <span className="text-muted-foreground"> zu „{sharedNote.pageTitle}&ldquo;</span>
                        ) : null}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{sharedNote.content}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <form action={adoptNoteAsEventAction} className="inline-flex">
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="campaignSlug" value={campaignSlug} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="noteId" value={sharedNote.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Als Chronik-Ereignis
                          </Button>
                        </form>
                        {wrapUp.openQuests.length > 0 ? (
                          <form action={attachNoteToQuestAction} className="inline-flex items-center gap-2">
                            <input type="hidden" name="worldSlug" value={worldSlug} />
                            <input type="hidden" name="campaignSlug" value={campaignSlug} />
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input type="hidden" name="noteId" value={sharedNote.id} />
                            <select
                              name="questPageId"
                              className={NATIVE_SELECT_CLASS}
                              aria-label="Quest für diese Notiz"
                            >
                              {wrapUp.openQuests.map((quest) => (
                                <option key={quest.id} value={quest.id}>
                                  {quest.title}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" variant="outline" size="sm">
                              An Quest hängen
                            </Button>
                          </form>
                        ) : null}
                        <form action={ignoreNoteInWrapUpAction} className="inline-flex">
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="campaignSlug" value={campaignSlug} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="noteId" value={sharedNote.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Ignorieren
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card id="schritt-fertig">
            <CardHeader>
              <CardTitle>5. Abschließen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Markiert die Session als ausgewertet. Den Recap-Text für die Spieler schreibst du im{" "}
                <Link href={`${base}/sessions/${session.id}/review`}>Live-Protokoll &amp; Recap</Link>.
              </p>
              <form action={markSessionWrappedAction}>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <input type="hidden" name="campaignSlug" value={campaignSlug} />
                <input type="hidden" name="sessionId" value={session.id} />
                <Button type="submit">Session als ausgewertet markieren</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
