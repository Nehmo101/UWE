import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createLabelService,
  createPrintListService,
  getAppRepository,
  LABEL_PRINT_STATUS_LABELS,
  PRINT_CENTER_TEMPLATE_SLUGS,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PrintCenterPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();
  const labelService = createLabelService();
  const printListService = createPrintListService();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const [labels, templates, printLists] = await Promise.all([
    labelService.listLabelsByWorld(worldSlug),
    labelService.listTemplates(world.id),
    printListService.listByWorld(worldSlug),
  ]);

  const systemTemplates = templates.filter((template) => template.isSystem || !template.worldId);
  const featuredSlugs = new Set<string>(Object.values(PRINT_CENTER_TEMPLATE_SLUGS));
  const featuredTemplates = systemTemplates.filter((template) => featuredSlugs.has(template.slug));

  const openPrintLists = printLists.filter((list) => list.status === "open");

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Print Center",
            `/worlds/${worldSlug}/print-center`,
          )}
        />
      }
    >
      <PageHeader
        title="Print Center"
        summary="6×4 Handouts, NPC- und Item-Karten, Drucklisten und Label-Vorlagen — zentral für die Session."
        actions={
          <Link href={`/worlds/${worldSlug}/labels/new`} className="uwe-v2-btn uwe-v2-btn-primary">
            Neues Label
          </Link>
        }
      />

      <section className="uwe-stat-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="uwe-stat-card">
          <span className="uwe-stat-value">{labels.length}</span>
          <span className="uwe-stat-label">Labels</span>
        </div>
        <div className="uwe-stat-card">
          <span className="uwe-stat-value">{openPrintLists.length}</span>
          <span className="uwe-stat-label">Offene Drucklisten</span>
        </div>
        <div className="uwe-stat-card">
          <span className="uwe-stat-value">{featuredTemplates.length}</span>
          <span className="uwe-stat-label">Karten-Vorlagen</span>
        </div>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Schnellaktionen</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
          <Link className="uwe-v2-btn" href={`/worlds/${worldSlug}/labels`}>
            Label-Bibliothek
          </Link>
          <Link className="uwe-v2-btn" href={`/worlds/${worldSlug}/labels?tab=print-lists`}>
            Drucklisten
          </Link>
          <Link className="uwe-v2-btn" href={`/worlds/${worldSlug}/labels?tab=templates`}>
            Alle Vorlagen
          </Link>
          <Link className="uwe-v2-btn" href={`/worlds/${worldSlug}/prepare-session`}>
            Session vorbereiten
          </Link>
        </div>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Karten-Vorlagen (NPC / Item / Handout)</h2>
        {featuredTemplates.length === 0 ? (
          <p className="uwe-v2-empty">Keine Print-Center-Vorlagen gefunden — Migration prüfen.</p>
        ) : (
          <ul className="uwe-list-cards">
            {featuredTemplates.map((template) => (
              <li key={template.id} className="uwe-list-card">
                <strong>{template.name}</strong>
                <p className="uwe-dashboard-muted">{template.description ?? template.slug}</p>
                <Link href={`/worlds/${worldSlug}/labels/new?template=${template.slug}`}>
                  Label mit Vorlage erstellen →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Offene Drucklisten</h2>
        {openPrintLists.length === 0 ? (
          <p className="uwe-v2-empty">
            Keine offenen Drucklisten. Erstelle eine aus einer Session oder unter Labels.
          </p>
        ) : (
          <ul className="uwe-list-cards">
            {openPrintLists.slice(0, 8).map((list) => (
              <li key={list.id} className="uwe-list-card">
                <strong>{list.name}</strong>
                <span className="uwe-badge">{LABEL_PRINT_STATUS_LABELS[list.status]}</span>
                {list.forNextSession ? (
                  <span className="uwe-badge uwe-badge-player">Nächste Session</span>
                ) : null}
                <Link href={`/worlds/${worldSlug}/labels/print-lists/${list.id}`}>Öffnen →</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorldShell>
  );
}
