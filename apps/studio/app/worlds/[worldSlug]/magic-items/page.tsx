import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppRepository, prisma } from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function MagicItemsPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const items = await prisma.page.findMany({
    where: { worldId: world.id, type: "item" },
    select: { id: true, title: true, structuredItem: { select: { id: true } } },
    orderBy: { title: "asc" },
  });

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Magic-Item-Werkbank",
            `/worlds/${worldSlug}/magic-items`,
          )}
        />
      }
    >
      <PageHeader
        title="Magic-Item-Werkbank"
        summary="Strukturierte magische Gegenstände: sichtbare Beschreibung vs. DM-Geheimnis, Fluch, Einstimmung, Seltenheit — mit Export für Homebrewery/5e.tools und Spieler-Handout."
      />

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Item-Seiten</h2>
        {items.length === 0 ? (
          <p className="uwe-dashboard-muted">
            Keine Item-Seiten in dieser Welt. Lege im Wiki eine Seite vom Typ „Item“ an.
          </p>
        ) : (
          <ul className="uwe-linked-list">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/worlds/${worldSlug}/magic-items/${item.id}`}>{item.title}</Link>
                {item.structuredItem ? <span className="uwe-badge"> Werkbank</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorldShell>
  );
}
