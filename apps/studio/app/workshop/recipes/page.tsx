import Link from "next/link";
import {
  asColorList,
  createLifeAdminService,
  formatColorsForForm,
  prisma,
  WORKSHOP_PAINT_TARGET_LABELS,
  WorkshopPaintTargetEnum,
} from "@uwe/database/server";
import {
  StudioShell,
  PageHeader,
  BreadcrumbTrail,
} from "@/src/components/shell";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
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
  deletePaintRecipeAction,
  updatePaintRecipeAction,
} from "../../workshop-actions";

const LIST_CARD_CLASS =
  "flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm";

export default async function WorkshopRecipesPage() {
  const service = createLifeAdminService(prisma);
  const recipes = await service.listWorkshopPaintRecipes({ limit: 200 });

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Werkstatt", href: "/workshop" },
            { label: "Paint-Anleitungen" },
          ]}
        />
      }
    >
      <PageHeader
        title="Paint-Anleitungen"
        summary="Wiederverwendbare Anleitungen für Miniaturen, Terrain und Dioramen."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="pt-6">
            <details open={recipes.length === 0}>
              <summary className="cursor-pointer font-semibold">
                + Neue Anleitung
              </summary>
              <form
                action={createPaintRecipeAction}
                className="mt-4 flex flex-col gap-3"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-name">Name</Label>
                  <Input id="recipe-new-name" name="name" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-target">Ziel</Label>
                  <Select name="targetType" defaultValue="miniature">
                    <SelectTrigger id="recipe-new-target">
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
                  <Label htmlFor="recipe-new-primer">Grundierung</Label>
                  <Input id="recipe-new-primer" name="primer" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-basecoat">Basecoat</Label>
                  <Input id="recipe-new-basecoat" name="basecoat" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-wash">Wash/Shade</Label>
                  <Input id="recipe-new-wash" name="wash" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-highlights">Highlights</Label>
                  <Input id="recipe-new-highlights" name="highlights" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-colors">Farben</Label>
                  <Textarea
                    id="recipe-new-colors"
                    name="colorsUsed"
                    rows={2}
                    placeholder="Citadel: Macragge Blue"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-photo">Ergebnisfoto-URL</Label>
                  <Input
                    id="recipe-new-photo"
                    name="resultPhotoUrl"
                    type="url"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-rating">Bewertung (1–5)</Label>
                  <Input
                    id="recipe-new-rating"
                    name="rating"
                    type="number"
                    min={1}
                    max={5}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipe-new-notes">Notizen</Label>
                  <Textarea id="recipe-new-notes" name="notes" rows={2} />
                </div>
                <div>
                  <Button type="submit">Anleitung anlegen</Button>
                </div>
              </form>
            </details>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Bibliothek ({recipes.length})
          </h2>
          {recipes.length === 0 ? (
            <EmptyState
              title="Noch keine Paint-Anleitungen"
              description="Speichere erfolgreiche Farbabläufe für spätere Projekte."
            />
          ) : (
            <ul className="grid gap-2">
              {recipes.map((recipe) => {
                const steps = [
                  ["Grundierung", recipe.primer],
                  ["Basecoat", recipe.basecoat],
                  ["Wash", recipe.wash],
                  ["Highlights", recipe.highlights],
                ].filter(([, value]) => value.trim().length > 0);
                const colors = asColorList(recipe.colorsUsed)
                  .map((c) => c.name)
                  .join(", ");

                return (
                  <li key={recipe.id} className={LIST_CARD_CLASS}>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{recipe.name}</strong>
                      <Badge variant="default">
                        {WORKSHOP_PAINT_TARGET_LABELS[recipe.targetType]}
                      </Badge>
                      {recipe.rating != null && (
                        <Badge variant="secondary">★ {recipe.rating}/5</Badge>
                      )}
                    </div>
                    {steps.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {steps
                          .map(([label, value]) => `${label}: ${value}`)
                          .join(" · ")}
                      </p>
                    )}
                    {colors && <p className="text-sm">Farben: {colors}</p>}
                    {recipe.workshopProject && (
                      <p className="text-sm">
                        Projekt:{" "}
                        <Link href={`/workshop/${recipe.workshopProject.id}`}>
                          {recipe.workshopProject.title}
                        </Link>
                      </p>
                    )}
                    {recipe.notes.trim() && (
                      <p className="text-sm">{recipe.notes}</p>
                    )}
                    {recipe.resultPhotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={recipe.resultPhotoUrl}
                        alt=""
                        className="max-w-[120px] rounded-lg"
                      />
                    )}
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">
                        Bearbeiten
                      </summary>
                      <form
                        action={updatePaintRecipeAction}
                        className="mt-3 flex flex-col gap-3"
                      >
                        <input type="hidden" name="id" value={recipe.id} />
                        <input
                          type="hidden"
                          name="workshopProjectId"
                          value={recipe.workshopProjectId ?? ""}
                        />
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`recipe-${recipe.id}-name`}>
                            Name
                          </Label>
                          <Input
                            id={`recipe-${recipe.id}-name`}
                            name="name"
                            defaultValue={recipe.name}
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`recipe-${recipe.id}-target`}>
                            Ziel
                          </Label>
                          <Select
                            name="targetType"
                            defaultValue={recipe.targetType}
                          >
                            <SelectTrigger id={`recipe-${recipe.id}-target`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(WorkshopPaintTargetEnum).map(
                                (target) => (
                                  <SelectItem key={target} value={target}>
                                    {WORKSHOP_PAINT_TARGET_LABELS[target]}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`recipe-${recipe.id}-primer`}>
                            Grundierung
                          </Label>
                          <Input
                            id={`recipe-${recipe.id}-primer`}
                            name="primer"
                            defaultValue={recipe.primer}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`recipe-${recipe.id}-basecoat`}>
                            Basecoat
                          </Label>
                          <Input
                            id={`recipe-${recipe.id}-basecoat`}
                            name="basecoat"
                            defaultValue={recipe.basecoat}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`recipe-${recipe.id}-wash`}>
                            Wash
                          </Label>
                          <Input
                            id={`recipe-${recipe.id}-wash`}
                            name="wash"
                            defaultValue={recipe.wash}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`recipe-${recipe.id}-highlights`}>
                            Highlights
                          </Label>
                          <Input
                            id={`recipe-${recipe.id}-highlights`}
                            name="highlights"
                            defaultValue={recipe.highlights}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`recipe-${recipe.id}-colors`}>
                            Farben
                          </Label>
                          <Textarea
                            id={`recipe-${recipe.id}-colors`}
                            name="colorsUsed"
                            rows={2}
                            defaultValue={formatColorsForForm(
                              recipe.colorsUsed,
                            )}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`recipe-${recipe.id}-photo`}>
                            Ergebnisfoto
                          </Label>
                          <Input
                            id={`recipe-${recipe.id}-photo`}
                            name="resultPhotoUrl"
                            type="url"
                            defaultValue={recipe.resultPhotoUrl ?? ""}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`recipe-${recipe.id}-rating`}>
                            Bewertung
                          </Label>
                          <Input
                            id={`recipe-${recipe.id}-rating`}
                            name="rating"
                            type="number"
                            min={1}
                            max={5}
                            defaultValue={recipe.rating ?? ""}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`recipe-${recipe.id}-notes`}>
                            Notizen
                          </Label>
                          <Textarea
                            id={`recipe-${recipe.id}-notes`}
                            name="notes"
                            rows={2}
                            defaultValue={recipe.notes}
                          />
                        </div>
                        <div>
                          <Button type="submit" variant="secondary" size="sm">
                            Speichern
                          </Button>
                        </div>
                      </form>
                    </details>
                    <form action={deletePaintRecipeAction}>
                      <input type="hidden" name="id" value={recipe.id} />
                      <input
                        type="hidden"
                        name="returnTo"
                        value="/workshop/recipes"
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        Löschen
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
