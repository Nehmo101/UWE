import Link from "next/link";
import {
import { brainPrisma } from "@uwe/database/brain-client";
  countMaterialsNeeded,
  createLifeAdminService,
  firstPhotoUrl,
  formatEuroFromCents,
  getNextWorkshopStatus,
  prisma,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_TYPE_LABELS,
  WorkshopProjectTypeEnum,
  WorkshopStatusEnum,
  type WorkshopStatus,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  badgeVariants,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
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
import { advanceWorkshopStatusAction } from "../life-admin-actions";
import { createWorkshopAction } from "../workshop-actions";

const WORKSHOP_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "active", label: "Aktiv" },
  { value: "material_missing", label: "Material fehlt" },
  { value: "done", label: "Fertig" },
  { value: "dnd", label: "DnD-verknüpft" },
] as const;

type WorkshopFilter = (typeof WORKSHOP_FILTERS)[number]["value"];

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

function resolveFilter(raw: string | undefined): WorkshopFilter {
  if (raw && WORKSHOP_FILTERS.some((item) => item.value === raw)) {
    return raw as WorkshopFilter;
  }
  return "all";
}

function formatCost(cents: number | null | undefined): string {
  if (cents == null) return "";
  return formatEuroFromCents(cents);
}

export default async function WorkshopPage({ searchParams }: Props) {
  const { filter: filterRaw } = await searchParams;
  const filter = resolveFilter(filterRaw);
  const service = createLifeAdminService(brainPrisma, prisma);

  const statusFilter =
    filter === "active"
      ? (["in_progress", "planned", "material_missing", "idea"] as WorkshopStatus[])
      : filter === "material_missing"
        ? ("material_missing" as const)
        : filter === "done"
          ? ("done" as const)
          : undefined;

  const [workshops, filterCounts, activeWorkshops] = await Promise.all([
    service.listWorkshopProjects({
      status: statusFilter,
      limit: 200,
    }),
    service.getWorkshopFilterCounts(),
    service.listWorkshopProjects({
      status: ["in_progress", "planned", "material_missing", "idea"],
      limit: 3,
    }),
  ]);

  const visibleWorkshops =
    filter === "dnd" ? workshops.filter((item) => Boolean(item.worldId)) : workshops;

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Werkstatt" }]} />}>
      <PageHeader
        title="Werkstatt"
        summary="Hobby-Cockpit für Miniaturen, Terrain, 3D-Druck, Dioramen und Kunst — mit Status-Workflow."
      />

      <div className="flex flex-col gap-6">
        <nav className="flex flex-wrap gap-2" aria-label="Werkstatt-Filter">
          {WORKSHOP_FILTERS.map((item) => (
            <Link
              key={item.value}
              href={item.value === "all" ? "/workshop" : `/workshop?filter=${item.value}`}
              aria-current={filter === item.value ? "page" : undefined}
              className={cn(
                badgeVariants({ variant: filter === item.value ? "accent" : "default" }),
                "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {item.label} ({filterCounts[item.value]})
            </Link>
          ))}
        </nav>

        <nav className="flex flex-wrap gap-3 text-sm" aria-label="Werkstatt-Werkzeuge">
          <Link href="/workshop/recipes">Paint-Anleitungen</Link>
          <Link href="/workshop/print-profiles">Druck-Profile</Link>
          <Link href="/workshop/rental">Terrain-Verleih</Link>
          <Link href="/miniatures">Miniaturen-Sammlung</Link>
        </nav>

        <Card>
          <CardHeader>
            <CardTitle>Aktive Projekte ({filterCounts.active})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {activeWorkshops.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine aktiven Werkstatt-Projekte.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {activeWorkshops.map((workshop) => (
                  <li key={workshop.id} className="flex flex-col gap-0.5">
                    <Link href={`/workshop/${workshop.id}`} className="font-medium">
                      {workshop.title}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {WORKSHOP_STATUS_LABELS[workshop.status]}
                      {workshop.nextAction ? ` · ${workshop.nextAction}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {filterCounts.active > activeWorkshops.length ? (
              <p className="text-sm text-muted-foreground">
                <Link href="/workshop?filter=active">Alle aktiven Projekte anzeigen →</Link>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Neues Werkstatt-Projekt</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createWorkshopAction} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-new-title">Titel</Label>
                <Input id="workshop-new-title" name="title" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workshop-new-project-type">Typ</Label>
                <Select name="projectType" defaultValue="dnd_terrain">
                  <SelectTrigger id="workshop-new-project-type">
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
                <Label htmlFor="workshop-new-status">Status</Label>
                <Select name="status" defaultValue="idea">
                  <SelectTrigger id="workshop-new-status">
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
                <Label htmlFor="workshop-new-next-action">Nächster Schritt</Label>
                <Input
                  id="workshop-new-next-action"
                  name="nextAction"
                  placeholder="z. B. Grundierung auftragen"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="workshop-new-materials-needed">
                  Materialien (Name | Menge | ja/nein)
                </Label>
                <Textarea
                  id="workshop-new-materials-needed"
                  name="materialsNeeded"
                  rows={3}
                  placeholder={"XPS-Schaum | 2 Platten | nein\nCitadel Abaddon Black | 1 Flasche | ja"}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="workshop-new-description">Beschreibung</Label>
                <Textarea id="workshop-new-description" name="description" rows={3} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Werkstatt-Projekt anlegen</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Projekte ({visibleWorkshops.length})</h2>
          {visibleWorkshops.length === 0 ? (
            <EmptyState
              title="Noch keine Werkstatt-Projekte"
              description="Erfasse kreative Projekte per Capture oder lege hier direkt eines an."
              action={
                <Link href="/capture" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Capture öffnen
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {visibleWorkshops.map((workshop) => {
                const nextStatus = getNextWorkshopStatus(workshop.status);
                const thumb = firstPhotoUrl(
                  workshop.resultPhotos,
                  workshop.progressPhotos,
                  workshop.referenceImages,
                  workshop.imageGallery,
                );
                const materials = countMaterialsNeeded(workshop.materialsNeeded);
                const world = "world" in workshop ? workshop.world : null;

                return (
                  <Card key={workshop.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        <Link href={`/workshop/${workshop.id}`}>{workshop.title}</Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="max-h-[140px] max-w-full rounded-lg" />
                      )}
                      <p className="text-sm text-muted-foreground">
                        {WORKSHOP_TYPE_LABELS[workshop.projectType]} ·{" "}
                        {WORKSHOP_STATUS_LABELS[workshop.status]}
                        {world ? (
                          <>
                            {" "}
                            · <Link href={`/worlds/${world.slug}/dashboard`}>{world.name}</Link>
                          </>
                        ) : workshop.worldId ? (
                          " · DnD-verknüpft"
                        ) : null}
                        {workshop.costCents != null ? ` · ${formatCost(workshop.costCents)}` : ""}
                      </p>
                      {workshop.nextAction && (
                        <p className="text-sm">
                          <strong>Nächster Schritt:</strong> {workshop.nextAction}
                        </p>
                      )}
                      {materials.total > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Material: {materials.total - materials.missing}/{materials.total} bereit
                          {materials.missing > 0 ? ` · ${materials.missing} fehlen` : ""}
                        </p>
                      )}
                      {workshop.description && <p className="text-sm">{workshop.description}</p>}
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/workshop/${workshop.id}`}
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                          Cockpit öffnen
                        </Link>
                        {nextStatus && (
                          <form action={advanceWorkshopStatusAction}>
                            <input type="hidden" name="id" value={workshop.id} />
                            <Button type="submit" size="sm">
                              → {WORKSHOP_STATUS_LABELS[nextStatus]}
                            </Button>
                          </form>
                        )}
                        <Link
                          href={`/mail/compose?kind=terrain_rental&sourceId=${workshop.id}`}
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                          Terrain-Mail
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-sm text-muted-foreground">
          <Link href="/today">← Heute</Link>
        </p>
      </div>
    </StudioShell>
  );
}
