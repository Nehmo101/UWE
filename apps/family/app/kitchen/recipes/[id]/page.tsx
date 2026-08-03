import Link from "next/link";
import { notFound } from "next/navigation";
import { familyPrisma } from "@uwe/database/family-client";
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
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { formatRecipeForCardAction } from "../../recipe-card-actions";
import {
  archiveRecipeAction,
  updateRecipeAction,
  uploadRecipeImageAction,
} from "../../../kitchen-actions";

/**
 * Ein Rezept: lesen, kochen, bearbeiten.
 *
 * Zutaten und Zubereitung stehen oben, weil man beim Kochen liest und nicht
 * bearbeitet. Der Druck-Stil blendet alles Bedienbare aus — ein ausgedrucktes
 * Rezept braucht keine Knöpfe.
 */

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function stepsToText(steps: unknown): string {
  if (!Array.isArray(steps)) return "";
  return steps.filter((step): step is string => typeof step === "string").join("\n");
}

export default async function FamilyRecipeDetailPage({ params }: Props) {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/kitchen" title="Rezept">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const { id } = await params;
  const recipe = await createKitchenService(familyPrisma, prisma).getRecipe(id);
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
    <FamilyShell
      active="/kitchen"
      title={recipe.title}
      eyebrow="Küche · Rezept"
      lede={`${RECIPE_STATUS_LABELS[status]} · ${recipe.ingredients.length} Zutaten · ${recipe.servingsBase} Portionen${recipe.durationMinutes ? ` · ${recipe.durationMinutes} Min.` : ""} · aktualisiert ${DATE_FORMAT.format(recipe.updatedAt)}`}
      actions={
        <Link href="/kitchen/recipes" className="family-btn family-btn-ghost family-btn-sm">
          ← Alle Rezepte
        </Link>
      }
    >
      <style>{`
        @media print {
          .family-print-hide,
          .uwe-topbar,
          .uwe-sidebar,
          form {
            display: none !important;
          }
        }
      `}</style>

      {recipe.tags.length > 0 ? (
        <nav className="family-head-actions family-print-hide" aria-label="Tags">
          {recipe.tags.map((tag) => (
            <Link
              key={tag.key}
              href={`/kitchen/recipes?tag=${encodeURIComponent(tag.key)}`}
              className="family-btn family-btn-ghost family-btn-sm"
            >
              #{tag.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <section className="family-section">
        <h2>Zutaten</h2>
        {recipe.ingredients.length === 0 ? (
          <p className="family-muted">Keine Zutaten erfasst.</p>
        ) : (
          <ul className="family-list">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="family-row">
                {[formatAmount(ing.amount, ing.unit, ing.unitLabel), ing.name]
                  .filter(Boolean)
                  .join(" ")}
                {ing.optional ? " (optional)" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {Array.isArray(recipe.steps) && recipe.steps.length > 0 ? (
        <section className="family-section">
          <h2>Zubereitung</h2>
          <ol className="family-list">
            {(recipe.steps as unknown[])
              .filter((step): step is string => typeof step === "string")
              .map((step, index) => (
                <li key={index} className="family-step">
                  {step}
                </li>
              ))}
          </ol>
        </section>
      ) : null}

      <section className="family-section family-print-hide">
        <h2>Auf Karte drucken</h2>
        <p className="family-muted">
          6×4 Zoll, wie die Etiketten. <strong>Kurzfassung</strong> presst alles auf eine Karte —
          gut für den Kühlschrank. <strong>Kartenset</strong> legt Zutaten und Schritte auf mehrere
          Karten, sodass nichts verloren geht.
        </p>
        <div className="family-head-actions">
          <a
            className="family-btn family-btn-sm"
            href={`/api/kitchen/recipes/${recipe.id}/card?mode=compact&format=pdf`}
            target="_blank"
            rel="noreferrer"
          >
            Kurzfassung (PDF)
          </a>
          <a
            className="family-btn family-btn-sm"
            href={`/api/kitchen/recipes/${recipe.id}/card?mode=set&format=pdf`}
            target="_blank"
            rel="noreferrer"
          >
            Kartenset (PDF)
          </a>
          <a
            className="family-btn family-btn-ghost family-btn-sm"
            href={`/api/kitchen/recipes/${recipe.id}/card?mode=compact&format=html`}
            target="_blank"
            rel="noreferrer"
          >
            Vorschau
          </a>
        </div>
        <form action={formatRecipeForCardAction} style={{ marginTop: "0.75rem" }}>
          <input type="hidden" name="id" value={recipe.id} />
          <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
            Schritte per KI für die Karte kürzen
          </button>
        </form>
        <p className="family-muted">
          Die KI läuft auf dem eigenen Rechner (Maschinenraum). Ist er aus, bleibt das Rezept unverändert —
          drucken lässt es sich trotzdem.
        </p>
      </section>

      <section className="family-section family-print-hide">
        <h2>Bild</h2>
        {recipe.imageStorageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/kitchen/recipes/${recipe.id}/image`}
            alt={recipe.title}
            style={{ maxWidth: "100%", height: "auto", borderRadius: "0.75rem" }}
          />
        ) : (
          <p className="family-muted">Noch kein Bild hinterlegt.</p>
        )}
        <form action={uploadRecipeImageAction} className="family-form family-card">
          <input type="hidden" name="id" value={recipe.id} />
          <label>
            Bild hochladen (PNG, JPEG, GIF, WebP)
            <input name="image" type="file" accept="image/*" required />
          </label>
          <div>
            <button type="submit" className="family-btn family-btn-sm">
              Bild speichern
            </button>
          </div>
        </form>
      </section>

      <section className="family-section family-print-hide">
        <h2>Bearbeiten</h2>
        <form action={updateRecipeAction} className="family-form family-card">
          <input type="hidden" name="id" value={recipe.id} />
          <div className="family-form-row">
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
          </div>
          <label>
            Beschreibung
            <textarea name="description" rows={2} defaultValue={recipe.description} />
          </label>
          <div className="family-form-row">
            <label>
              Portionen
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
              <input name="durationMinutes" type="number" min={0} defaultValue={recipe.durationMinutes ?? ""} />
            </label>
          </div>
          <div className="family-form-row">
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
          </div>
          <label>
            Zutaten — eine pro Zeile, z. B. &bdquo;800 g Tomaten&ldquo;
            <textarea name="ingredients" rows={6} defaultValue={ingredientsText} />
          </label>
          <label>
            Zubereitung — ein Schritt pro Zeile
            <textarea name="steps" rows={5} defaultValue={stepsToText(recipe.steps)} />
          </label>
          <div className="family-form-row">
            <label>
              Tags (kommagetrennt)
              <input name="tags" defaultValue={tagKeys} />
            </label>
            <label>
              Quelle (URL)
              <input name="sourceUrl" type="url" defaultValue={recipe.sourceUrl ?? ""} />
            </label>
          </div>
          <label>
            Notizen
            <textarea name="notes" rows={2} defaultValue={recipe.notes} />
          </label>
          <div>
            <button type="submit" className="family-btn">
              Speichern
            </button>
          </div>
        </form>
      </section>

      {status !== "archived" ? (
        <form action={archiveRecipeAction} className="family-print-hide">
          <input type="hidden" name="id" value={recipe.id} />
          <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
            Rezept archivieren
          </button>
        </form>
      ) : null}
    </FamilyShell>
  );
}
