"use client";

import Link from "next/link";
import {
  EmptyState,
  GAME_SESSION_STATUS_LABELS,
  LayoutEditToolbar,
  LayoutEditorProvider,
  PageTypeBadge,
  PublishBadge,
  SortableWidgetGrid,
  useDashboardLayout,
  VisibilityBadge,
  WorldCockpitCard,
  WorldCockpitHeader,
  WorldCockpitTabs,
  WorldCockpitTag,
} from "@uwe/shared-ui";
import { studioWorldDashboardPageKey, type DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import type { GameSessionStatus, PageType, PublishStatus, Visibility } from "@uwe/database/enums";
import { buildPageUrl } from "@uwe/database/page-types";

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
  overview: {
    counts: {
      pages: number;
      campaigns: number;
      drafts: number;
      assets: number;
      gameSessions: number;
      byCategory: { npcs: number; orte: number };
    };
    portal: {
      portalEnabled: boolean;
      visiblePageCount: number;
      activeShareLinkCount: number;
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
      publishStatus: PublishStatus;
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
  overview,
}: WorldDashboardClientProps) {
  const pageKey = studioWorldDashboardPageKey(worldSlug);
  const layout = useDashboardLayout({ pageKey });

  const renderWidget = (widget: DashboardWidgetConfig) => {
    switch (widget.widgetType) {
      case "next-session":
        return (
          <WorldCockpitCard title="Nächste Session">
            {overview.nextSession ? (
              <>
                <p className="uwe-dashboard-highlight">
                  <Link href={`/worlds/${worldSlug}/sessions/${overview.nextSession.id}`}>
                    #{overview.nextSession.sessionNumber} — {overview.nextSession.title}
                  </Link>
                </p>
                <p className="uwe-dashboard-muted">
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
                  <Link className="uwe-v2-btn uwe-v2-btn-primary" href={`/worlds/${worldSlug}/sessions/new`}>
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
              <p className="uwe-dashboard-muted">
                Keine offenen Plots notiert. Pflege sie in deinen Sessions unter „Offene Plots“.
              </p>
            ) : (
              <ul className="uwe-dashboard-list">
                {overview.openPlots.map((plot) => (
                  <li key={plot.sessionId}>
                    <Link href={`/worlds/${worldSlug}/sessions/${plot.sessionId}`}>
                      Session #{plot.sessionNumber}
                    </Link>
                    <p>{plot.openPlots}</p>
                  </li>
                ))}
              </ul>
            )}
          </WorldCockpitCard>
        );
      case "wiki-pages":
        return (
          <WorldCockpitCard title="Wiki & Seiten">
            <p className="uwe-cockpit-stat-line">
              <strong>{overview.counts.pages}</strong> Seiten gesamt
            </p>
            <p className="uwe-dashboard-muted">
              {overview.counts.byCategory.npcs} NPCs · {overview.counts.byCategory.orte} Orte ·{" "}
              {overview.counts.drafts} Entwürfe
            </p>
            <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={`/worlds/${worldSlug}`}>
              Seitenliste →
            </Link>
          </WorldCockpitCard>
        );
      case "portal-sharing":
        return (
          <WorldCockpitCard title="Portal & Sharing">
            <p className="uwe-cockpit-stat-line">
              <strong>{overview.portal.visiblePageCount}</strong> sichtbare Seiten
            </p>
            <p className="uwe-dashboard-muted">
              {overview.portal.activeShareLinkCount} Share-Links · Portal{" "}
              {overview.portal.portalEnabled ? "aktiv" : "aus"}
            </p>
            <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={`/worlds/${worldSlug}/inspector`}>
              Inspektor →
            </Link>
          </WorldCockpitCard>
        );
      case "media-assets":
        return (
          <WorldCockpitCard title="Medien & Assets">
            <p className="uwe-cockpit-stat-line">
              <strong>{overview.counts.assets}</strong> Assets
            </p>
            <p className="uwe-dashboard-muted">Karten, Handouts und Uploads für diese Welt.</p>
            <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={`/worlds/${worldSlug}/assets`}>
              Medien öffnen →
            </Link>
          </WorldCockpitCard>
        );
      case "ai-brain":
        return (
          <WorldCockpitCard title="KI & Brain">
            <p className="uwe-cockpit-stat-line">
              <strong>{overview.counts.gameSessions}</strong> Sessions
            </p>
            <p className="uwe-dashboard-muted">Brain Store, KI-Läufe und Generator-Werkzeuge.</p>
            <div className="uwe-cockpit-card-actions">
              <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={`/worlds/${worldSlug}/brain`}>
                Brain →
              </Link>
              <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={`/worlds/${worldSlug}/ai-runs`}>
                KI-Läufe →
              </Link>
            </div>
          </WorldCockpitCard>
        );
      case "recent-pages":
        if (overview.recentPages.length === 0) return null;
        return (
          <section className="uwe-v2-card uwe-v2-card-padded uwe-cockpit-recent">
            <h2 className="uwe-v2-section-title">Zuletzt bearbeitet</h2>
            <table className="uwe-page-table">
              <thead>
                <tr>
                  <th>Titel</th>
                  <th>Typ</th>
                  <th>Sichtbarkeit</th>
                  <th>Publish</th>
                  <th>Geändert</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentPages.map((page) => (
                  <tr key={page.id}>
                    <td>
                      <Link href={buildPageUrl(worldSlug, page.type, page.slug)}>{page.title}</Link>
                    </td>
                    <td>
                      <PageTypeBadge type={page.type} />
                    </td>
                    <td>
                      <VisibilityBadge visibility={page.visibility} />
                    </td>
                    <td>
                      <PublishBadge status={page.publishStatus} />
                    </td>
                    <td className="uwe-dashboard-muted">
                      {RELATIVE_FORMAT.format(new Date(page.updatedAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      default:
        return null;
    }
  };

  if (layout.loading && layout.widgets.length === 0) {
    return <p className="uwe-dashboard-muted">Dashboard-Layout wird geladen…</p>;
  }

  return (
    <div className="uwe-v2-dashboard">
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
          <Link className="uwe-v2-btn uwe-v2-btn-primary" href={`/worlds/${worldSlug}/pages/new`}>
            Seite erstellen
          </Link>
        }
      />

      <WorldCockpitTabs items={cockpitTabs} />

      <LayoutEditorProvider initialWidgets={layout.widgets}>
        <LayoutEditToolbar
          onApply={async (widgets) => {
            await layout.save(widgets);
          }}
          saving={layout.saving}
          error={layout.error}
        />
        <SortableWidgetGrid renderWidget={renderWidget} />
      </LayoutEditorProvider>
    </div>
  );
}
