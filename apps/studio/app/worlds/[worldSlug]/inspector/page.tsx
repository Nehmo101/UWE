import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SidebarSection,
  StatGrid,
} from "@uwe/shared-ui";
import {
  createWorldInspectorService,
  getAppRepository,
  prisma,
  type InspectorFinding,
  type InspectorSeverity,
} from "@uwe/database/server";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
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

  const criticalCount = report.canonFindings.filter((f) => f.severity === "critical").length;
  const warningCount = report.canonFindings.filter((f) => f.severity === "warning").length;

  return (
    <>
      <ShellBreadcrumb items={worldSectionBreadcrumb(world.name, worldSlug, "Kanon", `/worlds/${worldSlug}/inspector`)} />
      <ShellContextPanel>
        <SidebarSection title="Portal-Konfiguration">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              Portal: <strong>{report.portal.portalEnabled ? "aktiv" : "deaktiviert"}</strong>
            </li>
            <li>
              Freigegeben: <strong>{report.portal.releasedPageCount}</strong> von{" "}
              {report.pageCount} Seiten
            </li>
            <li>
              <Link href="/settings">Einstellungen öffnen →</Link>
            </li>
          </ul>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title="Inspektor"
        summary="Prüft Kanon-Konflikte — tote Wikilinks, mehrdeutige Namen, widersprüchliche Seiten, Waisen und welt-spezifische Regeln."
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
          { label: "Seiten", value: report.pageCount },
          { label: "Assets", value: report.assetCount },
        ]}
      />

      <InspectorDiagnosePanel worldSlug={worldSlug} />

      <div className="flex flex-col gap-6">
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
    </>
  );
}
