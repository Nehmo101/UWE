import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarSection, StatGrid } from "@uwe/shared-ui";
import {
  createWikiQualityService,
  getAppRepository,
  prisma,
  type WikiQualityFinding,
  type WikiQualityFindingCode,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
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

function FindingList({ findings, emptyText }: { findings: WikiQualityFinding[]; emptyText: string }) {
  if (findings.length === 0) {
    return <p className="uwe-inspector-ok">✓ {emptyText}</p>;
  }

  return (
    <ul className="uwe-inspector-findings">
      {findings.map((finding) => (
        <li key={finding.id} data-severity={finding.severity}>
          <span className="uwe-inspector-message">
            {finding.href ? <Link href={finding.href}>{finding.message}</Link> : finding.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function WorldQualityPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const report = await createWikiQualityService(prisma).inspectWorld(worldSlug);
  if (!report) notFound();

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
          <ul className="uwe-sidebar-links">
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

      <StatGrid
        stats={[
          { label: "Offene Punkte", value: openTotal },
          { label: "Warnungen", value: warningCount },
          { label: "Seiten geprüft", value: report.findings.length === 0 ? "✓" : openTotal },
        ]}
      />

      {CHECK_GROUPS.map((group) => (
        <section className="uwe-v2-section" key={group.code}>
          <h2 className="uwe-v2-section-title">
            {group.title}
            {report.counts[group.code] > 0 ? ` (${report.counts[group.code]})` : ""}
          </h2>
          <FindingList findings={byCode.get(group.code) ?? []} emptyText={group.emptyText} />
        </section>
      ))}

      <section className="uwe-v2-section">
        <p className="uwe-dashboard-muted">
          Tipp: Unverlinkte Begriffe lassen sich gebündelt über die{" "}
          <Link href={`/worlds/${worldSlug}/import`}>Auto-Verlinkung</Link> mit Vorschau und
          Undo beheben. Portal-Leaks und Kanon-Konflikte prüft der{" "}
          <Link href={`/worlds/${worldSlug}/inspector`}>Inspektor</Link>.
        </p>
      </section>
    </WorldShell>
  );
}
