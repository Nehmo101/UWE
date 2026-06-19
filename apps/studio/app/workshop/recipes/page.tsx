import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  asColorList,
  createLifeAdminService,
  formatColorsForForm,
  prisma,
  WORKSHOP_PAINT_TARGET_LABELS,
  WorkshopPaintTargetEnum,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  createPaintRecipeAction,
  deletePaintRecipeAction,
  updatePaintRecipeAction,
} from "../../workshop-actions";

export default async function WorkshopRecipesPage() {
  const service = createLifeAdminService(prisma);
  const recipes = await service.listWorkshopPaintRecipes({ limit: 200 });

  return (
    <AdminModuleShell
      activePath="/workshop"
      title="Paint-Rezepte"
      summary="Wiederverwendbare Rezepte für Miniaturen, Terrain und Dioramen."
    >
      <p className="uwe-dashboard-muted">
        <Link href="/workshop">← Werkstatt</Link>
      </p>

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Neues Rezept</h2>
        <form action={createPaintRecipeAction} className="uwe-brain-create-form">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Ziel
            <select name="targetType" defaultValue="miniature">
              {Object.values(WorkshopPaintTargetEnum).map((target) => (
                <option key={target} value={target}>
                  {WORKSHOP_PAINT_TARGET_LABELS[target]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grundierung
            <input name="primer" />
          </label>
          <label>
            Basecoat
            <input name="basecoat" />
          </label>
          <label>
            Wash/Shade
            <input name="wash" />
          </label>
          <label>
            Highlights
            <input name="highlights" />
          </label>
          <label>
            Farben
            <textarea name="colorsUsed" rows={2} placeholder="Citadel: Macragge Blue" />
          </label>
          <label>
            Ergebnisfoto-URL
            <input name="resultPhotoUrl" type="url" />
          </label>
          <label>
            Bewertung (1–5)
            <input name="rating" type="number" min={1} max={5} />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <button type="submit" className="uwe-btn uwe-btn-primary">
            Rezept anlegen
          </button>
        </form>
      </section>

      <section className="uwe-section">
        <h2 className="uwe-section-title">Bibliothek ({recipes.length})</h2>
        {recipes.length === 0 ? (
          <EmptyState
            title="Noch keine Paint-Rezepte"
            description="Speichere erfolgreiche Farbabläufe für spätere Projekte."
          />
        ) : (
          <div className="uwe-today-card-list">
            {recipes.map((recipe) => (
              <article key={recipe.id} className="uwe-today-card">
                <form action={updatePaintRecipeAction} className="uwe-brain-create-form">
                  <input type="hidden" name="id" value={recipe.id} />
                  <input
                    type="hidden"
                    name="workshopProjectId"
                    value={recipe.workshopProjectId ?? ""}
                  />
                  <label>
                    Name
                    <input name="name" defaultValue={recipe.name} required />
                  </label>
                  <label>
                    Ziel
                    <select name="targetType" defaultValue={recipe.targetType}>
                      {Object.values(WorkshopPaintTargetEnum).map((target) => (
                        <option key={target} value={target}>
                          {WORKSHOP_PAINT_TARGET_LABELS[target]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Grundierung
                    <input name="primer" defaultValue={recipe.primer} />
                  </label>
                  <label>
                    Basecoat
                    <input name="basecoat" defaultValue={recipe.basecoat} />
                  </label>
                  <label>
                    Wash
                    <input name="wash" defaultValue={recipe.wash} />
                  </label>
                  <label>
                    Highlights
                    <input name="highlights" defaultValue={recipe.highlights} />
                  </label>
                  <label>
                    Farben
                    <textarea
                      name="colorsUsed"
                      rows={2}
                      defaultValue={formatColorsForForm(recipe.colorsUsed)}
                    />
                  </label>
                  <label>
                    Ergebnisfoto
                    <input name="resultPhotoUrl" type="url" defaultValue={recipe.resultPhotoUrl ?? ""} />
                  </label>
                  <label>
                    Bewertung
                    <input
                      name="rating"
                      type="number"
                      min={1}
                      max={5}
                      defaultValue={recipe.rating ?? ""}
                    />
                  </label>
                  <label>
                    Notizen
                    <textarea name="notes" rows={2} defaultValue={recipe.notes} />
                  </label>
                  {recipe.workshopProject && (
                    <p className="uwe-dashboard-muted">
                      Projekt:{" "}
                      <Link href={`/workshop/${recipe.workshopProject.id}`}>
                        {recipe.workshopProject.title}
                      </Link>
                    </p>
                  )}
                  <p className="uwe-dashboard-muted">
                    Farben:{" "}
                    {asColorList(recipe.colorsUsed)
                      .map((c) => c.name)
                      .join(", ") || "—"}
                  </p>
                  {recipe.resultPhotoUrl && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                      src={recipe.resultPhotoUrl}
                      alt=""
                      style={{ maxWidth: 120, borderRadius: 8 }}
                    />
                    </>
                  )}
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Speichern
                  </button>
                </form>
                <form action={deletePaintRecipeAction}>
                  <input type="hidden" name="id" value={recipe.id} />
                  <input type="hidden" name="returnTo" value="/workshop/recipes" />
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Löschen
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminModuleShell>
  );
}
