import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  EmptyState,
  GlobalSearchForm,
  PageHeader,
  SidebarNav,
  SidebarSection,
  StatGrid,
  TopBarBrand,
  VisibilityBadge,
  ASSET_TYPE_LABELS,
} from "@uwe/shared-ui";
import {
  createWorldInspectorService,
  getAppRepository,
  prisma,
  type InspectorFinding,
  type InspectorSeverity,
} from "@uwe/database/server";
import { worldNavItems } from "@/src/lib/world-nav";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

const SEVERITY_LABELS: Record<InspectorSeverity, string> = {
  critical: "Kritisch",
  warning: "Warnung",
  info: "Hinweis",
};

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function FindingList({ findings, emptyText }: { findings: InspectorFinding[]; emptyText: string }) {
  if (findings.length === 0) {
    return <p className="uwe-inspector-ok">✓ {emptyText}</p>;
  }

  return (
    <ul className="uwe-inspector-findings">
      {findings.map((finding, index) => (
        <li key={`${finding.code}-${index}`} data-severity={finding.severity}>
          <span className="uwe-inspector-severity">{SEVERITY_LABELS[finding.severity]}</span>
          <span className="uwe-inspector-message">
            {finding.href ? <Link href={finding.href}>{finding.message}</Link> : finding.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function WorldInspectorPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const report = await createWorldInspectorService(prisma).inspectWorld(worldSlug);
  if (!report) notFound();

  const criticalCount =
    report.safetyFindings.filter((f) => f.severity === "critical").length +
    report.canonFindings.filter((f) => f.severity === "critical").length;
  const warningCount =
    report.safetyFindings.filter((f) => f.severity === "warning").length +
    report.canonFindings.filter((f) => f.severity === "warning").length;
  const activeShareLinks = report.shareLinks.filter((link) => link.active);

  return (
    <AppShell
      topBar={
        <>
          <TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />
          <GlobalSearchForm
            action={`/worlds/${worldSlug}`}
            query=""
            placeholder="In dieser Welt suchen…"
          />
        </>
      }
      sidebar={
        <SidebarSection title="Welt">
          <SidebarNav items={[{ label: "← Dashboard", href: "/" }, ...worldNavItems(worldSlug, "inspector")]} />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Inspektor" },
            ]}
          />

          <PageHeader
            title="Inspektor"
            summary="Prüft, was Spieler wirklich sehen — und wo deine Welt Widersprüche oder tote Links hat."
          />

          <StatGrid
            stats={[
              { label: "Kritisch", value: criticalCount },
              { label: "Warnungen", value: warningCount },
              { label: "Sichtbare Seiten", value: report.visiblePages.length },
              { label: "Aktive Share-Links", value: activeShareLinks.length },
            ]}
          />

          <section className="uwe-section">
            <h2 className="uwe-section-title">Portal-Sicherheit</h2>
            <FindingList
              findings={report.safetyFindings}
              emptyText="Keine Auffälligkeiten — DM-Inhalte bleiben verborgen."
            />
          </section>

          <section className="uwe-section">
            <h2 className="uwe-section-title">Im Portal sichtbare Seiten</h2>
            {report.visiblePages.length === 0 ? (
              <EmptyState
                title="Nichts veröffentlicht"
                description="Aktuell ist keine Seite dieser Welt im Player Portal sichtbar."
              />
            ) : (
              <table className="uwe-page-table">
                <thead>
                  <tr>
                    <th>Titel</th>
                    <th>Sichtbarkeit</th>
                    <th>Sichtbare Blöcke</th>
                    <th>Gefilterte Blöcke</th>
                  </tr>
                </thead>
                <tbody>
                  {report.visiblePages.map((page) => (
                    <tr key={page.href}>
                      <td><Link href={page.href}>{page.title}</Link></td>
                      <td><VisibilityBadge visibility={page.visibility} /></td>
                      <td>{page.visibleBlockCount}</td>
                      <td>{page.hiddenBlockCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="uwe-section">
            <h2 className="uwe-section-title">Share-Links</h2>
            {report.shareLinks.length === 0 ? (
              <p className="uwe-inspector-ok">✓ Keine Share-Links vorhanden.</p>
            ) : (
              <table className="uwe-page-table">
                <thead>
                  <tr>
                    <th>Ziel</th>
                    <th>Status</th>
                    <th>Passwort</th>
                    <th>Ablauf</th>
                  </tr>
                </thead>
                <tbody>
                  {report.shareLinks.map((link) => (
                    <tr key={link.id}>
                      <td>{link.targetTitle}</td>
                      <td>{link.active ? "Aktiv" : "Inaktiv"}</td>
                      <td>{link.hasPassword ? "Ja" : "Nein"}</td>
                      <td>{link.expiresAt ? DATE_FORMAT.format(link.expiresAt) : "Nie"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="uwe-section">
            <h2 className="uwe-section-title">Sichtbare Assets</h2>
            {report.visibleAssets.length === 0 ? (
              <p className="uwe-inspector-ok">
                ✓ Keine Assets im Portal sichtbar ({report.dmOnlyAssetCount} DM-only).
              </p>
            ) : (
              <ul className="uwe-inspector-assets">
                {report.visibleAssets.map((asset, index) => (
                  <li key={`${asset.title}-${index}`}>
                    {asset.title}{" "}
                    <span className="uwe-dashboard-muted">({ASSET_TYPE_LABELS[asset.type]})</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="uwe-section">
            <h2 className="uwe-section-title">Kanon-Warnungen</h2>
            <FindingList
              findings={report.canonFindings}
              emptyText="Keine Widersprüche, toten Links oder Duplikate gefunden."
            />
          </section>
        </>
      }
      context={
        <SidebarSection title="Portal-Konfiguration">
          <ul className="uwe-sidebar-links">
            <li>
              Portal: <strong>{report.portal.portalEnabled ? "aktiv" : "deaktiviert"}</strong>
            </li>
            <li>
              Öffentliches Teilen:{" "}
              <strong>{report.portal.publicSharingEnabled ? "an" : "aus"}</strong>
            </li>
            <li>
              Gastmodus: <strong>{report.portal.guestModeEnabled ? "an" : "aus"}</strong>
            </li>
            <li>
              <Link href="/settings">Einstellungen öffnen →</Link>
            </li>
          </ul>
        </SidebarSection>
      }
    />
  );
}
