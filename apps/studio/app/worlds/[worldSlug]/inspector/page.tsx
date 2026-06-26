import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EmptyState,
  SidebarSection,
  StatGrid,
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
import { WorldModuleShell } from "@/components/WorldModuleShell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { applyInspectorFixAction } from "../../../inspector-actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ fixApplied?: string; fixError?: string }>;
}

const SEVERITY_LABELS: Record<InspectorSeverity, string> = {
  critical: "Kritisch",
  warning: "Warnung",
  info: "Hinweis",
};

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function FindingList({
  findings,
  emptyText,
  worldSlug,
}: {
  findings: InspectorFinding[];
  emptyText: string;
  worldSlug: string;
}) {
  if (findings.length === 0) {
    return <p className="uwe-inspector-ok">✓ {emptyText}</p>;
  }

  return (
    <ul className="uwe-inspector-findings">
      {findings.map((finding) => (
        <li key={finding.id} data-severity={finding.severity}>
          <span className="uwe-inspector-severity">{SEVERITY_LABELS[finding.severity]}</span>
          <span className="uwe-inspector-message">
            {finding.href ? <Link href={finding.href}>{finding.message}</Link> : finding.message}
          </span>
          {finding.fixes.length > 0 && (
            <span className="uwe-inspector-fixes">
              {finding.fixes.map((fix) => (
                <form
                  key={fix.action}
                  action={applyInspectorFixAction}
                  style={{ display: "inline" }}
                >
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="fixAction" value={fix.action} />
                  {finding.pageId && (
                    <input type="hidden" name="pageId" value={finding.pageId} />
                  )}
                  {finding.blockId && (
                    <input type="hidden" name="blockId" value={finding.blockId} />
                  )}
                  {finding.linkTarget && (
                    <input type="hidden" name="linkTarget" value={finding.linkTarget} />
                  )}
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                    {fix.label}
                  </button>
                </form>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function WorldInspectorPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { fixApplied, fixError } = await searchParams;
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
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="inspector"
      contextTitle="Inspektor-Hilfe"
      breadcrumb={worldSectionBreadcrumb(world.name, worldSlug, "Kanon & Leaks", `/worlds/${worldSlug}/inspector`)}
      pageHeader={{
        title: "Inspektor",
        summary: "Prüft, was Spieler wirklich sehen — und wo deine Welt Widersprüche oder tote Links hat. Fix-Aktionen sind rückgängig machbar (siehe Activity Log).",
      }}
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
    >
      {fixApplied && (
        <p className="uwe-inspector-ok" role="status">✓ {fixApplied}</p>
      )}
      {fixError && (
        <p className="uwe-form-error" role="alert">Fix fehlgeschlagen: {fixError}</p>
      )}

      <StatGrid
        stats={[
          { label: "Kritisch", value: criticalCount },
          { label: "Warnungen", value: warningCount },
          { label: "Sichtbare Seiten", value: report.visiblePages.length },
          { label: "Aktive Share-Links", value: activeShareLinks.length },
        ]}
      />

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Portal-Sicherheit</h2>
        <FindingList
          findings={report.safetyFindings}
          emptyText="Keine Auffälligkeiten — DM-Inhalte bleiben verborgen."
          worldSlug={worldSlug}
        />
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Im Portal sichtbare Seiten</h2>
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

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Share-Links</h2>
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

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Sichtbare Assets</h2>
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

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Kanon-Warnungen</h2>
        <FindingList
          findings={report.canonFindings}
          emptyText="Keine Widersprüche, toten Links oder Duplikate gefunden."
          worldSlug={worldSlug}
        />
      </section>
    </WorldModuleShell>
  );
}
