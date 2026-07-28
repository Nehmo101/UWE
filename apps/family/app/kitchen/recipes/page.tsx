import Link from "next/link";
import { familyPrisma } from "@uwe/database/family-client";
import {
  createKitchenService,
  formatAmount,
  RECIPE_STATUS_LABELS,
  RECIPE_STATUSES,
  type RecipeStatus,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { createRecipeAction } from "../../kitchen-actions";

/**
 * Rezeptsammlung mit Filter (Status, Tag) und Sortierung (Dauer, Bewertung).
 *
 * Das Anlege-Formular hängt an `?new=1` statt permanent auf der Seite zu
 * stehen: die Liste ist der Normalfall, das Anlegen die Ausnahme.
 */

export const dynamic = "force-dynamic";

type RecipeSort = "duration" | "rating";

interface Props {
  searchParams: Promise<{ status?: string; tag?: string; new?: string; sort?: string }>;
}

function resolveSort(value: string | undefined): RecipeSort | undefined {
  return value === "duration" || value === "rating" ? value : undefined;
}

function resolveStatus(value: string | undefined): RecipeStatus | undefined {
  return RECIPE_STATUSES.includes(value as RecipeStatus) ? (value as RecipeStatus) : undefined;
}

function sortRecipes<
  T extends { title: string; durationMinutes: number | null; tasteRating: number | null },
>(recipes: T[], sort: RecipeSort | undefined): T[] {
  if (sort === "duration") {
    return [...recipes].sort(
      (a, b) =>
        (a.durationMinutes ?? Number.POSITIVE_INFINITY) -
          (b.durationMinutes ?? Number.POSITIVE_INFINITY) ||
        a.title.localeCompare(b.title, "de"),
    );
  }
  if (sort === "rating") {
    return [...recipes].sort(
      (a, b) => (b.tasteRating ?? -1) - (a.tasteRating ?? -1) || a.title.localeCompare(b.title, "de"),
    );
  }
  return [...recipes].sort((a, b) => a.title.localeCompare(b.title, "de"));
}

function href(params: { status?: string; tag?: string; sort?: string }): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.tag) search.set("tag", params.tag);
  if (params.sort) search.set("sort", params.sort);
  const query = search.toString();
  return query ? `/kitchen/recipes?${query}` : "/kitchen/recipes";
}

function chip(active: boolean): string {
  return active ? "family-btn family-btn-sm" : "family-btn family-btn-ghost family-btn-sm";
}

export default async function FamilyRecipesPage({ searchParams }: Props) {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/kitchen" title="Rezepte">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const { status: statusParam, tag, new: showNew, sort: sortParam } = await searchParams;
  const status = resolveStatus(statusParam);
  const sort = resolveSort(sortParam);

  const kitchen = createKitchenService(familyPrisma, prisma);
  const [raw, tags] = await Promise.all([
    kitchen.listRecipes({ status, tag }),
    kitchen.listRecipeTags(),
  ]);
  const recipes = sortRecipes(raw, sort);
  const showForm = showNew === "1";

  return (
    <FamilyShell
      active="/kitchen"
      title="Rezepte"
      eyebrow="Küche"
      lede={`${recipes.length} Rezept(e)${status ? ` · ${RECIPE_STATUS_LABELS[status]}` : ""}${tag ? ` · #${tag}` : ""}`}
      actions={
        <span className="family-head-actions">
          <Link href="/kitchen" className="family-btn family-btn-ghost family-btn-sm">
            ← Küche
          </Link>
          <Link
            href={showForm ? "/kitchen/recipes" : "/kitchen/recipes?new=1"}
            className="family-btn family-btn-sm"
          >
            {showForm ? "Formular schließen" : "+ Neues Rezept"}
          </Link>
        </span>
      }
    >
      <nav className="family-head-actions" aria-label="Status">
        <Link href={href({})} className={chip(!status && !tag)}>
          Alle
        </Link>
        {RECIPE_STATUSES.map((value) => (
          <Link key={value} href={href({ status: value, sort })} className={chip(status === value)}>
            {RECIPE_STATUS_LABELS[value]}
          </Link>
        ))}
      </nav>

      {tags.length > 0 ? (
        <nav className="family-head-actions" aria-label="Tags">
          {tags.map((entry) => (
            <Link
              key={entry.key}
              href={href({ tag: entry.key, sort })}
              className={chip(tag === entry.key)}
            >
              #{entry.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <nav className="family-head-actions" aria-label="Sortierung">
        <span className="family-muted">Sortierung:</span>
        <Link href={href({ status: statusParam, tag, sort: "duration" })} className={chip(sort === "duration")}>
          Dauer
        </Link>
        <Link href={href({ status: statusParam, tag, sort: "rating" })} className={chip(sort === "rating")}>
          Bewertung
        </Link>
      </nav>

      {showForm ? (
        <section className="family-section">
          <h2>Neues Rezept</h2>
          <form action={createRecipeAction} className="family-form family-card">
            <div className="family-form-row">
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
            </div>
            <label>
              Beschreibung
              <textarea name="description" rows={2} />
            </label>
            <div className="family-form-row">
              <label>
                Portionen
                <input name="servingsBase" type="number" min={1} step="0.5" defaultValue={2} />
              </label>
              <label>
                Dauer (Minuten)
                <input name="durationMinutes" type="number" min={0} />
              </label>
            </div>
            <label>
              Zutaten — eine pro Zeile, z. B. &bdquo;800 g Tomaten&ldquo;
              <textarea
                name="ingredients"
                rows={5}
                placeholder={"800 g Tomaten\n2 Stück Zwiebeln\nSalz"}
              />
            </label>
            <label>
              Zubereitung — ein Schritt pro Zeile
              <textarea name="steps" rows={4} />
            </label>
            <label>
              Tags (kommagetrennt)
              <input name="tags" placeholder="schnell, vegan, kindgerecht" />
            </label>
            <div>
              <button type="submit" className="family-btn">
                Rezept anlegen
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="family-section">
        <h2>Rezepte · {recipes.length}</h2>
        {recipes.length === 0 ? (
          <p className="family-muted">
            Nichts gefunden. Filter anpassen oder{" "}
            <Link href="/kitchen/recipes?new=1">ein Rezept anlegen</Link>.
          </p>
        ) : (
          <ul className="family-list">
            {recipes.map((recipe) => (
              <li key={recipe.id} className="family-row">
                <div className="family-row-head">
                  <strong>
                    <Link href={`/kitchen/recipes/${recipe.id}`}>{recipe.title}</Link>
                  </strong>
                  <span className="family-tag">
                    {RECIPE_STATUS_LABELS[recipe.status as RecipeStatus]}
                  </span>
                  <span className="family-muted">
                    {recipe.ingredients.length}{" "}
                    {recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}
                    {recipe.durationMinutes ? ` · ${recipe.durationMinutes} Min.` : ""}
                    {recipe.tasteRating ? ` · ★ ${recipe.tasteRating}` : ""}
                  </span>
                </div>
                {recipe.description ? <p className="family-muted">{recipe.description}</p> : null}
                {recipe.ingredients.length > 0 ? (
                  <p className="family-muted">
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
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </FamilyShell>
  );
}
