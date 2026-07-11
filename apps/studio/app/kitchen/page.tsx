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
import { buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";
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

      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vorratskammer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-2xl font-semibold">{pantryItems.length}</p>
              <Link href="/kitchen/pantry" className="text-sm text-muted-foreground hover:underline">
                Vorräte verwalten
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Offene Einkaufslisten</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-2xl font-semibold">{openShoppingLists.length}</p>
              <Link href="/kitchen/shopping" className="text-sm text-muted-foreground hover:underline">
                Einkauf öffnen
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nächster Essensplan</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {nextMealEntry ? (
                <>
                  <p className="text-lg font-semibold">
                    {(nextMealEntry.recipe?.title ?? nextMealEntry.note) ?? "Geplant"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {PLAN_DATE_FORMAT.format(new Date(nextMealEntry.date))} ·{" "}
                    {MEAL_SLOT_LABELS[nextMealEntry.slot as MealSlot]}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Kein Eintrag in dieser Woche</p>
              )}
              <Link href="/kitchen/plan" className="text-sm text-muted-foreground hover:underline">
                Wochenplan
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {STATUS_ORDER.map((status) => (
            <Card key={status}>
              <CardHeader>
                <CardTitle className="text-base">{RECIPE_STATUS_LABELS[status]}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <p className="text-2xl font-semibold">{counts[status]}</p>
                <Link
                  href={`/kitchen/recipes?status=${status}`}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  Anzeigen
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Schnellzugriff</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Insgesamt {total} {total === 1 ? "Rezept" : "Rezepte"} in der Sammlung.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/kitchen/recipes" className={buttonVariants({ variant: "default" })}>
                Alle Rezepte
              </Link>
              <Link href="/kitchen/plan" className={buttonVariants({ variant: "secondary" })}>
                Wochenplan
              </Link>
              <Link href="/kitchen/shopping" className={buttonVariants({ variant: "secondary" })}>
                Einkaufslisten
              </Link>
              <Link href="/kitchen/pantry" className={buttonVariants({ variant: "secondary" })}>
                Vorratskammer
              </Link>
              <Link href="/kitchen/recipes?new=1" className={buttonVariants({ variant: "secondary" })}>
                Neues Rezept
              </Link>
            </div>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Aktive Rezepte</h2>
          {recentRecipes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine aktiven Rezepte. <Link href="/kitchen/recipes?new=1">Erstes Rezept anlegen</Link>.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentRecipes.slice(0, 8).map((recipe) => (
                <Card key={recipe.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link href={`/kitchen/recipes/${recipe.id}`}>{recipe.title}</Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {recipe.ingredients.length}{" "}
                      {recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}
                      {recipe.durationMinutes ? ` · ${recipe.durationMinutes} Min.` : ""}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
