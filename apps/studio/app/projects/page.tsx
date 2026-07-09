import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
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
import { AdminCreateCard, AdminEntityForm, AdminFilterChips, AdminModulePage, BreadcrumbTrail } from "@/src/components/admin";
import { formatStudioDate } from "@/src/lib/format";
import { createProjectAction } from "../life-admin-actions";

function formatProjectBudget(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return formatEuroFromCents(cents);
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
  const service = createLifeAdminService(prisma);

  const [projects, dashboard] = await Promise.all([
    service.listPersonalProjects({
      category: categoryFilter ?? undefined,
      status: statusFilter ?? undefined,
      limit: 200,
    }),
    service.getPersonalProjectDashboardStats(),
  ]);

  return (
    <AdminModulePage
      breadcrumb={<BreadcrumbTrail items={[{ label: "Projekte" }]} />}
      title="Projekte"
      summary="Persönliche Projekte — UWE, Hardware, DnD, Werkstatt und mehr."
    >
      <AdminFilterChips
        ariaLabel="Projekt-Kategorien"
        chips={[
          {
            href: "/projects",
            label: "Alle",
            count: dashboard.total,
            active: !categoryFilter,
          },
          ...dashboard.categories.map((summary) => ({
            href:
              categoryFilter === summary.category
                ? "/projects"
                : `/projects?category=${summary.category}`,
            label: PROJECT_CATEGORY_LABELS[summary.category],
            count: summary.total,
            active: categoryFilter === summary.category,
          })),
        ]}
      />

      <section className="uwe-v2-section" aria-label="Projekt-Dashboards">
        <h2 className="uwe-v2-section-title">
          Nach Domäne ({dashboard.activeTotal} aktiv / {dashboard.total} gesamt)
        </h2>
        <div className="uwe-dashboard-grid">
          {dashboard.categories.map((summary) => {
            const filterActive = categoryFilter === summary.category;
            return (
              <article
                key={summary.category}
                className="uwe-v2-card uwe-dashboard-card"
                aria-current={filterActive ? "page" : undefined}
                style={
                  filterActive
                    ? { outline: "2px solid var(--uwe-accent, #6366f1)" }
                    : undefined
                }
              >
                <h3
                  className="uwe-v2-section-title"
                  style={{ fontSize: "1rem", marginBottom: "0.35rem" }}
                >
                  <Link
                    href={
                      filterActive
                        ? "/projects"
                        : `/projects?category=${summary.category}`
                    }
                  >
                    {PROJECT_CATEGORY_LABELS[summary.category]}
                  </Link>
                </h3>
                <p style={{ fontSize: "1.75rem", fontWeight: 600, margin: "0 0 0.35rem" }}>
                  {summary.active}
                  <span className="uwe-dashboard-muted" style={{ fontWeight: 400 }}>
                    {" "}
                    aktiv / {summary.total} gesamt
                  </span>
                </p>
                <div
                  className="uwe-jobs-progress"
                  role="progressbar"
                  aria-valuenow={summary.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Fortschritt ${PROJECT_CATEGORY_LABELS[summary.category]}`}
                >
                  <div
                    className="uwe-jobs-progress-bar"
                    style={{ width: `${summary.progressPercent}%` }}
                  />
                </div>
                <p className="uwe-dashboard-muted">
                  {summary.done} von {summary.total} erledigt ({summary.progressPercent}%)
                  {filterActive ? " · Filter aktiv" : ""}
                </p>
                {summary.recentProjects.length > 0 && (
                  <ul className="uwe-dashboard-list" style={{ marginTop: "0.5rem" }}>
                    {summary.recentProjects.map((project) => (
                      <li key={project.id}>
                        <Link href={`/projects/${project.id}`}>{project.name}</Link>
                        <p className="uwe-dashboard-muted">
                          {PROJECT_STATUS_LABELS[project.status]} ·{" "}
                          {formatStudioDate(project.updatedAt, "medium")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="uwe-v2-section" aria-label="Status-Filter">
        <h2 className="uwe-v2-section-title">Nach Status filtern</h2>
        <div className="uwe-today-quick-chips">
          <Link
            href={categoryFilter ? `/projects?category=${categoryFilter}` : "/projects"}
            className="uwe-today-quick-chip"
            data-severity={!statusFilter ? "warn" : "info"}
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
                className="uwe-today-quick-chip"
                data-severity={statusFilter === status ? "warn" : "info"}
              >
                {PROJECT_STATUS_LABELS[status]} ({dashboard.byStatus[status]})
              </Link>
            );
          })}
        </div>
      </section>

      <section className="uwe-v2-section" aria-label="Status-Übersicht">
        <h2 className="uwe-v2-section-title">Status ({dashboard.openTotal} offen)</h2>
        <div className="uwe-today-quick-chips">
          {Object.values(PersonalProjectStatusEnum).map((status) => {
            const count = dashboard.byStatus[status];
            const severity =
              status === "blocked"
                ? "error"
                : status === "active" || status === "planned"
                  ? "warn"
                  : "info";
            return (
              <span
                key={status}
                className="uwe-today-quick-chip"
                data-severity={severity}
                aria-label={`${PROJECT_STATUS_LABELS[status]}: ${count}`}
              >
                {PROJECT_STATUS_LABELS[status]} ({count})
              </span>
            );
          })}
        </div>
      </section>

      {categoryFilter && (
        <p className="uwe-dashboard-muted">
          Gefiltert: {PROJECT_CATEGORY_LABELS[categoryFilter]}{" "}
          <Link href="/projects">Filter zurücksetzen</Link>
        </p>
      )}

      <AdminCreateCard title="Neues Projekt">
        <AdminEntityForm
          action={createProjectAction}
          submitLabel="Projekt anlegen"
          fields={[
            { name: "name", label: "Name", required: true },
            {
              name: "category",
              label: "Kategorie",
              type: "select",
              defaultValue: categoryFilter ?? "other",
              options: Object.values(PersonalProjectCategoryEnum).map((category) => ({
                value: category,
                label: PROJECT_CATEGORY_LABELS[category],
              })),
            },
            {
              name: "status",
              label: "Status",
              type: "select",
              defaultValue: "idea",
              options: Object.values(PersonalProjectStatusEnum).map((status) => ({
                value: status,
                label: PROJECT_STATUS_LABELS[status],
              })),
            },
            { name: "nextAction", label: "Nächste Aktion" },
            { name: "nextActionDate", label: "Fälligkeitsdatum", type: "date" },
            { name: "description", label: "Beschreibung", type: "textarea", rows: 3 },
            { name: "costCents", label: "Kosten (Cent)", type: "number", min: 0 },
          ]}
        />
      </AdminCreateCard>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">
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
            action={<Link href="/capture">Capture öffnen</Link>}
          />
        ) : (
          <div className="uwe-today-card-list">
            {projects.map((project) => (
              <article key={project.id} className="uwe-today-card uwe-v2-card uwe-v2-card-padded">
                <h3>
                  <Link href={`/projects/${project.id}`}>{project.name}</Link>
                </h3>
                <p className="uwe-dashboard-muted">
                  {PROJECT_CATEGORY_LABELS[project.category]} · {PROJECT_STATUS_LABELS[project.status]}
                  {project.costCents != null ? ` · ${formatProjectBudget(project.costCents)}` : ""}
                </p>
                {project.description && <p>{project.description}</p>}
                {(project.nextAction || project.nextActionDate) && (
                  <p>
                    {project.nextAction && <span>{project.nextAction}</span>}
                    {project.nextActionDate && (
                      <span className="uwe-dashboard-muted">
                        {project.nextAction ? " · " : ""}
                        Fällig: {formatStudioDate(project.nextActionDate, "medium")}
                      </span>
                    )}
                  </p>
                )}
                <p>
                  <Link href={`/projects/${project.id}`}>Details →</Link>
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminModulePage>
  );
}
