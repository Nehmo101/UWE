import Link from "next/link";
import {
  EmptyState,
  PageTypeBadge,
  PublishBadge,
  SidebarSection,
  StatGrid,
  StudioNavSidebar,
  StudioShell,
} from "@uwe/shared-ui";
import {
  ACTIVITY_ACTION_LABELS,
  buildNextActions,
  buildPageUrl,
  createActivityLogService,
  getAppRepository,
  getProductionSafetyWarnings,
  prisma,
} from "@uwe/database/server";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { STUDIO_DASHBOARD_PATH } from "@/src/lib/routes";
import { undoActivityAction } from "../inspector-actions";

const ACTIVITY_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short",
});

interface Props {
  searchParams: Promise<{ undoApplied?: string; undoError?: string }>;
}

export default async function StudioDashboard({ searchParams }: Props) {
  const { undoApplied, undoError } = await searchParams;
  const repo = getAppRepository();
  const [stats, worlds, recentPages, activityEntries, nextActions, productionWarnings] =
    await Promise.all([
      repo.getDashboardStats(),
      repo.listWorlds(),
      repo.listRecentlyEditedPages(6),
      createActivityLogService(prisma).list({ limit: 15 }),
      buildNextActions(prisma),
      getProductionSafetyWarnings(prisma),
    ]);

  const criticalProductionWarnings = productionWarnings.filter(
    (warning) => warning.severity === "critical",
  );

  return (
    <StudioShell
      showRail
      showSearch
      railActiveId="more"
      subtitle="Dungeon Master Workspace"
      bottomNav={studioGlobalBottomNav("more")}
      contextTitle="Schnellaktionen"
      pageHeader={{
        title: "Dashboard",
        summary: "Verwalte Welten, Kampagnen und Wiki-Seiten mit vollem DM-Zugriff.",
      }}
      sidebar={
        <StudioNavSidebar
          items={[
            { label: "Dashboard", href: STUDIO_DASHBOARD_PATH, active: true },
            { label: "Welten", href: "/worlds" },
            { label: "Admin", href: "/admin" },
            { label: "Brain Store", href: "/brain" },
            { label: "Templates", href: "/templates" },
            { label: "Mail Center", href: "/mail" },
            { label: "Backup", href: "/backup" },
            { label: "Jobs", href: "/jobs" },
            { label: "Systemstatus", href: "/admin/status" },
            { label: "KI-Prompt", href: "/admin/ai-prompt" },
            { label: "Einstellungen", href: "/settings" },
            { label: "Passwort ändern", href: "/account/password" },
            { label: "Sicherheit (2FA)", href: "/account/security" },
          ]}
        />
      }
      main={
        <>
          {criticalProductionWarnings.length > 0 && (
            <div className="uwe-form-error" role="alert">
              <strong>Produktions-/Selfhosting-Warnung:</strong>
              <ul className="uwe-inspector-findings">
                {criticalProductionWarnings.map((warning) => (
                  <li key={warning.id} data-severity={warning.severity}>
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

          {undoApplied && (
            <p className="uwe-inspector-ok" role="status">✓ {undoApplied}</p>
          )}
          {undoError && (
            <p className="uwe-form-error" role="alert">Undo fehlgeschlagen: {undoError}</p>
          )}

          <StatGrid
            stats={[
              { label: "Welten", value: stats.worldCount },
              { label: "Seiten gesamt", value: stats.pageCount },
              { label: "Veröffentlicht", value: stats.publishedCount },
              { label: "Entwürfe", value: stats.draftCount },
            ]}
          />

          <section className="uwe-section">
            <h2 className="uwe-section-title">Nächste Schritte</h2>
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

          <section className="uwe-section">
            <h2 className="uwe-section-title">Activity Log</h2>
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
                      <td data-label="Zeit">{ACTIVITY_DATE_FORMAT.format(entry.createdAt)}</td>
                      <td data-label="Aktion">{ACTIVITY_ACTION_LABELS[entry.action]}</td>
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
                            <button type="submit" className="uwe-btn uwe-btn-small">
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

          {recentPages.length > 0 && (
            <section className="uwe-section">
              <h2 className="uwe-section-title">Zuletzt bearbeitet</h2>
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
                      <td data-label="Typ"><PageTypeBadge type={page.type} /></td>
                      <td data-label="Publish"><PublishBadge status={page.publishStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="uwe-section">
            <h2 className="uwe-section-title">Deine Welten</h2>
            {worlds.length === 0 ? (
              <EmptyState
                title="Noch keine Welten"
                description="Erstelle deine erste Kampagne oder führe db:seed aus, um Demo-Inhalte zu laden."
                action={
                  <Link className="uwe-btn uwe-btn-primary" href="/worlds">
                    Welten verwalten
                  </Link>
                }
              />
            ) : (
              <div className="wiki-world-grid">
                {worlds.map((world) => (
                  <article key={world.id} className="wiki-world-card uwe-card">
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
        </>
      }
      context={
        <SidebarSection title="Schnellaktionen">
          <ul className="uwe-sidebar-links">
            <li>
              <Link href="/worlds">Welten auswählen</Link>
            </li>
            <li>
              <Link href="/search">Globale Suche</Link>
            </li>
            <li>
              <Link href="/backup">Backup erstellen</Link>
            </li>
            <li>
              <Link href="/settings">Einstellungen</Link>
            </li>
          </ul>
        </SidebarSection>
      }
    />
  );
}
