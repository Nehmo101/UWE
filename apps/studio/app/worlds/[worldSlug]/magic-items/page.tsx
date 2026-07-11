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
import { Badge, buttonVariants, EmptyState } from "@/src/components/ui";

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

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Seltenheits-Filter">
        <Link
          href={listBase}
          className={buttonVariants({ variant: !activeRarity ? "default" : "outline", size: "sm" })}
        >
          Alle Seltenheiten
        </Link>
        {ITEM_RARITIES.map((rarity) => (
          <Link
            key={rarity}
            href={`${listBase}?rarity=${rarity}`}
            className={buttonVariants({ variant: activeRarity === rarity ? "default" : "outline", size: "sm" })}
          >
            {ITEM_RARITY_LABELS[rarity]}
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Item-Seiten
          {activeRarity ? ` — ${ITEM_RARITY_LABELS[activeRarity]}` : ""}
        </h2>
        {items.length === 0 ? (
          <EmptyState
            title="Keine Item-Seiten"
            description={
              activeRarity
                ? "Keine Items mit dieser Seltenheit."
                : "Keine Item-Seiten in dieser Welt. Lege im Wiki eine Seite vom Typ „Item“ an."
            }
          />
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
              >
                <Link href={`/worlds/${worldSlug}/magic-items/${item.id}`}>{item.title}</Link>
                <div className="flex items-center gap-2">
                  {item.rarity ? (
                    <Badge variant="secondary">
                      {ITEM_RARITY_LABELS[item.rarity as ItemRarity] ?? item.rarity}
                    </Badge>
                  ) : null}
                  {item.hasWorkbench ? <Badge variant="info">Werkbank</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WorldShell>
  );
}
