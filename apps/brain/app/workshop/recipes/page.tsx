import Link from "next/link";
import {
  createLifeAdminService,
  parseStringArray,
  prisma,
  WORKSHOP_PAINT_TARGET_LABELS,
  WorkshopPaintTargetEnum,
  type WorkshopPaintTarget,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  createPaintRecipeAction,
  deletePaintRecipeAction,
  updatePaintRecipeAction,
} from "../../workshop-actions";

/** Farbrezepte — Grundierung, Basis, Wash, Highlights, mit Bewertung. */

export const dynamic = "force-dynamic";

const TARGETS = Object.values(WorkshopPaintTargetEnum) as WorkshopPaintTarget[];

function TargetSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <label>
      Ziel
      <select name="targetType" defaultValue={defaultValue}>
        {TARGETS.map((target) => (
          <option key={target} value={target}>
            {WORKSHOP_PAINT_TARGET_LABELS[target] ?? target}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function BrainPaintRecipesPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/workshop" title="Farbrezepte">
        <BrainDenied />
      </BrainShell>
    );
  }

  const service = createLifeAdminService(brainPrisma, prisma);
  const [recipes, projects] = await Promise.all([
    service.listWorkshopPaintRecipes({ limit: 200 }),
    service.listWorkshopProjects({ limit: 200 }),
  ]);

  return (
    <BrainShell
      active="/workshop"
      title="Farbrezepte"
      lede={`${recipes.length} Rezept(e) — was hat funktioniert, und in welcher Reihenfolge.`}
      actions={
        <Link className="brain-btn brain-btn-ghost brain-btn-sm" href="/workshop">
          ← Werkstatt
        </Link>
      }
    >
      <section className="brain-section">
        <h2>Neues Rezept</h2>
        <form action={createPaintRecipeAction} className="brain-form brain-card">
          <div className="brain-form-row">
            <label>
              Name
              <input name="name" required placeholder="z. B. Ultramarines Blau" />
            </label>
            <TargetSelect defaultValue="miniature" />
            <label>
              Bewertung (1–5)
              <input name="rating" type="number" min={1} max={5} />
            </label>
          </div>
          <div className="brain-form-row">
            <label>
              Grundierung
              <input name="primer" />
            </label>
            <label>
              Basis
              <input name="basecoat" />
            </label>
            <label>
              Wash
              <input name="wash" />
            </label>
            <label>
              Highlights
              <input name="highlights" />
            </label>
          </div>
          <label>
            Farben (eine Zeile pro Farbe)
            <textarea name="colorsUsed" rows={3} />
          </label>
          <label>
            Projekt (optional)
            <select name="workshopProjectId" defaultValue="">
              <option value="">— keins —</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Rezept speichern
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Rezepte · {recipes.length}</h2>
        {recipes.length === 0 ? (
          <p className="brain-muted">Noch keine Rezepte.</p>
        ) : (
          <ul className="brain-list">
            {recipes.map((recipe) => {
              const colors = parseStringArray(recipe.colorsUsed);
              return (
                <li key={recipe.id} className="brain-row">
                  <div className="brain-row-head">
                    <strong>{recipe.name}</strong>
                    <span className="brain-tag">
                      {WORKSHOP_PAINT_TARGET_LABELS[recipe.targetType] ?? recipe.targetType}
                    </span>
                    {recipe.rating ? (
                      <span className="brain-muted">{"★".repeat(recipe.rating)}</span>
                    ) : null}
                    <form action={deletePaintRecipeAction} style={{ marginLeft: "auto" }}>
                      <input type="hidden" name="id" value={recipe.id} />
                      <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                        Löschen
                      </button>
                    </form>
                  </div>
                  <p className="brain-muted">
                    {[
                      recipe.primer && `Grundierung: ${recipe.primer}`,
                      recipe.basecoat && `Basis: ${recipe.basecoat}`,
                      recipe.wash && `Wash: ${recipe.wash}`,
                      recipe.highlights && `Highlights: ${recipe.highlights}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Keine Schritte hinterlegt."}
                  </p>
                  {colors.length > 0 ? (
                    <p className="brain-muted">Farben: {colors.join(" · ")}</p>
                  ) : null}
                  {recipe.notes ? <p>{recipe.notes}</p> : null}

                  <details className="brain-edit">
                    <summary>Bearbeiten</summary>
                    <form action={updatePaintRecipeAction} className="brain-form">
                      <input type="hidden" name="id" value={recipe.id} />
                      <div className="brain-form-row">
                        <label>
                          Name
                          <input name="name" defaultValue={recipe.name} required />
                        </label>
                        <TargetSelect defaultValue={recipe.targetType} />
                        <label>
                          Bewertung (1–5)
                          <input
                            name="rating"
                            type="number"
                            min={1}
                            max={5}
                            defaultValue={recipe.rating ?? ""}
                          />
                        </label>
                      </div>
                      <div className="brain-form-row">
                        <label>
                          Grundierung
                          <input name="primer" defaultValue={recipe.primer} />
                        </label>
                        <label>
                          Basis
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
                      </div>
                      <label>
                        Farben
                        <textarea name="colorsUsed" rows={3} defaultValue={colors.join("\n")} />
                      </label>
                      <label>
                        Notizen
                        <textarea name="notes" rows={2} defaultValue={recipe.notes} />
                      </label>
                      <div>
                        <button type="submit" className="brain-btn brain-btn-sm">
                          Speichern
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
