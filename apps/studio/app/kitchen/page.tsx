import Link from "next/link";
import {
  createKitchenService,
  createMealPlanService,
  createPantryService,
  createShoppingService,
  isoWeekOf,
  MEAL_SLOT_LABELS,
  RECIPE_STATUS_LABELS,
  type MealSlot,
  type RecipeStatus,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";

const STATUS_ORDER: RecipeStatus[] = ["active", "draft", "archived"];

const PLAN_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

export default async function KitchenDashboardPage() {
  await requireStudioAccess();

  const kitchen = createKitchenService(prisma);
  const pantry = createPantryService(prisma);
  const shopping = createShoppingService(prisma);
  const meals = createMealPlanService(prisma);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { isoYear, isoWeek } = isoWeekOf(now);

  const [counts, recentRecipes, pantryItems, shoppingLists, week] = await Promise.all([
    kitchen.getStatusCounts(),
    kitchen.listRecipes({ status: "active" }),
    pantry.list(),
    shopping.listLists(),
    meals.getWeek(isoYear, isoWeek),
  ]);

  const openShoppingLists = shoppingLists.filter((list) => !list.done);
  const nextMealEntry =
    week?.entries
      .filter((entry) => !entry.cooked && new Date(entry.date) >= todayStart)
      .sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime() ||
          a.sortIndex - b.sortIndex,
      )[0] ?? null;

  const total = counts.active + counts.draft + counts.archived;

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Küche" }]} />}>
      <PageHeader
        title="Küche"
        summary="Eigene Rezepte, Zutaten und Bewertungen — das Fundament für Wochenplan und Einkauf."
      />

      <section className="uwe-v2-section">
        <div className="uwe-dashboard-grid">
          <article className="uwe-v2-card uwe-dashboard-card">
            <h3>Vorratskammer</h3>
            <p style={{ fontSize: "2rem", fontWeight: 600 }}>{pantryItems.length}</p>
            <p className="uwe-dashboard-muted">
              <Link href="/kitchen/pantry">Vorräte verwalten</Link>
            </p>
          </article>
          <article className="uwe-v2-card uwe-dashboard-card">
            <h3>Offene Einkaufslisten</h3>
            <p style={{ fontSize: "2rem", fontWeight: 600 }}>{openShoppingLists.length}</p>
            <p className="uwe-dashboard-muted">
              <Link href="/kitchen/shopping">Einkauf öffnen</Link>
            </p>
          </article>
          <article className="uwe-v2-card uwe-dashboard-card">
            <h3>Nächster Essensplan</h3>
            {nextMealEntry ? (
              <>
                <p style={{ fontSize: "1.125rem", fontWeight: 600 }}>
                  {(nextMealEntry.recipe?.title ?? nextMealEntry.note) ?? "Geplant"}
                </p>
                <p className="uwe-dashboard-muted">
                  {PLAN_DATE_FORMAT.format(new Date(nextMealEntry.date))} ·{" "}
                  {MEAL_SLOT_LABELS[nextMealEntry.slot as MealSlot]}
                </p>
              </>
            ) : (
              <p className="uwe-dashboard-muted">Kein Eintrag in dieser Woche</p>
            )}
            <p className="uwe-dashboard-muted">
              <Link href="/kitchen/plan">Wochenplan</Link>
            </p>
          </article>
        </div>
      </section>

      <section className="uwe-v2-section">
        <div className="uwe-dashboard-grid">
          {STATUS_ORDER.map((status) => (
            <article key={status} className="uwe-v2-card uwe-dashboard-card">
              <h3>{RECIPE_STATUS_LABELS[status]}</h3>
              <p style={{ fontSize: "2rem", fontWeight: 600 }}>{counts[status]}</p>
              <p className="uwe-dashboard-muted">
                <Link href={`/kitchen/recipes?status=${status}`}>Anzeigen</Link>
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Schnellzugriff</h2>
        <p className="uwe-dashboard-muted">
          Insgesamt {total} {total === 1 ? "Rezept" : "Rezepte"} in der Sammlung.
        </p>
        <div className="uwe-brain-create-form">
          <Link href="/kitchen/recipes" className="uwe-v2-btn uwe-v2-btn-primary">
            Alle Rezepte
          </Link>
          <Link href="/kitchen/plan" className="uwe-v2-btn uwe-v2-btn-secondary">
            Wochenplan
          </Link>
          <Link href="/kitchen/shopping" className="uwe-v2-btn uwe-v2-btn-secondary">
            Einkaufslisten
          </Link>
          <Link href="/kitchen/pantry" className="uwe-v2-btn uwe-v2-btn-secondary">
            Vorratskammer
          </Link>
          <Link href="/kitchen/recipes?new=1" className="uwe-v2-btn uwe-v2-btn-secondary">
            Neues Rezept
          </Link>
        </div>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Aktive Rezepte</h2>
        {recentRecipes.length === 0 ? (
          <p className="uwe-dashboard-muted">
            Noch keine aktiven Rezepte. <Link href="/kitchen/recipes?new=1">Erstes Rezept anlegen</Link>.
          </p>
        ) : (
          <ul className="uwe-today-card-list">
            {recentRecipes.slice(0, 8).map((recipe) => (
              <li key={recipe.id} className="uwe-today-card">
                <h3>
                  <Link href={`/kitchen/recipes/${recipe.id}`}>{recipe.title}</Link>
                </h3>
                <p className="uwe-dashboard-muted">
                  {recipe.ingredients.length}{" "}
                  {recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}
                  {recipe.durationMinutes ? ` · ${recipe.durationMinutes} Min.` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StudioShell>
  );
}
