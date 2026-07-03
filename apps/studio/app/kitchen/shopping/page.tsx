import Link from "next/link";
import {
  createShoppingService,
  formatAmount,
  SHOPPING_CATEGORY_LABELS,
  type IngredientUnit,
  type ShoppingCategory,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  addShoppingItemAction,
  removeShoppingItemAction,
  toggleShoppingItemAction,
} from "@/app/kitchen-actions";

interface Props {
  searchParams: Promise<{ list?: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export default async function KitchenShoppingPage({ searchParams }: Props) {
  await requireStudioAccess();
  const { list: listId } = await searchParams;

  const shopping = createShoppingService(prisma);
  const lists = await shopping.listLists();
  const active = listId ? await shopping.getList(listId) : null;

  const grouped = new Map<ShoppingCategory, NonNullable<typeof active>["items"]>();
  for (const item of active?.items ?? []) {
    const bucket = grouped.get(item.category) ?? [];
    bucket.push(item);
    grouped.set(item.category, bucket);
  }

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Küche", href: "/kitchen" }, { label: "Einkauf" }]}
        />
      }
    >
      <PageHeader
        title="Einkaufslisten"
        summary="Aus dem Wochenplan erzeugte, konsolidierte Listen — nach Kategorie sortiert, zum Abhaken."
      />

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Listen</h2>
        {lists.length === 0 ? (
          <p className="uwe-dashboard-muted">
            Noch keine Listen. Erzeuge eine im{" "}
            <Link href="/kitchen/plan">Wochenplan</Link>.
          </p>
        ) : (
          <ul className="uwe-linked-list">
            {lists.map((entry) => (
              <li key={entry.id}>
                <Link href={`/kitchen/shopping?list=${entry.id}`}>
                  {entry.title}
                </Link>{" "}
                <span className="uwe-dashboard-muted">
                  {DATE_FORMAT.format(entry.createdAt)}
                  {entry.done ? " · erledigt" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {active ? (
        <>
          <PageHeader title={active.title} />
          {[...grouped.entries()].map(([category, items]) => (
            <section className="uwe-v2-section" key={category}>
              <h2 className="uwe-v2-section-title">{SHOPPING_CATEGORY_LABELS[category]}</h2>
              <ul className="uwe-linked-list">
                {items.map((item) => (
                  <li key={item.id} style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                    <form action={toggleShoppingItemAction} style={{ display: "inline" }}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="listId" value={active.id} />
                      <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                        {item.checked ? "☑" : "☐"}
                      </button>
                    </form>
                    <span style={{ flex: 1, textDecoration: item.checked ? "line-through" : "none" }}>
                      {item.name}
                      {item.amount != null
                        ? ` — ${formatAmount(item.amount, item.unit as IngredientUnit, item.unitLabel)}`
                        : ""}
                      {item.recurring ? " (Grundausstattung)" : ""}
                    </span>
                    <form action={removeShoppingItemAction} style={{ display: "inline" }}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="listId" value={active.id} />
                      <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                        ✕
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="uwe-v2-section">
            <form action={addShoppingItemAction} style={{ display: "flex", gap: "0.5rem" }}>
              <input type="hidden" name="listId" value={active.id} />
              <input type="text" name="name" placeholder="Weitere Position …" style={{ flex: 1 }} />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                + Hinzufügen
              </button>
            </form>
          </section>
        </>
      ) : null}
    </StudioShell>
  );
}
