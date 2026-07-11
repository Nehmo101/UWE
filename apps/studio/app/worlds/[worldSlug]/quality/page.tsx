import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarSection, StatGrid } from "@uwe/shared-ui";
import {
  createWikiQualityService,
  getAppRepository,
  prisma,
  type InspectorSeverity,
  type WikiQualityFinding,
  type WikiQualityFindingCode,
} from "@uwe/database/server";
import { computeWikiQualityInsights } from "@uwe/database/wiki-quality";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { runBulkAutoLinkAction } from "../quality-actions";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, NavIcon } from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ linked?: string }>;
}

interface CheckGroup {
  code: WikiQualityFindingCode;
  title: string;
  emptyText: string;
}

/** Display order and labels for the maintenance checks. */
const CHECK_GROUPS: CheckGroup[] = [
  {
    code: "npc_missing_relations",
    title: "NPCs ohne Fraktion/Ort",
    emptyText: "Alle NPCs sind mit einer Fraktion oder einem Ort verknüpft.",
  },
  {
    code: "quest_missing_status",
    title: "Quests ohne Status",
    emptyText: "Alle Quests haben einen Status.",
  },
  {
    code: "duplicate_alias",
    title: "Doppelte Aliase",
    emptyText: "Keine mehrdeutigen Aliase gefunden.",
  },
  {
    code: "unlinked_term",
    title: "Unverlinkte Begriffe",
    emptyText: "Keine unverlinkten Erwähnungen bekannter Seiten.",
  },
  {
    code: "thin_page",
    title: "Seiten mit zu wenig Inhalt",
    emptyText: "Keine fast leeren Seiten.",
  },
  {
    code: "location_missing_map",
    title: "Orte ohne Karte",
    emptyText: "Alle Orte haben eine verknüpfte Karte.",
  },
];

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

function FindingList({ findings, emptyText }: { findings: WikiQualityFinding[]; emptyText: string }) {
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
        </li>
      ))}
    </ul>
  );
}

export default async function WorldQualityPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { linked } = await searchParams;
  const linkedCount = linked !== undefined ? Number.parseInt(linked, 10) : null;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const report = await createWikiQualityService(prisma).inspectWorld(worldSlug);
  if (!report) notFound();

  const insights = computeWikiQualityInsights(worldSlug, report);

  const byCode = new Map<WikiQualityFindingCode, WikiQualityFinding[]>();
  for (const finding of report.findings) {
    const bucket = byCode.get(finding.code);
    if (bucket) bucket.push(finding);
    else byCode.set(finding.code, [finding]);
  }

  const warningCount = report.findings.filter((f) => f.severity === "warning").length;
  const openTotal = report.findings.length;

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Wiki-Pflege",
            `/worlds/${worldSlug}/quality`,
          )}
        />
      }
      contextPanel={
        <SidebarSection title="Pflege">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href={`/worlds/${worldSlug}/inspector`}>Freigaben / Kanon (Inspektor) →</Link>
            </li>
            <li>
              <Link href={`/worlds/${worldSlug}/import`}>Auto-Verlinkung / Import →</Link>
            </li>
            <li>
              <Link href={`/worlds/${worldSlug}/open-items`}>Was ist offen? →</Link>
            </li>
          </ul>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Wiki-Aufräumzentrale"
        summary="Pflege-Cockpit: findet unverlinkte Begriffe, dünne Seiten, NPCs ohne Fraktion/Ort, Orte ohne Karte, Quests ohne Status und mehrdeutige Aliase. Alles read-only — die Fundstellen verlinken direkt auf die betroffene Seite."
      />

      {linkedCount !== null && !Number.isNaN(linkedCount) ? (
        <OkNote>
          {linkedCount > 0
            ? `${linkedCount} Verlinkung(en) ergänzt — rückgängig machbar über die Auto-Verlinkung.`
            : "Keine unverlinkten Begriffe gefunden — nichts zu tun."}
        </OkNote>
      ) : null}

      <StatGrid
        stats={[
          { label: "Pflege-Score", value: `${insights.score}/100` },
          { label: "Bewertung", value: insights.grade },
          { label: "Offene Punkte", value: openTotal },
          { label: "Warnungen", value: warningCount },
        ]}
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Score-Erklärung</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{insights.explanation}</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              <li>Unverlinkte Begriffe: −2 Punkte je Fundstelle</li>
              <li>Dünne Seiten: −3 · NPCs ohne Ort/Fraktion: −4 · Quests ohne Status: −4</li>
              <li>Orte ohne Karte: −3 · Mehrdeutige Aliase: −5</li>
            </ul>
          </CardContent>
        </Card>

        {insights.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Empfohlene nächste Schritte</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex list-none flex-col gap-3">
                {insights.recommendations.map((item) => (
                  <li key={item.priority} className="text-sm">
                    <strong>
                      {item.priority}. {item.title}
                    </strong>
                    <p className="mt-1 text-muted-foreground">
                      {item.description}
                      {item.href ? (
                        <>
                          {" "}
                          <Link href={item.href}>Jetzt bearbeiten →</Link>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {CHECK_GROUPS.map((group) => (
          <Card key={group.code}>
            <CardHeader>
              <CardTitle>
                {group.title}
                {report.counts[group.code] > 0 ? ` (${report.counts[group.code]})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FindingList findings={byCode.get(group.code) ?? []} emptyText={group.emptyText} />
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Bulk-Auto-Link</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Verlinkt alle unverlinkten Begriffe der Welt in einem Durchgang (nur
              Auto-Verlinkung, keine Struktur-Änderung). Der Vorgang wird protokolliert
              und ist über die Auto-Verlinkung rückgängig machbar.
            </p>
            <form action={runBulkAutoLinkAction}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <Button type="submit">Alle unverlinkten Begriffe automatisch verlinken</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Tipp: Unverlinkte Begriffe lassen sich gebündelt über die{" "}
              <Link href={`/worlds/${worldSlug}/import`}>Auto-Verlinkung</Link> mit Vorschau und
              Undo beheben. Portal-Leaks und Kanon-Konflikte prüft der{" "}
              <Link href={`/worlds/${worldSlug}/inspector`}>Inspektor</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </WorldShell>
  );
}
