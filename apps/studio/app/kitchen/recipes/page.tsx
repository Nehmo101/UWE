import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createKitchenService,
  formatAmount,
  RECIPE_STATUS_LABELS,
  RECIPE_STATUSES,
  type RecipeStatus,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { createRecipeAction } from "../../kitchen-actions";

type Props = {
  searchParams: Promise<{ status?: string; tag?: string; new?: string; sort?: string }>;
};

type RecipeSort = "duration" | "rating";

function resolveSort(value: string | undefined): RecipeSort | undefined {
  return value === "duration" || value === "rating" ? value : undefined;
}

function sortRecipes<T extends { title: string; durationMinutes: number | null; tasteRating: number | null }>(
  recipes: T[],
  sort: RecipeSort | undefined,
): T[] {
  if (!sort) {
    return [...recipes].sort((a, b) => a.title.localeCompare(b.title, "de"));
  }
  if (sort === "duration") {
    return [...recipes].sort((a, b) => {
      const aDuration = a.durationMinutes ?? Number.POSITIVE_INFINITY;
      const bDuration = b.durationMinutes ?? Number.POSITIVE_INFINITY;
      return aDuration - bDuration || a.title.localeCompare(b.title, "de");
    });
  }
  return [...recipes].sort((a, b) => {
    const aRating = a.tasteRating ?? -1;
    const bRating = b.tasteRating ?? -1;
    return bRating - aRating || a.title.localeCompare(b.title, "de");
  });
}

function sortHref(status: string | undefined, tag: string | undefined, sort: RecipeSort): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (tag) params.set("tag", tag);
  params.set("sort", sort);
  return `/kitchen/recipes?${params.toString()}`;
}

function resolveStatus(value: string | undefined): RecipeStatus | undefined {
  return RECIPE_STATUSES.includes(value as RecipeStatus)
    ? (value as RecipeStatus)
    : undefined;
}

export default async function RecipesPage({ searchParams }: Props) {
  await requireStudioAccess();

  const { status: statusParam, tag, new: showNew, sort: sortParam } = await searchParams;
  const status = resolveStatus(statusParam);
  const sort = resolveSort(sortParam);

  const kitchen = createKitchenService(prisma);
  const [recipesRaw, tags] = await Promise.all([
    kitchen.listRecipes({ status, tag }),
    kitchen.listRecipeTags(),
  ]);
  const recipes = sortRecipes(recipesRaw, sort);

  const showForm = showNew === "1";

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Küche", href: "/kitchen" }, { label: "Rezepte" }]}
        />
      }
    >
      <PageHeader
        title="Rezepte"
        summary="Sammlung eigener Rezepte — filterbar nach Status und Tag."
      />

      <section className="uwe-v2-section">
        <div className="uwe-today-quick-chips">
          <Link
            href="/kitchen/recipes"
            className="uwe-today-quick-chip"
            data-severity={!status && !tag ? "info" : undefined}
          >
            Alle
          </Link>
          {RECIPE_STATUSES.map((value) => (
            <Link
              key={value}
              href={`/kitchen/recipes?status=${value}`}
              className="uwe-today-quick-chip"
              data-severity={status === value ? "info" : undefined}
            >
              {RECIPE_STATUS_LABELS[value]}
            </Link>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="uwe-today-quick-chips" style={{ marginTop: "0.5rem" }}>
            {tags.map((entry) => (
              <Link
                key={entry.key}
                href={`/kitchen/recipes?tag=${encodeURIComponent(entry.key)}`}
                className="uwe-today-quick-chip"
                data-severity={tag === entry.key ? "info" : undefined}
              >
                #{entry.label}
              </Link>
            ))}
          </div>
        )}
        <div className="uwe-today-quick-chips" style={{ marginTop: "0.5rem" }}>
          <span className="uwe-dashboard-muted" style={{ marginRight: "0.5rem" }}>
            Sortierung:
          </span>
          <Link
            href={sortHref(status, tag, "duration")}
            className="uwe-today-quick-chip"
            data-severity={sort === "duration" ? "info" : undefined}
          >
            Dauer
          </Link>
          <Link
            href={sortHref(status, tag, "rating")}
            className="uwe-today-quick-chip"
            data-severity={sort === "rating" ? "info" : undefined}
          >
            Bewertung
          </Link>
        </div>
        <p className="uwe-dashboard-muted" style={{ marginTop: "0.5rem" }}>
          {showForm ? (
            <Link href="/kitchen/recipes">Formular schließen</Link>
          ) : (
            <Link href="/kitchen/recipes?new=1">+ Neues Rezept</Link>
          )}
        </p>
      </section>

      {showForm && (
        <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
          <h2 className="uwe-v2-section-title">Neues Rezept</h2>
          <form action={createRecipeAction} className="uwe-brain-create-form">
            <label>
              Titel
              <input name="title" required />
            </label>
            <label>
              Status
              <select name="status" defaultValue="active">
                {RECIPE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {RECIPE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Beschreibung
              <textarea name="description" rows={2} />
            </label>
            <label>
              Portionen (Basis)
              <input name="servingsBase" type="number" min={1} step="0.5" defaultValue={2} />
            </label>
            <label>
              Dauer (Minuten)
              <input name="durationMinutes" type="number" min={0} />
            </label>
            <label>
              Zutaten (eine pro Zeile: <code>800 g Tomaten</code>)
              <textarea name="ingredients" rows={5} placeholder={"800 g Tomaten\n2 Stück Zwiebeln\nSalz"} />
            </label>
            <label>
              Zubereitung (ein Schritt pro Zeile)
              <textarea name="steps" rows={4} />
            </label>
            <label>
              Tags (kommagetrennt)
              <input name="tags" placeholder="schnell, vegan, kindgerecht" />
            </label>
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
              Rezept anlegen
            </button>
          </form>
        </section>
      )}

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Rezepte ({recipes.length})</h2>
        {recipes.length === 0 ? (
          <EmptyState
            title="Keine Rezepte gefunden"
            description="Passe den Filter an oder lege ein neues Rezept an."
            action={<Link href="/kitchen/recipes?new=1">Neues Rezept</Link>}
          />
        ) : (
          <ul className="uwe-today-card-list">
            {recipes.map((recipe) => (
              <li key={recipe.id} className="uwe-today-card">
                <h3>
                  <Link href={`/kitchen/recipes/${recipe.id}`}>{recipe.title}</Link>
                </h3>
                <p className="uwe-dashboard-muted">
                  {RECIPE_STATUS_LABELS[recipe.status as RecipeStatus]} ·{" "}
                  {recipe.ingredients.length}{" "}
                  {recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}
                  {recipe.durationMinutes ? ` · ${recipe.durationMinutes} Min.` : ""}
                  {recipe.tasteRating ? ` · ★ ${recipe.tasteRating}` : ""}
                </p>
                {recipe.description && <p>{recipe.description}</p>}
                {recipe.ingredients.length > 0 && (
                  <p className="uwe-dashboard-muted">
                    {recipe.ingredients
                      .slice(0, 5)
                      .map((ing) =>
                        [formatAmount(ing.amount, ing.unit, ing.unitLabel), ing.name]
                          .filter(Boolean)
                          .join(" "),
                      )
                      .join(", ")}
                    {recipe.ingredients.length > 5 ? " …" : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </StudioShell>
  );
}
