import Link from "next/link";
import { brainPrisma } from "@uwe/database/brain-client";
import { notFound } from "next/navigation";
import {
  createKitchenService,
  formatAmount,
  RECIPE_RATING_FIELDS,
  RECIPE_STATUS_LABELS,
  RECIPE_STATUSES,
  serializeIngredientLines,
  type RecipeStatus,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  badgeVariants,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  archiveRecipeAction,
  updateRecipeAction,
  uploadRecipeImageAction,
} from "../../../kitchen-actions";

interface Props {
  params: Promise<{ id: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function stepsToText(steps: unknown): string {
  if (!Array.isArray(steps)) return "";
  return steps.filter((step): step is string => typeof step === "string").join("\n");
}

export default async function RecipeDetailPage({ params }: Props) {
  await requireStudioAccess();

  const { id } = await params;
  const recipe = await createKitchenService(brainPrisma, prisma).getRecipe(id);

  if (!recipe) {
    notFound();
  }

  const status = recipe.status as RecipeStatus;
  const ingredientsText = serializeIngredientLines(
    recipe.ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      unitLabel: ing.unitLabel,
    })),
  );
  const tagKeys = recipe.tags.map((tag) => tag.key).join(", ");

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Küche", href: "/kitchen" },
            { label: "Rezepte", href: "/kitchen/recipes" },
            { label: recipe.title },
          ]}
        />
      }
    >
      <style>{`
        @media print {
          .recipe-print-hide,
          nav,
          form {
            display: none !important;
          }
          .recipe-print-root {
            max-width: 100%;
            color: #000;
          }
          .recipe-print-root h2 {
            margin-top: 1.25rem;
            page-break-after: avoid;
          }
          .recipe-print-root ol,
          .recipe-print-root ul {
            page-break-inside: avoid;
          }
        }
      `}</style>
      <div className="recipe-print-root flex flex-col gap-6">
        <PageHeader
          title={recipe.title}
          summary={`${RECIPE_STATUS_LABELS[status]} · ${recipe.ingredients.length} Zutaten · ${recipe.servingsBase} Portionen${recipe.durationMinutes ? ` · ${recipe.durationMinutes} Min.` : ""}`}
        />
        <p className="recipe-print-hide text-sm text-muted-foreground">
          <Link href="/kitchen/recipes">← Alle Rezepte</Link> · Aktualisiert{" "}
          {DATE_FORMAT.format(recipe.updatedAt)}
        </p>

        {recipe.tags.length > 0 && (
          <nav className="recipe-print-hide flex flex-wrap gap-2" aria-label="Tags">
            {recipe.tags.map((tag) => (
              <Link
                key={tag.key}
                href={`/kitchen/recipes?tag=${encodeURIComponent(tag.key)}`}
                className={badgeVariants({ variant: "default" })}
              >
                #{tag.label}
              </Link>
            ))}
          </nav>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Zutaten</h2>
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Zutaten erfasst.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {recipe.ingredients.map((ing) => (
                <li key={ing.id}>
                  {[formatAmount(ing.amount, ing.unit, ing.unitLabel), ing.name]
                    .filter(Boolean)
                    .join(" ")}
                  {ing.optional ? " (optional)" : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        {Array.isArray(recipe.steps) && recipe.steps.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Zubereitung</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {(recipe.steps as unknown[])
                .filter((step): step is string => typeof step === "string")
                .map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
            </ol>
          </section>
        )}

        <Card className="recipe-print-hide">
          <CardHeader>
            <CardTitle>Rezept-Bild</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recipe.imageStorageKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={studioApiUrl(`/api/kitchen/recipes/${recipe.id}/image`)}
                alt={recipe.title}
                className="h-auto max-w-full rounded-[var(--radius)]"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Noch kein Bild hinterlegt.</p>
            )}
            <form action={uploadRecipeImageAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="id" value={recipe.id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recipe-image">Bild hochladen (PNG, JPEG, GIF, WebP)</Label>
                <Input id="recipe-image" name="image" type="file" accept="image/*" required />
              </div>
              <Button type="submit" variant="secondary">
                Bild speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="recipe-print-hide">
          <CardHeader>
            <CardTitle>Rezept bearbeiten</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateRecipeAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={recipe.id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recipe-edit-title">Titel</Label>
                <Input id="recipe-edit-title" name="title" defaultValue={recipe.title} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recipe-edit-status">Status</Label>
                <Select name="status" defaultValue={status}>
                  <SelectTrigger id="recipe-edit-status">
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
                <Label htmlFor="recipe-edit-description">Beschreibung</Label>
                <Textarea id="recipe-edit-description" name="description" rows={2} defaultValue={recipe.description} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recipe-edit-servings">Portionen (Basis)</Label>
                <Input
                  id="recipe-edit-servings"
                  name="servingsBase"
                  type="number"
                  min={1}
                  step="0.5"
                  defaultValue={recipe.servingsBase}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recipe-edit-duration">Dauer (Minuten)</Label>
                <Input
                  id="recipe-edit-duration"
                  name="durationMinutes"
                  type="number"
                  min={0}
                  defaultValue={recipe.durationMinutes ?? ""}
                />
              </div>
              {RECIPE_RATING_FIELDS.map((field) => (
                <div className="flex flex-col gap-1.5" key={field.key}>
                  <Label htmlFor={`recipe-edit-${field.key}`}>{field.label} (1–5)</Label>
                  <Input
                    id={`recipe-edit-${field.key}`}
                    name={field.key}
                    type="number"
                    min={1}
                    max={5}
                    defaultValue={recipe[field.key] ?? ""}
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="recipe-edit-ingredients">
                  Zutaten (eine pro Zeile: <code>800 g Tomaten</code>)
                </Label>
                <Textarea
                  id="recipe-edit-ingredients"
                  name="ingredients"
                  rows={6}
                  defaultValue={ingredientsText}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="recipe-edit-steps">Zubereitung (ein Schritt pro Zeile)</Label>
                <Textarea id="recipe-edit-steps" name="steps" rows={5} defaultValue={stepsToText(recipe.steps)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="recipe-edit-tags">Tags (kommagetrennt)</Label>
                <Input id="recipe-edit-tags" name="tags" defaultValue={tagKeys} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="recipe-edit-source">Quelle (URL)</Label>
                <Input id="recipe-edit-source" name="sourceUrl" type="url" defaultValue={recipe.sourceUrl ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="recipe-edit-notes">Notizen</Label>
                <Textarea id="recipe-edit-notes" name="notes" rows={2} defaultValue={recipe.notes} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {status !== "archived" && (
          <form action={archiveRecipeAction} className="recipe-print-hide">
            <input type="hidden" name="id" value={recipe.id} />
            <Button type="submit" variant="secondary" size="sm">
              Rezept archivieren
            </Button>
          </form>
        )}
      </div>
    </StudioShell>
  );
}
