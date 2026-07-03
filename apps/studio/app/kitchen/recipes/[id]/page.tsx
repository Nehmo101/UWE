import Link from "next/link";
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
import { requireStudioAccess } from "@/src/lib/auth";
import { archiveRecipeAction, updateRecipeAction } from "../../../kitchen-actions";

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
  const recipe = await createKitchenService(prisma).getRecipe(id);

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
      <PageHeader
        title={recipe.title}
        summary={`${RECIPE_STATUS_LABELS[status]} · ${recipe.ingredients.length} Zutaten · ${recipe.servingsBase} Portionen`}
      />
      <p className="uwe-dashboard-muted">
        <Link href="/kitchen/recipes">← Alle Rezepte</Link> · Aktualisiert{" "}
        {DATE_FORMAT.format(recipe.updatedAt)}
      </p>

      {recipe.tags.length > 0 && (
        <p className="uwe-today-quick-chips">
          {recipe.tags.map((tag) => (
            <Link
              key={tag.key}
              href={`/kitchen/recipes?tag=${encodeURIComponent(tag.key)}`}
              className="uwe-today-quick-chip"
            >
              #{tag.label}
            </Link>
          ))}
        </p>
      )}

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Zutaten</h2>
        {recipe.ingredients.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine Zutaten erfasst.</p>
        ) : (
          <ul>
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
        <section className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">Zubereitung</h2>
          <ol>
            {(recipe.steps as unknown[])
              .filter((step): step is string => typeof step === "string")
              .map((step, index) => (
                <li key={index}>{step}</li>
              ))}
          </ol>
        </section>
      )}

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Rezept bearbeiten</h2>
        {/* TODO(K1): Bild-Upload über @uwe/assets ergänzen (imageStorageKey). */}
        <form action={updateRecipeAction} className="uwe-brain-create-form">
          <input type="hidden" name="id" value={recipe.id} />
          <label>
            Titel
            <input name="title" defaultValue={recipe.title} required />
          </label>
          <label>
            Status
            <select name="status" defaultValue={status}>
              {RECIPE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {RECIPE_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Beschreibung
            <textarea name="description" rows={2} defaultValue={recipe.description} />
          </label>
          <label>
            Portionen (Basis)
            <input
              name="servingsBase"
              type="number"
              min={1}
              step="0.5"
              defaultValue={recipe.servingsBase}
            />
          </label>
          <label>
            Dauer (Minuten)
            <input
              name="durationMinutes"
              type="number"
              min={0}
              defaultValue={recipe.durationMinutes ?? ""}
            />
          </label>
          {RECIPE_RATING_FIELDS.map((field) => (
            <label key={field.key}>
              {field.label} (1–5)
              <input
                name={field.key}
                type="number"
                min={1}
                max={5}
                defaultValue={recipe[field.key] ?? ""}
              />
            </label>
          ))}
          <label>
            Zutaten (eine pro Zeile: <code>800 g Tomaten</code>)
            <textarea name="ingredients" rows={6} defaultValue={ingredientsText} />
          </label>
          <label>
            Zubereitung (ein Schritt pro Zeile)
            <textarea name="steps" rows={5} defaultValue={stepsToText(recipe.steps)} />
          </label>
          <label>
            Tags (kommagetrennt)
            <input name="tags" defaultValue={tagKeys} />
          </label>
          <label>
            Quelle (URL)
            <input name="sourceUrl" type="url" defaultValue={recipe.sourceUrl ?? ""} />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} defaultValue={recipe.notes} />
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Speichern
          </button>
        </form>
      </section>

      {status !== "archived" && (
        <form action={archiveRecipeAction}>
          <input type="hidden" name="id" value={recipe.id} />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
            Rezept archivieren
          </button>
        </form>
      )}
    </StudioShell>
  );
}
