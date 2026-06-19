import Link from "next/link";
import { notFound } from "next/navigation";
import {
  asColorList,
  asLinkList,
  asMaterialList,
  asPhotoList,
  createLifeAdminService,
  formatColorsForForm,
  formatFilamentsForForm,
  formatLinksForForm,
  formatMaterialsForForm,
  formatPhotosForForm,
  formatEuroFromCents,
  prisma,
  WORKSHOP_PAINT_TARGET_LABELS,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_TYPE_LABELS,
  WorkshopPaintTargetEnum,
  WorkshopProjectTypeEnum,
  WorkshopStatusEnum,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  createPaintRecipeAction,
  createPrintProfileAction,
  deletePaintRecipeAction,
  deletePrintProfileAction,
  deleteWorkshopAction,
  updateWorkshopAction,
} from "../../workshop-actions";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function WorkshopDetailPage({ params }: Props) {
  const { id } = await params;
  const service = createLifeAdminService(prisma);
  const workshop = await service.getWorkshopProject(id);

  if (!workshop) notFound();

  const captureLinks = await service.listLinksForTarget("workshop_project", id);

  return (
    <AdminModuleShell
      activePath="/workshop"
      title={workshop.title}
      summary={`${WORKSHOP_TYPE_LABELS[workshop.projectType]} · ${WORKSHOP_STATUS_LABELS[workshop.status]}`}
    >
      <p className="uwe-dashboard-muted">
        <Link href="/workshop">← Alle Projekte</Link>
        {" · "}
        <Link href="/workshop/recipes">Paint-Rezepte</Link>
        {" · "}
        <Link href="/workshop/print-profiles">Druck-Profile</Link>
      </p>

      {workshop.nextAction && (
        <section className="uwe-card uwe-section">
          <h2 className="uwe-section-title">Nächster Schritt</h2>
          <p>{workshop.nextAction}</p>
        </section>
      )}

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Projekt bearbeiten</h2>
        <form action={updateWorkshopAction} className="uwe-brain-create-form">
          <input type="hidden" name="id" value={workshop.id} />
          <label>
            Titel
            <input name="title" defaultValue={workshop.title} required />
          </label>
          <label>
            Typ
            <select name="projectType" defaultValue={workshop.projectType}>
              {Object.values(WorkshopProjectTypeEnum).map((type) => (
                <option key={type} value={type}>
                  {WORKSHOP_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={workshop.status}>
              {Object.values(WorkshopStatusEnum).map((status) => (
                <option key={status} value={status}>
                  {WORKSHOP_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nächster Schritt
            <input name="nextAction" defaultValue={workshop.nextAction ?? ""} />
          </label>
          <label>
            Beschreibung
            <textarea name="description" rows={3} defaultValue={workshop.description} />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} defaultValue={workshop.notes} />
          </label>
          <label>
            Kosten (Cent)
            <input name="costCents" type="number" min={0} defaultValue={workshop.costCents ?? ""} />
          </label>

          <h3>Materialien</h3>
          <label>
            Benötigt (Name | Menge | ja/nein)
            <textarea
              name="materialsNeeded"
              rows={4}
              defaultValue={formatMaterialsForForm(workshop.materialsNeeded)}
            />
          </label>
          <label>
            Verwendet
            <textarea
              name="materialsUsed"
              rows={3}
              defaultValue={formatMaterialsForForm(workshop.materialsUsed)}
            />
          </label>

          <h3>Farben & Filamente</h3>
          <label>
            Farben (Marke: Name (Code))
            <textarea name="colorsUsed" rows={3} defaultValue={formatColorsForForm(workshop.colorsUsed)} />
          </label>
          <label>
            Filamente (Material | Marke | Farbe | Spule)
            <textarea
              name="filamentsUsed"
              rows={3}
              defaultValue={formatFilamentsForForm(workshop.filamentsUsed)}
            />
          </label>

          <h3>Links & Bilder</h3>
          <label>
            STL / Shop / Referenz (Label | URL | stl/shop/reference)
            <textarea name="stlLinks" rows={3} defaultValue={formatLinksForForm(workshop.stlLinks)} />
          </label>
          <label>
            Referenzbilder (URL | Beschriftung)
            <textarea
              name="referenceImages"
              rows={3}
              defaultValue={formatPhotosForForm(workshop.referenceImages)}
            />
          </label>
          <label>
            Fortschrittsfotos
            <textarea
              name="progressPhotos"
              rows={3}
              defaultValue={formatPhotosForForm(workshop.progressPhotos)}
            />
          </label>
          <label>
            Ergebnisfotos
            <textarea
              name="resultPhotos"
              rows={3}
              defaultValue={formatPhotosForForm(workshop.resultPhotos)}
            />
          </label>
          <label>
            Galerie
            <textarea
              name="imageGallery"
              rows={2}
              defaultValue={formatPhotosForForm(workshop.imageGallery)}
            />
          </label>

          <button type="submit" className="uwe-btn uwe-btn-primary">
            Speichern
          </button>
        </form>
      </section>

      <section className="uwe-section">
        <h2 className="uwe-section-title">Übersicht</h2>
        <div className="uwe-dashboard-grid">
          <article className="uwe-card uwe-dashboard-card">
            <h3>Material</h3>
            <ul>
              {asMaterialList(workshop.materialsNeeded).map((entry) => (
                <li key={`need-${entry.name}`}>
                  {entry.name}
                  {entry.quantity ? ` (${entry.quantity})` : ""}
                  {entry.acquired === false ? " — fehlt" : entry.acquired ? " — da" : ""}
                </li>
              ))}
            </ul>
          </article>
          <article className="uwe-card uwe-dashboard-card">
            <h3>Farben</h3>
            <ul>
              {asColorList(workshop.colorsUsed).map((entry) => (
                <li key={`${entry.brand}-${entry.name}`}>
                  {entry.brand ? `${entry.brand}: ` : ""}
                  {entry.name}
                  {entry.code ? ` (${entry.code})` : ""}
                </li>
              ))}
            </ul>
          </article>
          <article className="uwe-card uwe-dashboard-card">
            <h3>Links</h3>
            <ul>
              {asLinkList(workshop.stlLinks).map((entry) => (
                <li key={entry.url}>
                  <a href={entry.url} target="_blank" rel="noreferrer">
                    {entry.label}
                  </a>
                </li>
              ))}
            </ul>
          </article>
          <article className="uwe-card uwe-dashboard-card">
            <h3>Kosten</h3>
            <p>{workshop.costCents != null ? formatEuroFromCents(workshop.costCents) : "—"}</p>
          </article>
        </div>
      </section>

      <section className="uwe-section">
        <h2 className="uwe-section-title">Bilder</h2>
        <div className="uwe-dashboard-grid">
          {(
            [
              ["Referenz", workshop.referenceImages],
              ["Fortschritt", workshop.progressPhotos],
              ["Ergebnis", workshop.resultPhotos],
            ] as const
          ).map(([label, photos]) => (
            <article key={String(label)} className="uwe-card uwe-dashboard-card">
              <h3>{label}</h3>
              {asPhotoList(photos).map((photo) => (
                <figure key={photo.url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption || String(label)}
                    style={{ maxWidth: "100%", borderRadius: 8 }}
                  />
                  {photo.caption && <figcaption>{photo.caption}</figcaption>}
                </figure>
              ))}
            </article>
          ))}
        </div>
      </section>

      {captureLinks.length > 0 && (
        <section className="uwe-card uwe-section">
          <h2 className="uwe-section-title">Capture-Verknüpfungen</h2>
          <ul>
            {captureLinks.map((link) => (
              <li key={link.id}>
                Capture {link.sourceId} ({link.relationType})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Paint-Rezept für dieses Projekt</h2>
        <form action={createPaintRecipeAction} className="uwe-brain-create-form">
          <input type="hidden" name="workshopProjectId" value={workshop.id} />
          <label>
            Name
            <input name="name" required placeholder="z. B. Wald-Basis Miniatur" />
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
            Farben (Marke: Name)
            <textarea name="colorsUsed" rows={2} />
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
          <button type="submit" className="uwe-btn uwe-btn-secondary">
            Rezept speichern
          </button>
        </form>

        {workshop.paintRecipes.length > 0 && (
          <div className="uwe-today-card-list uwe-section">
            {workshop.paintRecipes.map((recipe) => (
              <article key={recipe.id} className="uwe-today-card">
                <h3>{recipe.name}</h3>
                <p>
                  {WORKSHOP_PAINT_TARGET_LABELS[recipe.targetType]}
                  {recipe.rating ? ` · ★ ${recipe.rating}/5` : ""}
                </p>
                <p>
                  Grundierung: {recipe.primer || "—"} · Base: {recipe.basecoat || "—"} · Wash:{" "}
                  {recipe.wash || "—"} · Highlights: {recipe.highlights || "—"}
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
                <form action={deletePaintRecipeAction}>
                  <input type="hidden" name="id" value={recipe.id} />
                  <input type="hidden" name="returnTo" value={`/workshop/${workshop.id}`} />
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Rezept löschen
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">3D-Druck-Profil</h2>
        <form action={createPrintProfileAction} className="uwe-brain-create-form">
          <input type="hidden" name="workshopProjectId" value={workshop.id} />
          <label>
            Bezeichnung
            <input name="name" placeholder="z. B. Terrain-Tile v2" />
          </label>
          <label>
            Drucker
            <input name="printer" />
          </label>
          <label>
            Düse
            <input name="nozzle" placeholder="0.4 mm" />
          </label>
          <label>
            Filament
            <input name="filament" />
          </label>
          <label>
            Layerhöhe
            <input name="layerHeight" placeholder="0.2 mm" />
          </label>
          <label>
            Support
            <input name="supports" />
          </label>
          <label>
            Ergebnis
            <input name="result" placeholder="gut / mittel / schlecht" />
          </label>
          <label>
            Fehler
            <textarea name="errors" rows={2} />
          </label>
          <label>
            Verbesserung
            <textarea name="improvements" rows={2} />
          </label>
          <button type="submit" className="uwe-btn uwe-btn-secondary">
            Profil speichern
          </button>
        </form>

        {workshop.printProfiles.length > 0 && (
          <div className="uwe-today-card-list uwe-section">
            {workshop.printProfiles.map((profile) => (
              <article key={profile.id} className="uwe-today-card">
                <h3>{profile.name || "Drucklauf"}</h3>
                <p>
                  {profile.printer} · {profile.nozzle} · {profile.filament} · Layer{" "}
                  {profile.layerHeight}
                </p>
                <p>Support: {profile.supports || "—"} · Ergebnis: {profile.result || "—"}</p>
                {profile.errors && <p>Fehler: {profile.errors}</p>}
                {profile.improvements && <p>Verbesserung: {profile.improvements}</p>}
                <form action={deletePrintProfileAction}>
                  <input type="hidden" name="id" value={profile.id} />
                  <input type="hidden" name="returnTo" value={`/workshop/${workshop.id}`} />
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Profil löschen
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <form action={deleteWorkshopAction}>
        <input type="hidden" name="id" value={workshop.id} />
        <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
          Projekt löschen
        </button>
      </form>
    </AdminModuleShell>
  );
}
