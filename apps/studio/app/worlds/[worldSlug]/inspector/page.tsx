import Link from "next/link";
import { notFound } from "next/navigation";
import {
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
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { applyInspectorFixAction } from "../../../inspector-actions";
import { InspectorDiagnosePanel } from "@/components/InspectorDiagnosePanel";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  NavIcon,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ fixApplied?: string; fixError?: string }>;
}

const SEVERITY_LABELS: Record<InspectorSeverity, string> = {
  critical: "Kritisch",
  warning: "Warnung",
  info: "Hinweis",
};

const SEVERITY_BADGE_VARIANT: Record<InspectorSeverity, "danger" | "warning" | "info"> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2";

function OkNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-success">
      <NavIcon name="check" width={16} height={16} />
      <span>{children}</span>
    </p>
  );
}

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
    return <OkNote>{emptyText}</OkNote>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {findings.map((finding) => (
        <li
          key={finding.id}
          className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-border p-3 text-sm"
        >
          <Badge variant={SEVERITY_BADGE_VARIANT[finding.severity]}>
            {SEVERITY_LABELS[finding.severity]}
          </Badge>
          <span className="min-w-0 flex-1">
            {finding.href ? <Link href={finding.href}>{finding.message}</Link> : finding.message}
          </span>
          {finding.fixes.length > 0 && (
            <span className="flex flex-wrap gap-2">
              {finding.fixes.map((fix) => (
                <form key={fix.action} action={applyInspectorFixAction} className="inline-flex">
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
                  <Button type="submit" variant="outline" size="sm">
                    {fix.label}
                  </Button>
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
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Kanon & Leaks", `/worlds/${worldSlug}/inspector`)}
        />
      }
      contextPanel={
        <SidebarSection title="Portal-Konfiguration">
          <ul className="flex flex-col gap-2 text-sm">
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
      <PageHeader
        title="Inspektor"
        summary="Prüft Spieler-Leaks und Kanon-Konflikte — inkl. veralteter Portal-Inhalte, NPC-Tod vs. Sichtbarkeit und welt-spezifischer Regeln."
      />
      {fixApplied && <OkNote>{fixApplied}</OkNote>}
      {fixError && (
        <p role="alert" className="text-sm text-destructive">
          Fix fehlgeschlagen: {fixError}
        </p>
      )}

      <StatGrid
        stats={[
          { label: "Kritisch", value: criticalCount },
          { label: "Warnungen", value: warningCount },
          { label: "Sichtbare Seiten", value: report.visiblePages.length },
          { label: "Aktive Share-Links", value: activeShareLinks.length },
        ]}
      />

      <InspectorDiagnosePanel worldSlug={worldSlug} />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Portal-Sicherheit</CardTitle>
          </CardHeader>
          <CardContent>
            <FindingList
              findings={report.safetyFindings}
              emptyText="Keine Auffälligkeiten — DM-Inhalte bleiben verborgen."
              worldSlug={worldSlug}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Im Portal sichtbare Seiten</CardTitle>
          </CardHeader>
          <CardContent>
            {report.visiblePages.length === 0 ? (
              <EmptyState
                title="Nichts veröffentlicht"
                description="Aktuell ist keine Seite dieser Welt im Player Portal sichtbar."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Titel</th>
                      <th className={TH_CLASS}>Sichtbarkeit</th>
                      <th className={TH_CLASS}>Sichtbare Blöcke</th>
                      <th className={TH_CLASS}>Gefilterte Blöcke</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.visiblePages.map((page) => (
                      <tr key={page.href}>
                        <td className={TD_CLASS}>
                          <Link href={page.href}>{page.title}</Link>
                        </td>
                        <td className={TD_CLASS}>
                          <VisibilityBadge visibility={page.visibility} />
                        </td>
                        <td className={TD_CLASS}>{page.visibleBlockCount}</td>
                        <td className={TD_CLASS}>{page.hiddenBlockCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Share-Links</CardTitle>
          </CardHeader>
          <CardContent>
            {report.shareLinks.length === 0 ? (
              <OkNote>Keine Share-Links vorhanden.</OkNote>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Ziel</th>
                      <th className={TH_CLASS}>Status</th>
                      <th className={TH_CLASS}>Passwort</th>
                      <th className={TH_CLASS}>Ablauf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.shareLinks.map((link) => (
                      <tr key={link.id}>
                        <td className={TD_CLASS}>{link.targetTitle}</td>
                        <td className={TD_CLASS}>{link.active ? "Aktiv" : "Inaktiv"}</td>
                        <td className={TD_CLASS}>{link.hasPassword ? "Ja" : "Nein"}</td>
                        <td className={TD_CLASS}>
                          {link.expiresAt ? DATE_FORMAT.format(link.expiresAt) : "Nie"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sichtbare Assets</CardTitle>
          </CardHeader>
          <CardContent>
            {report.visibleAssets.length === 0 ? (
              <OkNote>
                Keine Assets im Portal sichtbar ({report.dmOnlyAssetCount} DM-only).
              </OkNote>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {report.visibleAssets.map((asset, index) => (
                  <li key={`${asset.title}-${index}`}>
                    {asset.title}{" "}
                    <span className="text-muted-foreground">({ASSET_TYPE_LABELS[asset.type]})</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kanon-Warnungen</CardTitle>
          </CardHeader>
          <CardContent>
            <FindingList
              findings={report.canonFindings}
              emptyText="Keine Widersprüche, toten Links oder Duplikate gefunden."
              worldSlug={worldSlug}
            />
          </CardContent>
        </Card>
      </div>
    </WorldShell>
  );
}
