"use client";

import Link from "next/link";
import {
  EmptyState,
  LayoutEditToolbar,
  LayoutEditorProvider,
  PageTypeBadge,
  PublishBadge,
  SortableWidgetGrid,
  useDashboardLayout,
} from "@uwe/shared-ui";
import { STUDIO_DASHBOARD_PAGE_KEY, type DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import type { PageType, PublishStatus } from "@uwe/database/enums";
import { buildPageUrl } from "@uwe/database/page-types";
import { undoActivityAction } from "../inspector-actions";
import { STUDIO_DASHBOARD_PATH } from "@/src/lib/routes";

const ACTIVITY_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short",
});

export interface StudioDashboardClientProps {
  stats: {
    worldCount: number;
    pageCount: number;
    publishedCount: number;
    draftCount: number;
  };
  worlds: Array<{ id: string; name: string; slug: string; description: string | null }>;
  recentPages: Array<{
    id: string;
    title: string;
    slug: string;
    type: PageType;
    publishStatus: PublishStatus;
    world: { name: string; slug: string };
  }>;
  activityEntries: Array<{
    id: string;
    createdAt: string;
    actionLabel: string;
    summary: string;
    targetHref: string | null;
    undo: { entryId: string; undoneAt: string | null } | null;
  }>;
  nextActions: Array<{
    id: string;
    title: string;
    description: string;
    href: string | null;
    severity: string;
  }>;
  criticalProductionWarnings: Array<{
    id: string;
    title: string;
    description: string;
    href: string | null;
  }>;
  undoApplied?: string;
  undoError?: string;
}

export function StudioDashboardClient({
  stats,
  worlds,
  recentPages,
  activityEntries,
  nextActions,
  criticalProductionWarnings,
  undoApplied,
  undoError,
}: StudioDashboardClientProps) {
  const layout = useDashboardLayout({ pageKey: STUDIO_DASHBOARD_PAGE_KEY });

  const renderWidget = (widget: DashboardWidgetConfig) => {
    switch (widget.widgetType) {
      case "stats":
        return (
          <div className="uwe-v2-stat-grid">
            {[
              { label: "Welten", value: stats.worldCount },
              { label: "Seiten gesamt", value: stats.pageCount },
              { label: "Veröffentlicht", value: stats.publishedCount },
              { label: "Entwürfe", value: stats.draftCount },
            ].map((stat) => (
              <div key={stat.label} className="uwe-v2-stat-card">
                <span className="uwe-v2-stat-value">{stat.value}</span>
                <span className="uwe-v2-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        );
      case "next-actions":
        return (
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Nächste Schritte</h2>
            {nextActions.length === 0 ? (
              <p className="uwe-inspector-ok">✓ Nichts offen — alles erledigt.</p>
            ) : (
              <ul className="uwe-inspector-findings">
                {nextActions.map((action) => (
                  <li key={action.id} data-severity={action.severity}>
                    <span className="uwe-inspector-message">
                      {action.href ? (
                        <Link href={action.href}>
                          <strong>{action.title}</strong>
                        </Link>
                      ) : (
                        <strong>{action.title}</strong>
                      )}{" "}
                      <span className="uwe-dashboard-muted">{action.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      case "activity-log":
        return (
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Activity Log</h2>
            {activityEntries.length === 0 ? (
              <p className="uwe-dashboard-muted">
                Noch keine Aktivitäten aufgezeichnet — Änderungen an Inhalten, Sichtbarkeit,
                Templates und Backups erscheinen hier.
              </p>
            ) : (
              <table className="uwe-page-table">
                <thead>
                  <tr>
                    <th>Zeit</th>
                    <th>Aktion</th>
                    <th>Was</th>
                    <th>Undo</th>
                  </tr>
                </thead>
                <tbody>
                  {activityEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td data-label="Zeit">
                        {ACTIVITY_DATE_FORMAT.format(new Date(entry.createdAt))}
                      </td>
                      <td data-label="Aktion">{entry.actionLabel}</td>
                      <td data-label="Was">
                        {entry.targetHref ? (
                          <Link href={entry.targetHref}>{entry.summary}</Link>
                        ) : (
                          entry.summary
                        )}
                      </td>
                      <td data-label="Undo">
                        {entry.undo && !entry.undo.undoneAt ? (
                          <form action={undoActivityAction}>
                            <input type="hidden" name="undoEntryId" value={entry.undo.entryId} />
                            <input type="hidden" name="redirectTo" value={STUDIO_DASHBOARD_PATH} />
                            <button type="submit" className="uwe-v2-btn uwe-v2-btn-sm">
                              Rückgängig
                            </button>
                          </form>
                        ) : entry.undo?.undoneAt ? (
                          <span className="uwe-dashboard-muted">rückgängig gemacht</span>
                        ) : (
                          <span className="uwe-dashboard-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      case "recent-pages":
        if (recentPages.length === 0) return null;
        return (
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Zuletzt bearbeitet</h2>
            <table className="uwe-page-table">
              <thead>
                <tr>
                  <th>Titel</th>
                  <th>Welt</th>
                  <th>Typ</th>
                  <th>Publish</th>
                </tr>
              </thead>
              <tbody>
                {recentPages.map((page) => (
                  <tr key={page.id}>
                    <td data-label="Titel">
                      <Link href={buildPageUrl(page.world.slug, page.type, page.slug)}>
                        {page.title}
                      </Link>
                    </td>
                    <td data-label="Welt">
                      <Link href={`/worlds/${page.world.slug}`}>{page.world.name}</Link>
                    </td>
                    <td data-label="Typ">
                      <PageTypeBadge type={page.type} />
                    </td>
                    <td data-label="Publish">
                      <PublishBadge status={page.publishStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      case "worlds":
        return (
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Deine Welten</h2>
            {worlds.length === 0 ? (
              <EmptyState
                title="Noch keine Welten"
                description="Erstelle deine erste Kampagne oder führe db:seed aus, um Demo-Inhalte zu laden."
                action={
                  <Link className="uwe-v2-btn uwe-v2-btn-primary" href="/worlds">
                    Welten verwalten
                  </Link>
                }
              />
            ) : (
              <div className="wiki-world-grid">
                {worlds.map((world) => (
                  <article key={world.id} className="wiki-world-card uwe-v2-card uwe-v2-card-padded">
                    <h2>{world.name}</h2>
                    {world.description && <p>{world.description}</p>}
                    <Link className="uwe-card-link" href={`/worlds/${world.slug}/dashboard`}>
                      Welt öffnen →
                    </Link>
                  </article>
                ))}
              </div>
            )}
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
      {criticalProductionWarnings.length > 0 && (
        <div className="uwe-form-error" role="alert">
          <strong>Produktions-/Selfhosting-Warnung:</strong>
          <ul className="uwe-inspector-findings">
            {criticalProductionWarnings.map((warning) => (
              <li key={warning.id} data-severity="critical">
                {warning.href ? (
                  <Link href={warning.href}>
                    <strong>{warning.title}</strong>
                  </Link>
                ) : (
                  <strong>{warning.title}</strong>
                )}{" "}
                <span className="uwe-dashboard-muted">{warning.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {undoApplied && <p className="uwe-inspector-ok" role="status">✓ {undoApplied}</p>}
      {undoError && (
        <p className="uwe-form-error" role="alert">
          Undo fehlgeschlagen: {undoError}
        </p>
      )}

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
