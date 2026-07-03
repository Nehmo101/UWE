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
  searchParams: Promise<{ status?: string; tag?: string; new?: string }>;
};

function resolveStatus(value: string | undefined): RecipeStatus | undefined {
  return RECIPE_STATUSES.includes(value as RecipeStatus)
    ? (value as RecipeStatus)
    : undefined;
}

export default async function RecipesPage({ searchParams }: Props) {
  await requireStudioAccess();

  const { status: statusParam, tag, new: showNew } = await searchParams;
  const status = resolveStatus(statusParam);

  const kitchen = createKitchenService(prisma);
  const [recipes, tags] = await Promise.all([
    kitchen.listRecipes({ status, tag }),
    kitchen.listRecipeTags(),
  ]);

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
