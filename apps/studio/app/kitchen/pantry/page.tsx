import Link from "next/link";
import {
  createKitchenService,
  createPantryService,
  formatAmount,
  rankRecipesByPantry,
  INGREDIENT_UNITS,
  INGREDIENT_UNIT_LABELS,
  PANTRY_LOCATIONS,
  PANTRY_LOCATION_LABELS,
  type PantryLocation,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  createPantryItemAction,
  markPantryLowStockAction,
  removePantryItemAction,
} from "@/app/kitchen-actions";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const EXPIRY_WINDOW_DAYS = 7;

export default async function KitchenPantryPage() {
  await requireStudioAccess();

  const pantry = createPantryService(prisma);
  const kitchen = createKitchenService(prisma);
  const now = new Date();

  const [items, expiring, recipes] = await Promise.all([
    pantry.list(),
    pantry.getExpiring(EXPIRY_WINDOW_DAYS, now),
    kitchen.listRecipes({ status: "active" }),
  ]);

  const pantryNames = items.map((item) => item.normalizedName);
  const matches = rankRecipesByPantry(
    recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients.map((ing) => ({
        normalizedName: ing.normalizedName,
        optional: ing.optional,
      })),
    })),
    pantryNames,
  ).slice(0, 6);

  const itemsByLocation = new Map<PantryLocation, typeof items>();
  for (const item of items) {
    const key = item.location as PantryLocation;
    const bucket = itemsByLocation.get(key) ?? [];
    bucket.push(item);
    itemsByLocation.set(key, bucket);
  }

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Küche", href: "/kitchen" }, { label: "Vorratskammer" }]}
        />
      }
    >
      <PageHeader
        title="Vorratskammer"
        summary="Was ist zuhause da? Behalte Vorräte, Lagerorte und Ablaufdaten im Blick — und koche direkt mit dem, was da ist."
      />

      {expiring.length > 0 && (
        <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
          <h2 className="uwe-v2-section-title">Bald ablaufend</h2>
          <ul className="uwe-linked-list">
            {expiring.map((item) => {
              const expired = item.expiresAt != null && item.expiresAt.getTime() < now.getTime();
              return (
                <li key={item.id} style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                  <span className="uwe-badge">{expired ? "abgelaufen" : "bald"}</span>
                  <span style={{ flex: 1 }}>
                    {item.name}
                    {item.expiresAt ? ` — ${DATE_FORMAT.format(item.expiresAt)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Koche mit meinem Vorrat</h2>
        {matches.length === 0 ? (
          <p className="uwe-dashboard-muted">
            Noch keine passenden Rezepte — lege Vorräte an, dann schlagen wir hier Gerichte vor.
          </p>
        ) : (
          <ul className="uwe-today-card-list">
            {matches.map((match) => (
              <li key={match.recipe.id} className="uwe-today-card">
                <h3>
                  <Link href={`/kitchen/recipes/${match.recipe.id}`}>{match.recipe.title}</Link>
                </h3>
                <p className="uwe-dashboard-muted">
                  {match.matchCount} von {match.requiredCount}{" "}
                  {match.requiredCount === 1 ? "Zutat" : "Zutaten"} im Vorrat
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Vorrat hinzufügen</h2>
        <form action={createPantryItemAction} className="uwe-brain-create-form">
          <label>
            Name
            <input name="name" required placeholder="z. B. Tomaten" />
          </label>
          <label>
            Lagerort
            <select name="location" defaultValue="pantry">
              {PANTRY_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {PANTRY_LOCATION_LABELS[location]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Menge
            <input name="amount" type="number" min={0} step="0.1" />
          </label>
          <label>
            Einheit
            <select name="unit" defaultValue="freeform">
              {INGREDIENT_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {INGREDIENT_UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ablaufdatum
            <input name="expiresAt" type="date" />
          </label>
          <label>
            Notiz
            <input name="notes" />
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Hinzufügen
          </button>
        </form>
      </section>

      {PANTRY_LOCATIONS.map((location) => {
        const bucket = itemsByLocation.get(location) ?? [];
        if (bucket.length === 0) {
          return null;
        }
        return (
          <section className="uwe-v2-section" key={location}>
            <h2 className="uwe-v2-section-title">{PANTRY_LOCATION_LABELS[location]}</h2>
            <ul className="uwe-linked-list">
              {bucket.map((item) => (
                <li
                  key={item.id}
                  style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}
                >
                  <span style={{ flex: 1 }}>
                    {[item.name, formatAmount(item.amount, item.unit, item.unitLabel)]
                      .filter(Boolean)
                      .join(" · ")}
                    {item.lowStock ? " — knapp" : ""}
                    {item.expiresAt ? ` — bis ${DATE_FORMAT.format(item.expiresAt)}` : ""}
                  </span>
                  <form action={markPantryLowStockAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="lowStock" value={item.lowStock ? "0" : "1"} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                      {item.lowStock ? "Vorhanden" : "Knapp"}
                    </button>
                  </form>
                  <form action={removePantryItemAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-small">
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </StudioShell>
  );
}
