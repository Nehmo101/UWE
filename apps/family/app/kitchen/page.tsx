import Link from "next/link";
import { familyPrisma } from "@uwe/database/family-client";
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
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";

/**
 * Küchen-Übersicht — der Einstieg in Rezepte, Wochenplan, Einkauf und Vorrat.
 *
 * Reine Zusammenfassung: alles Schreibende passiert auf den Unterseiten. Was
 * hier steht, beantwortet „was koche ich als Nächstes und fehlt was?".
 */

export const dynamic = "force-dynamic";

const STATUS_ORDER: RecipeStatus[] = ["active", "draft", "archived"];

const PLAN_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

export default async function FamilyKitchenPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/kitchen" title="Küche">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const kitchen = createKitchenService(familyPrisma, prisma);
  const pantry = createPantryService(familyPrisma);
  const shopping = createShoppingService(familyPrisma);
  const meals = createMealPlanService(familyPrisma);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { isoYear, isoWeek } = isoWeekOf(now);

  const [counts, activeRecipes, pantryItems, shoppingLists, week] = await Promise.all([
    kitchen.getStatusCounts(),
    kitchen.listRecipes({ status: "active" }),
    pantry.list(),
    shopping.listLists(),
    meals.getWeek(isoYear, isoWeek),
  ]);

  const openLists = shoppingLists.filter((list) => !list.done);
  const lowStock = pantryItems.filter((item) => item.lowStock);
  // Der nächste ungekochte Eintrag ab heute — das ist die Frage, die man beim
  // Öffnen der Seite hat.
  const nextMeal =
    week?.entries
      .filter((entry) => !entry.cooked && new Date(entry.date) >= todayStart)
      .sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime() || a.sortIndex - b.sortIndex,
      )[0] ?? null;

  return (
    <FamilyShell
      active="/kitchen"
      title="Küche"
      eyebrow="Gemeinsamer Bereich"
      lede="Rezepte, Wochenplan, Einkauf und Vorrat — eine Sammlung für alle im Haushalt."
    >
      <div className="family-kpis">
        <div className="family-kpi">
          <strong>{counts.active}</strong>
          <span>aktive Rezepte</span>
        </div>
        <div className="family-kpi">
          <strong>{openLists.length}</strong>
          <span>offene Listen</span>
        </div>
        <div className="family-kpi">
          <strong>{pantryItems.length}</strong>
          <span>im Vorrat</span>
        </div>
        <div className="family-kpi">
          <strong>{lowStock.length}</strong>
          <span>geht zur Neige</span>
        </div>
      </div>

      <section className="family-section">
        <h2>Als Nächstes</h2>
        {nextMeal ? (
          <p className="family-callout">
            <strong>{nextMeal.recipe?.title ?? nextMeal.note ?? "Geplant"}</strong> —{" "}
            {PLAN_DATE_FORMAT.format(new Date(nextMeal.date))} ·{" "}
            {MEAL_SLOT_LABELS[nextMeal.slot as MealSlot]}
          </p>
        ) : (
          <p className="family-muted">Diese Woche ist noch nichts geplant.</p>
        )}
        <div className="family-head-actions">
          <Link href="/kitchen/plan" className="family-btn family-btn-sm">
            Wochenplan
          </Link>
          <Link href="/kitchen/recipes" className="family-btn family-btn-ghost family-btn-sm">
            Rezepte
          </Link>
          <Link href="/kitchen/shopping" className="family-btn family-btn-ghost family-btn-sm">
            Einkauf
          </Link>
          <Link href="/kitchen/pantry" className="family-btn family-btn-ghost family-btn-sm">
            Vorrat
          </Link>
          <Link href="/kitchen/recipes?new=1" className="family-btn family-btn-ghost family-btn-sm">
            Neues Rezept
          </Link>
        </div>
      </section>

      <section className="family-section">
        <h2>Sammlung</h2>
        <ul className="family-list">
          {STATUS_ORDER.map((status) => (
            <li key={status} className="family-row">
              <div className="family-row-head">
                <strong>{RECIPE_STATUS_LABELS[status]}</strong>
                <span className="family-tag">{counts[status]}</span>
                <Link
                  href={`/kitchen/recipes?status=${status}`}
                  className="family-muted"
                  style={{ marginLeft: "auto" }}
                >
                  Anzeigen
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="family-section">
        <h2>Aktive Rezepte · {activeRecipes.length}</h2>
        {activeRecipes.length === 0 ? (
          <p className="family-muted">
            Noch nichts da. <Link href="/kitchen/recipes?new=1">Erstes Rezept anlegen</Link>.
          </p>
        ) : (
          <ul className="family-list">
            {activeRecipes.slice(0, 10).map((recipe) => (
              <li key={recipe.id} className="family-row">
                <div className="family-row-head">
                  <strong>
                    <Link href={`/kitchen/recipes/${recipe.id}`}>{recipe.title}</Link>
                  </strong>
                  <span className="family-muted">
                    {recipe.ingredients.length}{" "}
                    {recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}
                    {recipe.durationMinutes ? ` · ${recipe.durationMinutes} Min.` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </FamilyShell>
  );
}
