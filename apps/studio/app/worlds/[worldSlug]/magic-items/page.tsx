import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ITEM_RARITIES,
  ITEM_RARITY_LABELS,
  parseMagicItemData,
  type ItemRarity,
} from "@uwe/database/magic-item";
import { getAppRepository, prisma } from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ rarity?: string }>;
}

export default async function MagicItemsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { rarity: rarityFilter } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const activeRarity =
    rarityFilter && ITEM_RARITIES.includes(rarityFilter as ItemRarity)
      ? (rarityFilter as ItemRarity)
      : undefined;

  const rows = await prisma.page.findMany({
    where: { worldId: world.id, type: "item" },
    select: {
      id: true,
      title: true,
      structuredItem: { select: { data: true } },
    },
    orderBy: { title: "asc" },
  });

  const items = rows
    .map((row) => {
      const data = row.structuredItem ? parseMagicItemData(row.structuredItem.data) : {};
      return {
        id: row.id,
        title: row.title,
        rarity: data.rarity,
        hasWorkbench: Boolean(row.structuredItem),
      };
    })
    .filter((item) => !activeRarity || item.rarity === activeRarity);

  const listBase = `/worlds/${worldSlug}/magic-items`;

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
            listBase,
          )}
        />
      }
    >
      <PageHeader
        title="Magic-Item-Werkbank"
        summary="Strukturierte magische Gegenstände: sichtbare Beschreibung vs. DM-Geheimnis, Fluch, Einstimmung, Seltenheit — mit Export für Homebrewery/5e.tools und Spieler-Handout."
      />

      <div className="uwe-filter-bar">
        <Link href={listBase} className={!activeRarity ? "active" : undefined}>
          Alle Seltenheiten
        </Link>
        {ITEM_RARITIES.map((rarity) => (
          <Link
            key={rarity}
            href={`${listBase}?rarity=${rarity}`}
            className={activeRarity === rarity ? "active" : undefined}
          >
            {ITEM_RARITY_LABELS[rarity]}
          </Link>
        ))}
      </div>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">
          Item-Seiten
          {activeRarity ? ` — ${ITEM_RARITY_LABELS[activeRarity]}` : ""}
        </h2>
        {items.length === 0 ? (
          <p className="uwe-dashboard-muted">
            {activeRarity
              ? "Keine Items mit dieser Seltenheit."
              : "Keine Item-Seiten in dieser Welt. Lege im Wiki eine Seite vom Typ „Item“ an."}
          </p>
        ) : (
          <ul className="uwe-linked-list">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/worlds/${worldSlug}/magic-items/${item.id}`}>{item.title}</Link>
                {item.rarity ? (
                  <span className="uwe-badge"> {ITEM_RARITY_LABELS[item.rarity as ItemRarity] ?? item.rarity}</span>
                ) : null}
                {item.hasWorkbench ? <span className="uwe-badge"> Werkbank</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorldShell>
  );
}
