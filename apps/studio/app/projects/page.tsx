import Link from "next/link";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createLifeAdminService,
  formatEuroFromCents,
  PersonalProjectCategoryEnum,
  PersonalProjectStatusEnum,
  prisma,
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
  type PersonalProjectCategory,
  type PersonalProjectStatus,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  Badge,
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
import { formatStudioDate } from "@/src/lib/format";
import { createProjectAction } from "../life-admin-actions";

function formatProjectBudget(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return formatEuroFromCents(cents);
}

function chipLinkClass(active: boolean): string {
  return cn(
    badgeVariants({ variant: active ? "accent" : "default" }),
    "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
}

interface Props {
  searchParams: Promise<{ category?: string; status?: string }>;
}

function resolveStatus(raw: string | undefined): PersonalProjectStatus | null {
  if (raw && Object.values(PersonalProjectStatusEnum).includes(raw as PersonalProjectStatus)) {
    return raw as PersonalProjectStatus;
  }
  return null;
}

function resolveCategory(raw: string | undefined): PersonalProjectCategory | null {
  if (raw && Object.values(PersonalProjectCategoryEnum).includes(raw as PersonalProjectCategory)) {
    return raw as PersonalProjectCategory;
  }
  return null;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const { category: categoryRaw, status: statusRaw } = await searchParams;
  const categoryFilter = resolveCategory(categoryRaw);
  const statusFilter = resolveStatus(statusRaw);
  const service = createLifeAdminService(brainPrisma, prisma);

  const [projects, dashboard] = await Promise.all([
    service.listPersonalProjects({
      category: categoryFilter ?? undefined,
      status: statusFilter ?? undefined,
      limit: 200,
    }),
    service.getPersonalProjectDashboardStats(),
  ]);

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Projekte" }]} />}>
      <PageHeader
        title="Projekte"
        summary="Persönliche Projekte — UWE, Hardware, DnD, Werkstatt und mehr."
      />

      <div className="flex flex-col gap-6">
        <nav className="flex flex-wrap gap-2" aria-label="Projekt-Kategorien">
          <Link
            href="/projects"
            aria-current={!categoryFilter ? "page" : undefined}
            className={chipLinkClass(!categoryFilter)}
          >
            Alle ({dashboard.total})
          </Link>
          {dashboard.categories.map((summary) => {
            const active = categoryFilter === summary.category;
            return (
              <Link
                key={summary.category}
                href={active ? "/projects" : `/projects?category=${summary.category}`}
                aria-current={active ? "page" : undefined}
                className={chipLinkClass(active)}
              >
                {PROJECT_CATEGORY_LABELS[summary.category]} ({summary.total})
              </Link>
            );
          })}
        </nav>

        <section className="flex flex-col gap-3" aria-label="Projekt-Dashboards">
          <h2 className="text-lg font-semibold tracking-tight">
            Nach Domäne ({dashboard.activeTotal} aktiv / {dashboard.total} gesamt)
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {dashboard.categories.map((summary) => {
              const filterActive = categoryFilter === summary.category;
              return (
                <Card
                  key={summary.category}
                  aria-current={filterActive ? "page" : undefined}
                  className={cn(filterActive && "ring-2 ring-primary")}
                >
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link
                        href={filterActive ? "/projects" : `/projects?category=${summary.category}`}
                      >
                        {PROJECT_CATEGORY_LABELS[summary.category]}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-2xl font-semibold">
                      {summary.active}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        aktiv / {summary.total} gesamt
                      </span>
                    </p>
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={summary.progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Fortschritt ${PROJECT_CATEGORY_LABELS[summary.category]}`}
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${summary.progressPercent}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {summary.done} von {summary.total} erledigt ({summary.progressPercent}%)
                      {filterActive ? " · Filter aktiv" : ""}
                    </p>
                    {summary.recentProjects.length > 0 && (
                      <ul className="flex flex-col gap-1.5">
                        {summary.recentProjects.map((project) => (
                          <li key={project.id}>
                            <Link href={`/projects/${project.id}`} className="text-sm">
                              {project.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {PROJECT_STATUS_LABELS[project.status]} ·{" "}
                              {formatStudioDate(project.updatedAt, "medium")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-label="Status-Filter">
          <h2 className="text-lg font-semibold tracking-tight">Nach Status filtern</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href={categoryFilter ? `/projects?category=${categoryFilter}` : "/projects"}
              className={chipLinkClass(!statusFilter)}
            >
              Alle Status
            </Link>
            {Object.values(PersonalProjectStatusEnum).map((status) => {
              const params = new URLSearchParams();
              if (categoryFilter) params.set("category", categoryFilter);
              params.set("status", status);
              return (
                <Link
                  key={status}
                  href={`/projects?${params}`}
                  className={chipLinkClass(statusFilter === status)}
                >
                  {PROJECT_STATUS_LABELS[status]} ({dashboard.byStatus[status]})
                </Link>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-label="Status-Übersicht">
          <h2 className="text-lg font-semibold tracking-tight">
            Status ({dashboard.openTotal} offen)
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.values(PersonalProjectStatusEnum).map((status) => {
              const count = dashboard.byStatus[status];
              const variant =
                status === "blocked"
                  ? "danger"
                  : status === "active" || status === "planned"
                    ? "warning"
                    : "default";
              return (
                <Badge
                  key={status}
                  variant={variant}
                  aria-label={`${PROJECT_STATUS_LABELS[status]}: ${count}`}
                >
                  {PROJECT_STATUS_LABELS[status]} ({count})
                </Badge>
              );
            })}
          </div>
        </section>

        {categoryFilter && (
          <p className="text-sm text-muted-foreground">
            Gefiltert: {PROJECT_CATEGORY_LABELS[categoryFilter]}{" "}
            <Link href="/projects">Filter zurücksetzen</Link>
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Neues Projekt</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createProjectAction} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-new-name">Name</Label>
                <Input id="project-new-name" name="name" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-new-category">Kategorie</Label>
                <Select name="category" defaultValue={categoryFilter ?? "other"}>
                  <SelectTrigger id="project-new-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PersonalProjectCategoryEnum).map((category) => (
                      <SelectItem key={category} value={category}>
                        {PROJECT_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-new-status">Status</Label>
                <Select name="status" defaultValue="idea">
                  <SelectTrigger id="project-new-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PersonalProjectStatusEnum).map((status) => (
                      <SelectItem key={status} value={status}>
                        {PROJECT_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-new-next-action">Nächste Aktion</Label>
                <Input id="project-new-next-action" name="nextAction" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-new-next-action-date">Fälligkeitsdatum</Label>
                <Input id="project-new-next-action-date" name="nextActionDate" type="date" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-new-cost">Kosten (Cent)</Label>
                <Input id="project-new-cost" name="costCents" type="number" min={0} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="project-new-description">Beschreibung</Label>
                <Textarea id="project-new-description" name="description" rows={3} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Projekt anlegen</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {categoryFilter
              ? `${PROJECT_CATEGORY_LABELS[categoryFilter]} (${projects.length})`
              : `Alle Projekte (${projects.length})`}
          </h2>
          {projects.length === 0 ? (
            <EmptyState
              title="Noch keine Projekte"
              description={
                categoryFilter
                  ? `Keine Projekte in ${PROJECT_CATEGORY_LABELS[categoryFilter]}.`
                  : "Lege ein Projekt an oder erfasse eine Projektidee per Capture."
              }
              action={
                <Link href="/capture" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Capture öffnen
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {projects.map((project) => (
                <Card key={project.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link href={`/projects/${project.id}`}>{project.name}</Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      {PROJECT_CATEGORY_LABELS[project.category]} ·{" "}
                      {PROJECT_STATUS_LABELS[project.status]}
                      {project.costCents != null ? ` · ${formatProjectBudget(project.costCents)}` : ""}
                    </p>
                    {project.description && <p className="text-sm">{project.description}</p>}
                    {(project.nextAction || project.nextActionDate) && (
                      <p className="text-sm">
                        {project.nextAction && <span>{project.nextAction}</span>}
                        {project.nextActionDate && (
                          <span className="text-muted-foreground">
                            {project.nextAction ? " · " : ""}
                            Fällig: {formatStudioDate(project.nextActionDate, "medium")}
                          </span>
                        )}
                      </p>
                    )}
                    <Link
                      href={`/projects/${project.id}`}
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      Details →
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <p className="text-sm text-muted-foreground">
          <Link href="/worlds">← Welten</Link>
        </p>
      </div>
    </StudioShell>
  );
}
