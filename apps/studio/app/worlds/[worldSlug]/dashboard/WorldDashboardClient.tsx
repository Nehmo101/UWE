"use client";

import { worldWikiPath } from "@/src/lib/world-last-route";
import Link from "next/link";
import {
  EmptyState,
  GAME_SESSION_STATUS_LABELS,
  DashboardWidgetGrid,
  PageTypeBadge,
  VisibilityBadge,
  WorldCockpitCard,
  WorldCockpitHeader,
  WorldCockpitTabs,
  WorldCockpitTag,
} from "@uwe/shared-ui";
import { type DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import type { GameSessionStatus, PageType, Visibility } from "@uwe/database/enums";
import { buildPageUrl } from "@uwe/database/page-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  buttonVariants,
  cn,
} from "@/src/components/ui";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

type CockpitTabItem = {
  key: string;
  label: string;
  href: string;
  active?: boolean;
};

export interface WorldDashboardClientProps {
  worldSlug: string;
  worldName: string;
  worldDescription: string | null;
  cockpitTabs: CockpitTabItem[];
  widgets: DashboardWidgetConfig[];
  overview: {
    counts: {
      pages: number;
      campaigns: number;
      assets: number;
      gameSessions: number;
      byCategory: { npcs: number; orte: number };
    };
    portal: {
      portalEnabled: boolean;
      visiblePageCount: number;
    };
    world: { guestModeEnabled: boolean };
    nextSession: {
      id: string;
      sessionNumber: number;
      title: string;
      date: string | null;
      status: GameSessionStatus;
    } | null;
    openPlots: Array<{
      sessionId: string;
      sessionNumber: number;
      openPlots: string;
    }>;
    recentPages: Array<{
      id: string;
      title: string;
      slug: string;
      type: PageType;
      visibility: Visibility;
      updatedAt: string;
    }>;
  };
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "full" });
const RELATIVE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function WorldDashboardClient({
  worldSlug,
  worldName,
  worldDescription,
  cockpitTabs,
  widgets,
  overview,
}: WorldDashboardClientProps) {

  const renderWidget = (widget: DashboardWidgetConfig) => {
    switch (widget.widgetType) {
      case "next-session":
        return (
          <WorldCockpitCard title="Nächste Session">
            {overview.nextSession ? (
              <>
                <p className="text-base font-semibold">
                  <Link href={`/worlds/${worldSlug}/sessions/${overview.nextSession.id}`}>
                    #{overview.nextSession.sessionNumber} — {overview.nextSession.title}
                  </Link>
                </p>
                <p className="text-sm text-muted-foreground">
                  {overview.nextSession.date
                    ? DATE_FORMAT.format(new Date(overview.nextSession.date))
                    : "Noch kein Termin"}{" "}
                  · {GAME_SESSION_STATUS_LABELS[overview.nextSession.status]}
                </p>
              </>
            ) : (
              <EmptyState
                title="Keine Session geplant"
                action={
                  <Link
                    className={cn(buttonVariants({ variant: "default" }))}
                    href={`/worlds/${worldSlug}/sessions/new`}
                  >
                    Session planen
                  </Link>
                }
              />
            )}
          </WorldCockpitCard>
        );
      case "open-plots":
        return (
          <WorldCockpitCard title="Offene Plots">
            {overview.openPlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine offenen Plots notiert. Pflege sie in deinen Sessions unter „Offene Plots“.
              </p>
            ) : (
              <ul className="flex list-none flex-col gap-3 p-0">
                {overview.openPlots.map((plot) => (
                  <li key={plot.sessionId}>
                    <Link className="text-sm" href={`/worlds/${worldSlug}/sessions/${plot.sessionId}`}>
                      Session #{plot.sessionNumber}
                    </Link>
                    <p className="mt-1 whitespace-pre-line text-sm">{plot.openPlots}</p>
                  </li>
                ))}
              </ul>
            )}
          </WorldCockpitCard>
        );
      case "wiki-pages":
        return (
          <WorldCockpitCard title="Wiki & Seiten">
            <p className="text-base">
              <strong>{overview.counts.pages}</strong> Seiten gesamt
            </p>
            <p className="text-sm text-muted-foreground">
              {overview.counts.byCategory.npcs} NPCs · {overview.counts.byCategory.orte} Orte
            </p>
            <Link className={cn(buttonVariants({ variant: "ghost" }))} href={worldWikiPath(worldSlug)}>
              Seitenliste →
            </Link>
          </WorldCockpitCard>
        );
      case "portal-sharing":
        return (
          <WorldCockpitCard title="Portal & Sharing">
            <p className="text-base">
              <strong>{overview.portal.visiblePageCount}</strong> sichtbare Seiten
            </p>
            <p className="text-sm text-muted-foreground">
              Portal{" "}
              {overview.portal.portalEnabled ? "aktiv" : "aus"}
            </p>
            <Link className={cn(buttonVariants({ variant: "ghost" }))} href={`/worlds/${worldSlug}/inspector`}>
              Inspektor →
            </Link>
          </WorldCockpitCard>
        );
      case "media-assets":
        return (
          <WorldCockpitCard title="Medien & Assets">
            <p className="text-base">
              <strong>{overview.counts.assets}</strong> Assets
            </p>
            <p className="text-sm text-muted-foreground">Karten, Handouts und Uploads für diese Welt.</p>
            <Link className={cn(buttonVariants({ variant: "ghost" }))} href={`/worlds/${worldSlug}/assets`}>
              Medien öffnen →
            </Link>
          </WorldCockpitCard>
        );
      case "ai-brain":
        return (
          <WorldCockpitCard title="KI & Brain">
            <p className="text-base">
              <strong>{overview.counts.gameSessions}</strong> Sessions
            </p>
            <p className="text-sm text-muted-foreground">Brain Store, KI-Läufe und Generator-Werkzeuge.</p>
            <div className="flex flex-wrap gap-1.5">
              <Link className={cn(buttonVariants({ variant: "ghost" }))} href={`/worlds/${worldSlug}/brain`}>
                Brain →
              </Link>
              <Link className={cn(buttonVariants({ variant: "ghost" }))} href={`/worlds/${worldSlug}/ai-runs`}>
                KI-Läufe →
              </Link>
            </div>
          </WorldCockpitCard>
        );
      case "recent-pages":
        return (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Zuletzt bearbeitet</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.recentPages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine kürzlichen Wiki-Änderungen.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={TH_CLASS}>Titel</th>
                        <th className={TH_CLASS}>Typ</th>
                        <th className={TH_CLASS}>Sichtbarkeit</th>
                        <th className={TH_CLASS}>Publish</th>
                        <th className={TH_CLASS}>Geändert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.recentPages.map((page) => (
                        <tr key={page.id}>
                          <td className={TD_CLASS}>
                            <Link href={buildPageUrl(worldSlug, page.type, page.slug)}>{page.title}</Link>
                          </td>
                          <td className={TD_CLASS}>
                            <PageTypeBadge type={page.type} />
                          </td>
                          <td className={TD_CLASS}>
                            <VisibilityBadge visibility={page.visibility} />
                          </td>
                          <td className={TD_CLASS}>
                          </td>
                          <td className={cn(TD_CLASS, "text-muted-foreground")}>
                            {RELATIVE_FORMAT.format(new Date(page.updatedAt))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  const secondaryWidgets = widgets.filter(
    (widget) => !["next-session", "open-plots", "recent-pages"].includes(widget.widgetType),
  );

  return (
    <div className="flex flex-col gap-6">
      <WorldCockpitHeader
        title={worldName}
        summary={worldDescription}
        tags={
          <>
            <WorldCockpitTag variant="accent">Welt-Cockpit</WorldCockpitTag>
            <WorldCockpitTag>{overview.counts.pages} Seiten</WorldCockpitTag>
            <WorldCockpitTag>{overview.counts.campaigns} Kampagnen</WorldCockpitTag>
            <WorldCockpitTag variant="muted">
              {overview.portal.visiblePageCount} im Portal
            </WorldCockpitTag>
          </>
        }
        actions={
          <Link className={cn(buttonVariants({ variant: "default" }))} href={`/worlds/${worldSlug}/pages/new`}>
            Seite erstellen
          </Link>
        }
      />

      <WorldCockpitTabs items={cockpitTabs} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Priorität">
        {renderWidget({ id: "hero-next-session", widgetType: "next-session", order: 0, column: 1, visible: true })}
        {renderWidget({ id: "hero-open-plots", widgetType: "open-plots", order: 1, column: 2, visible: true })}
        {renderWidget({ id: "hero-recent-pages", widgetType: "recent-pages", order: 2, column: 3, visible: true })}
      </section>

      <DashboardWidgetGrid widgets={secondaryWidgets} renderWidget={renderWidget} />
    </div>
  );
}
