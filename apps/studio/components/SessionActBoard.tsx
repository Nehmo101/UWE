import Link from "next/link";
import { DungeonPrepStatusBadge, QuestStatusBadge } from "@uwe/shared-ui";
import type { ChapterView } from "@uwe/campaign-cockpit";
import { updateQuestStatusInPlaceAction } from "@/app/kampagnen-actions";
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui";

/**
 * Akt-Tafel im Live-Modus: der ganze Akt im Schnellzugriff, ohne die
 * Lesefläche zu verlassen — Quests mit Status-Schaltern, NSC/Orte/Fraktionen
 * (gepinnt + aus [[Wiki-Links]] abgeleitet), Dungeons des Kapitels und die
 * offenen Plots der Vorbereitung. Server-gerendert; jede Quick-Action kehrt
 * über returnTo=live hierher zurück.
 */

interface Props {
  worldSlug: string;
  campaignSlug: string;
  sessionId: string;
  /** Offene Plots aus der Session-Vorbereitung — am Tisch stets im Blick. */
  openPlots: string | null;
  view: ChapterView;
}

export function SessionActBoard({ worldSlug, campaignSlug, sessionId, openPlots, view }: Props) {
  const kapitelHref = `/worlds/${worldSlug}/kampagnen/${campaignSlug}/kapitel/${view.chapter.slug}`;
  const relationGroups = (
    [
      ["NSCs", view.actRelations.npcs],
      ["Orte", view.actRelations.locations],
      ["Fraktionen", view.actRelations.factions],
    ] as const
  ).filter(([, targets]) => targets.length > 0);
  const pinnedIds = new Set(view.pins.map((pin) => pin.target.id));

  return (
    <Card className="mb-6" id="akt-tafel">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>
            Akt-Tafel: <Link href={kapitelHref}>{view.chapter.title}</Link>
          </CardTitle>
          <DungeonPrepStatusBadge status={view.chapter.prepStatus} />
          <span className="ml-auto inline-flex flex-wrap gap-2">
            <Link
              href={`/api/worlds/${worldSlug}/kampagnen/kapitel-druck?kapitelId=${view.chapter.id}&variante=dm`}
              target="_blank"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Druck (DM)
            </Link>
            <Link href={kapitelHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Kapitel öffnen →
            </Link>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <section aria-label="Quests des Akts" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Quests</h3>
            {view.quests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Quests in diesem Kapitel.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {view.quests.map((quest) => (
                  <li key={quest.id} className="flex flex-wrap items-center gap-2">
                    <Link href={quest.href}>{quest.title}</Link>
                    <QuestStatusBadge status={quest.status} />
                    {quest.status === "open" ? (
                      <form action={updateQuestStatusInPlaceAction} className="inline-flex">
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="pageId" value={quest.id} />
                        <input type="hidden" name="returnTo" value="live" />
                        <input type="hidden" name="sessionId" value={sessionId} />
                        <input type="hidden" name="questStatus" value="completed" />
                        <Button type="submit" variant="ghost" size="sm">
                          Abschließen
                        </Button>
                      </form>
                    ) : (
                      <form action={updateQuestStatusInPlaceAction} className="inline-flex">
                        <input type="hidden" name="worldSlug" value={worldSlug} />
                        <input type="hidden" name="pageId" value={quest.id} />
                        <input type="hidden" name="returnTo" value="live" />
                        <input type="hidden" name="sessionId" value={sessionId} />
                        <input type="hidden" name="questStatus" value="open" />
                        <Button type="submit" variant="ghost" size="sm">
                          Wieder öffnen
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Im Akt wichtig" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Im Akt wichtig</h3>
            {relationGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine [[Wiki-Links]] und nichts gepinnt — die Tafel füllt sich über die{" "}
                <Link href={kapitelHref}>Kapitel-Seite</Link>.
              </p>
            ) : (
              <dl className="flex flex-col gap-2 text-sm">
                {relationGroups.map(([label, targets]) => (
                  <div key={label} className="flex flex-wrap gap-2">
                    <dt className="font-medium text-muted-foreground">{label}:</dt>
                    <dd className="flex flex-wrap gap-2">
                      {targets.map((target, index) => (
                        <span key={target.id}>
                          {index > 0 ? "· " : null}
                          {pinnedIds.has(target.id) ? <span aria-hidden>📌</span> : null}
                          <Link href={target.href}>{target.title}</Link>
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section aria-label="Dungeons und offene Plots" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Dungeons</h3>
            {view.dungeons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Dungeons an diesem Kapitel.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {view.dungeons.map((dungeon) => (
                  <li key={dungeon.id} className="flex flex-wrap items-center gap-2">
                    <Link href={dungeon.href}>{dungeon.title}</Link>
                    <DungeonPrepStatusBadge status={dungeon.prepStatus} />
                  </li>
                ))}
              </ul>
            )}
            {openPlots?.trim() ? (
              <>
                <h3 className="mt-2 text-sm font-semibold text-muted-foreground">
                  Offene Plots
                </h3>
                <p className="whitespace-pre-line text-sm">{openPlots.trim()}</p>
              </>
            ) : null}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
