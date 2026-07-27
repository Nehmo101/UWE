import Link from "next/link";
import { familyPrisma } from "@uwe/database/family-client";
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
import {
  badgeVariants,
  buttonVariants,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";
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

const CHIP_CLASS =
  "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function RecipesPage({ searchParams }: Props) {
  await requireStudioAccess();

  const { status: statusParam, tag, new: showNew, sort: sortParam } = await searchParams;
  const status = resolveStatus(statusParam);
  const sort = resolveSort(sortParam);

  const kitchen = createKitchenService(familyPrisma, prisma);
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

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <nav className="flex flex-wrap gap-2" aria-label="Status-Filter">
            <Link
              href="/kitchen/recipes"
              className={cn(badgeVariants({ variant: !status && !tag ? "accent" : "default" }), CHIP_CLASS)}
            >
              Alle
            </Link>
            {RECIPE_STATUSES.map((value) => (
              <Link
                key={value}
                href={`/kitchen/recipes?status=${value}`}
                className={cn(badgeVariants({ variant: status === value ? "accent" : "default" }), CHIP_CLASS)}
              >
                {RECIPE_STATUS_LABELS[value]}
              </Link>
            ))}
          </nav>
          {tags.length > 0 && (
            <nav className="flex flex-wrap gap-2" aria-label="Tag-Filter">
              {tags.map((entry) => (
                <Link
                  key={entry.key}
                  href={`/kitchen/recipes?tag=${encodeURIComponent(entry.key)}`}
                  className={cn(badgeVariants({ variant: tag === entry.key ? "accent" : "default" }), CHIP_CLASS)}
                >
                  #{entry.label}
                </Link>
              ))}
            </nav>
          )}
          <nav className="flex flex-wrap items-center gap-2" aria-label="Sortierung">
            <span className="text-sm text-muted-foreground">Sortierung:</span>
            <Link
              href={sortHref(status, tag, "duration")}
              className={cn(badgeVariants({ variant: sort === "duration" ? "accent" : "default" }), CHIP_CLASS)}
            >
              Dauer
            </Link>
            <Link
              href={sortHref(status, tag, "rating")}
              className={cn(badgeVariants({ variant: sort === "rating" ? "accent" : "default" }), CHIP_CLASS)}
            >
              Bewertung
            </Link>
          </nav>
          <p className="text-sm text-muted-foreground">
            {showForm ? (
              <Link href="/kitchen/recipes">Formular schließen</Link>
            ) : (
              <Link href="/kitchen/recipes?new=1">+ Neues Rezept</Link>
            )}
          </p>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Neues Rezept</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createRecipeAction} className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-title">Titel</Label>
                  <Input id="recipe-new-title" name="title" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-status">Status</Label>
                  <Select name="status" defaultValue="active">
                    <SelectTrigger id="recipe-new-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECIPE_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {RECIPE_STATUS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="recipe-new-description">Beschreibung</Label>
                  <Textarea id="recipe-new-description" name="description" rows={2} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-servings">Portionen (Basis)</Label>
                  <Input
                    id="recipe-new-servings"
                    name="servingsBase"
                    type="number"
                    min={1}
                    step="0.5"
                    defaultValue={2}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-duration">Dauer (Minuten)</Label>
                  <Input id="recipe-new-duration" name="durationMinutes" type="number" min={0} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="recipe-new-ingredients">
                    Zutaten (eine pro Zeile: <code>800 g Tomaten</code>)
                  </Label>
                  <Textarea
                    id="recipe-new-ingredients"
                    name="ingredients"
                    rows={5}
                    placeholder={"800 g Tomaten\n2 Stück Zwiebeln\nSalz"}
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="recipe-new-steps">Zubereitung (ein Schritt pro Zeile)</Label>
                  <Textarea id="recipe-new-steps" name="steps" rows={4} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="recipe-new-tags">Tags (kommagetrennt)</Label>
                  <Input id="recipe-new-tags" name="tags" placeholder="schnell, vegan, kindgerecht" />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit">Rezept anlegen</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Rezepte ({recipes.length})</h2>
          {recipes.length === 0 ? (
            <EmptyState
              title="Keine Rezepte gefunden"
              description="Passe den Filter an oder lege ein neues Rezept an."
              action={
                <Link href="/kitchen/recipes?new=1" className={buttonVariants({ variant: "secondary" })}>
                  Neues Rezept
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recipes.map((recipe) => (
                <Card key={recipe.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link href={`/kitchen/recipes/${recipe.id}`}>{recipe.title}</Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      {RECIPE_STATUS_LABELS[recipe.status as RecipeStatus]} ·{" "}
                      {recipe.ingredients.length}{" "}
                      {recipe.ingredients.length === 1 ? "Zutat" : "Zutaten"}
                      {recipe.durationMinutes ? ` · ${recipe.durationMinutes} Min.` : ""}
                      {recipe.tasteRating ? ` · ★ ${recipe.tasteRating}` : ""}
                    </p>
                    {recipe.description && <p className="text-sm">{recipe.description}</p>}
                    {recipe.ingredients.length > 0 && (
                      <p className="text-sm text-muted-foreground">
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
