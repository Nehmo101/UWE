import Link from "next/link";
import { notFound } from "next/navigation";
import { brainPrisma } from "@uwe/database/brain-client";
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
import {
  StudioShell,
  PageHeader,
  BreadcrumbTrail,
} from "@/src/components/shell";
import {
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
import {
  createPaintRecipeAction,
  createPrintProfileAction,
  deletePaintRecipeAction,
  deletePrintProfileAction,
  deleteWorkshopAction,
  updateWorkshopAction,
} from "../../workshop-actions";
import { WorkshopPhotoUploadField } from "../WorkshopPhotoUploadField";

interface Props {
  params: Promise<{ id: string }>;
}

const LIST_CARD_CLASS =
  "flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm";

export default async function WorkshopDetailPage({ params }: Props) {
  const { id } = await params;
  const service = createLifeAdminService(brainPrisma, prisma);
  const workshop = await service.getWorkshopProject(id);

  if (!workshop) notFound();

  const captureLinks = await service.listLinksForTarget("workshop_project", id);

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Werkstatt", href: "/workshop" },
            { label: workshop.title },
          ]}
        />
      }
    >
      <PageHeader
        title={workshop.title}
        summary={`${WORKSHOP_TYPE_LABELS[workshop.projectType]} · ${WORKSHOP_STATUS_LABELS[workshop.status]}`}
      />

      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          <Link href="/workshop">← Alle Projekte</Link>
          {" · "}
          <Link href="/workshop/recipes">Paint-Rezepte</Link>
          {" · "}
          <Link href="/workshop/print-profiles">Druck-Profile</Link>
        </p>

        {workshop.nextAction && (
          <Card>
            <CardHeader>
              <CardTitle>Nächster Schritt</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{workshop.nextAction}</p>
            </CardContent>
          </Card>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Übersicht</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Material</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {asMaterialList(workshop.materialsNeeded).map((entry) => (
                    <li key={`need-${entry.name}`}>
                      {entry.name}
                      {entry.quantity ? ` (${entry.quantity})` : ""}
                      {entry.acquired === false
                        ? " — fehlt"
                        : entry.acquired
                          ? " — da"
                          : ""}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Farben</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {asColorList(workshop.colorsUsed).map((entry) => (
                    <li key={`${entry.brand}-${entry.name}`}>
                      {entry.brand ? `${entry.brand}: ` : ""}
                      {entry.name}
                      {entry.code ? ` (${entry.code})` : ""}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Links</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {asLinkList(workshop.stlLinks).map((entry) => (
                    <li key={entry.url}>
                      <a href={entry.url} target="_blank" rel="noreferrer">
                        {entry.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kosten</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {workshop.costCents != null
                    ? formatEuroFromCents(workshop.costCents)
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Bilder</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["Referenz", workshop.referenceImages],
                ["Fortschritt", workshop.progressPhotos],
                ["Ergebnis", workshop.resultPhotos],
              ] as const
            ).map(([label, photos]) => (
              <Card key={String(label)}>
                <CardHeader>
                  <CardTitle className="text-base">{label}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {asPhotoList(photos).map((photo) => (
                    <figure key={photo.url} className="flex flex-col gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption || String(label)}
                        className="max-w-full rounded-lg"
                      />
                      {photo.caption && (
                        <figcaption className="text-sm text-muted-foreground">
                          {photo.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {captureLinks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Capture-Verknüpfungen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm">
                {captureLinks.map((link) => (
                  <li key={link.id}>
                    Capture {link.sourceId} ({link.relationType})
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <details className="rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground shadow-sm">
          <summary className="cursor-pointer text-sm font-medium">
            Bearbeiten
          </summary>
          <form
            action={updateWorkshopAction}
            className="mt-3 flex flex-col gap-3"
          >
            <input type="hidden" name="id" value={workshop.id} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-title">Titel</Label>
              <Input
                id="workshop-edit-title"
                name="title"
                defaultValue={workshop.title}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-project-type">Typ</Label>
              <Select name="projectType" defaultValue={workshop.projectType}>
                <SelectTrigger id="workshop-edit-project-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(WorkshopProjectTypeEnum).map((type) => (
                    <SelectItem key={type} value={type}>
                      {WORKSHOP_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-status">Status</Label>
              <Select name="status" defaultValue={workshop.status}>
                <SelectTrigger id="workshop-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(WorkshopStatusEnum).map((status) => (
                    <SelectItem key={status} value={status}>
                      {WORKSHOP_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-next-action">
                Nächster Schritt
              </Label>
              <Input
                id="workshop-edit-next-action"
                name="nextAction"
                defaultValue={workshop.nextAction ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-description">Beschreibung</Label>
              <Textarea
                id="workshop-edit-description"
                name="description"
                rows={3}
                defaultValue={workshop.description}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-notes">Notizen</Label>
              <Textarea
                id="workshop-edit-notes"
                name="notes"
                rows={2}
                defaultValue={workshop.notes}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-cost-cents">Kosten (Cent)</Label>
              <Input
                id="workshop-edit-cost-cents"
                name="costCents"
                type="number"
                min={0}
                defaultValue={workshop.costCents ?? ""}
              />
            </div>

            <h3 className="text-base font-semibold tracking-tight">
              Materialien
            </h3>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-materials-needed">
                Benötigt (Name | Menge | ja/nein)
              </Label>
              <Textarea
                id="workshop-edit-materials-needed"
                name="materialsNeeded"
                rows={4}
                defaultValue={formatMaterialsForForm(workshop.materialsNeeded)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-materials-used">Verwendet</Label>
              <Textarea
                id="workshop-edit-materials-used"
                name="materialsUsed"
                rows={3}
                defaultValue={formatMaterialsForForm(workshop.materialsUsed)}
              />
            </div>

            <h3 className="text-base font-semibold tracking-tight">
              Farben & Filamente
            </h3>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-colors-used">
                Farben (Marke: Name (Code))
              </Label>
              <Textarea
                id="workshop-edit-colors-used"
                name="colorsUsed"
                rows={3}
                defaultValue={formatColorsForForm(workshop.colorsUsed)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-filaments-used">
                Filamente (Material | Marke | Farbe | Spule)
              </Label>
              <Textarea
                id="workshop-edit-filaments-used"
                name="filamentsUsed"
                rows={3}
                defaultValue={formatFilamentsForForm(workshop.filamentsUsed)}
              />
            </div>

            <h3 className="text-base font-semibold tracking-tight">
              Links & Bilder
            </h3>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-stl-links">
                STL / Shop / Referenz (Label | URL | stl/shop/reference)
              </Label>
              <Textarea
                id="workshop-edit-stl-links"
                name="stlLinks"
                rows={3}
                defaultValue={formatLinksForForm(workshop.stlLinks)}
              />
            </div>
            <WorkshopPhotoUploadField
              workshopId={workshop.id}
              category="reference"
              label="Referenzbilder (URL | Beschriftung)"
              textareaName="referenceImages"
              defaultValue={formatPhotosForForm(workshop.referenceImages)}
            />
            <WorkshopPhotoUploadField
              workshopId={workshop.id}
              category="progress"
              label="Fortschrittsfotos"
              textareaName="progressPhotos"
              defaultValue={formatPhotosForForm(workshop.progressPhotos)}
            />
            <WorkshopPhotoUploadField
              workshopId={workshop.id}
              category="result"
              label="Ergebnisfotos"
              textareaName="resultPhotos"
              defaultValue={formatPhotosForForm(workshop.resultPhotos)}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workshop-edit-image-gallery">Galerie</Label>
              <Textarea
                id="workshop-edit-image-gallery"
                name="imageGallery"
                rows={2}
                defaultValue={formatPhotosForForm(workshop.imageGallery)}
              />
            </div>

            <div>
              <Button type="submit">Speichern</Button>
            </div>
          </form>
          <form action={deleteWorkshopAction} className="mt-4">
            <input type="hidden" name="id" value={workshop.id} />
            <Button type="submit" variant="destructive">
              Projekt löschen
            </Button>
          </form>
        </details>

        <Card>
          <CardHeader>
            <CardTitle>Paint-Rezept für dieses Projekt</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form
              action={createPaintRecipeAction}
              className="flex flex-col gap-3"
            >
              <input
                type="hidden"
                name="workshopProjectId"
                value={workshop.id}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-recipe-name">Name</Label>
                <Input
                  id="workshop-recipe-name"
                  name="name"
                  required
                  placeholder="z. B. Wald-Basis Miniatur"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-recipe-target">Ziel</Label>
                <Select name="targetType" defaultValue="miniature">
                  <SelectTrigger id="workshop-recipe-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(WorkshopPaintTargetEnum).map((target) => (
                      <SelectItem key={target} value={target}>
                        {WORKSHOP_PAINT_TARGET_LABELS[target]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-recipe-primer">Grundierung</Label>
                <Input id="workshop-recipe-primer" name="primer" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-recipe-basecoat">Basecoat</Label>
                <Input id="workshop-recipe-basecoat" name="basecoat" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-recipe-wash">Wash/Shade</Label>
                <Input id="workshop-recipe-wash" name="wash" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-recipe-highlights">Highlights</Label>
                <Input id="workshop-recipe-highlights" name="highlights" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-recipe-colors">
                  Farben (Marke: Name)
                </Label>
                <Textarea
                  id="workshop-recipe-colors"
                  name="colorsUsed"
                  rows={2}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-recipe-photo">Ergebnisfoto-URL</Label>
                <Input
                  id="workshop-recipe-photo"
                  name="resultPhotoUrl"
                  type="url"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-recipe-rating">Bewertung (1–5)</Label>
                <Input
                  id="workshop-recipe-rating"
                  name="rating"
                  type="number"
                  min={1}
                  max={5}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-recipe-notes">Notizen</Label>
                <Textarea id="workshop-recipe-notes" name="notes" rows={2} />
              </div>
              <div>
                <Button type="submit" variant="secondary">
                  Rezept speichern
                </Button>
              </div>
            </form>

            {workshop.paintRecipes.length > 0 && (
              <ul className="grid gap-2">
                {workshop.paintRecipes.map((recipe) => (
                  <li key={recipe.id} className={LIST_CARD_CLASS}>
                    <h3 className="font-semibold">{recipe.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {WORKSHOP_PAINT_TARGET_LABELS[recipe.targetType]}
                      {recipe.rating ? ` · ★ ${recipe.rating}/5` : ""}
                    </p>
                    <p className="text-sm">
                      Grundierung: {recipe.primer || "—"} · Base:{" "}
                      {recipe.basecoat || "—"} · Wash: {recipe.wash || "—"} ·
                      Highlights: {recipe.highlights || "—"}
                    </p>
                    {recipe.resultPhotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={recipe.resultPhotoUrl}
                        alt=""
                        className="max-w-[120px] rounded-lg"
                      />
                    )}
                    <form action={deletePaintRecipeAction}>
                      <input type="hidden" name="id" value={recipe.id} />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={`/workshop/${workshop.id}`}
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        Rezept löschen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3D-Druck-Profil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form
              action={createPrintProfileAction}
              className="flex flex-col gap-3"
            >
              <input
                type="hidden"
                name="workshopProjectId"
                value={workshop.id}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-print-name">Bezeichnung</Label>
                <Input
                  id="workshop-print-name"
                  name="name"
                  placeholder="z. B. Terrain-Tile v2"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-print-printer">Drucker</Label>
                <Input id="workshop-print-printer" name="printer" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-print-nozzle">Düse</Label>
                <Input
                  id="workshop-print-nozzle"
                  name="nozzle"
                  placeholder="0.4 mm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-print-filament">Filament</Label>
                <Input id="workshop-print-filament" name="filament" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-print-layer-height">Layerhöhe</Label>
                <Input
                  id="workshop-print-layer-height"
                  name="layerHeight"
                  placeholder="0.2 mm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-print-supports">Support</Label>
                <Input id="workshop-print-supports" name="supports" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-print-result">Ergebnis</Label>
                <Input
                  id="workshop-print-result"
                  name="result"
                  placeholder="gut / mittel / schlecht"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-print-errors">Fehler</Label>
                <Textarea id="workshop-print-errors" name="errors" rows={2} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-print-improvements">
                  Verbesserung
                </Label>
                <Textarea
                  id="workshop-print-improvements"
                  name="improvements"
                  rows={2}
                />
              </div>
              <div>
                <Button type="submit" variant="secondary">
                  Profil speichern
                </Button>
              </div>
            </form>

            {workshop.printProfiles.length > 0 && (
              <ul className="grid gap-2">
                {workshop.printProfiles.map((profile) => (
                  <li key={profile.id} className={LIST_CARD_CLASS}>
                    <h3 className="font-semibold">
                      {profile.name || "Drucklauf"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {profile.printer} · {profile.nozzle} · {profile.filament}{" "}
                      · Layer {profile.layerHeight}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Support: {profile.supports || "—"} · Ergebnis:{" "}
                      {profile.result || "—"}
                    </p>
                    {profile.errors && (
                      <p className="text-sm">Fehler: {profile.errors}</p>
                    )}
                    {profile.improvements && (
                      <p className="text-sm">
                        Verbesserung: {profile.improvements}
                      </p>
                    )}
                    <form action={deletePrintProfileAction}>
                      <input type="hidden" name="id" value={profile.id} />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={`/workshop/${workshop.id}`}
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        Profil löschen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </StudioShell>
  );
}
