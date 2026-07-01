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
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { createProjectAction } from "../life-admin-actions";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

const ACTIVE_STATUSES = ["idea", "planned", "active", "blocked", "paused"] as const;

function formatProjectBudget(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return formatEuroFromCents(cents);
}

interface Props {
  searchParams: Promise<{ category?: string }>;
}

function resolveCategory(raw: string | undefined): PersonalProjectCategory | null {
  if (raw && Object.values(PersonalProjectCategoryEnum).includes(raw as PersonalProjectCategory)) {
    return raw as PersonalProjectCategory;
  }
  return null;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const { category: categoryRaw } = await searchParams;
  const categoryFilter = resolveCategory(categoryRaw);
  const service = createLifeAdminService(prisma);

  const [projects, dashboard] = await Promise.all([
    service.listPersonalProjects({
      category: categoryFilter ?? undefined,
      limit: 200,
    }),
    service.getPersonalProjectDashboardStats(),
  ]);

  const activeCount = ACTIVE_STATUSES.reduce(
    (sum, status) => sum + dashboard.byStatus[status],
    0,
  );

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Projekte" }]} />}>
      <PageHeader
        title="Projekte"
        summary="Persönliche Projekte — UWE, Hardware, DnD, Werkstatt und mehr."
      />

      <section className="uwe-v2-section" aria-label="Projekt-Dashboards">
        <h2 className="uwe-v2-section-title">Nach Kategorie ({dashboard.total})</h2>
        <div className="uwe-dashboard-grid">
          {Object.values(PersonalProjectCategoryEnum).map((category) => {
            const count = dashboard.byCategory[category];
            const active = categoryFilter === category;
            return (
              <Link
                key={category}
                href={active ? "/projects" : `/projects?category=${category}`}
                className="uwe-v2-card uwe-dashboard-card"
                aria-current={active ? "page" : undefined}
                style={active ? { outline: "2px solid var(--uwe-accent, #6366f1)" } : undefined}
              >
                <h3 className="uwe-v2-section-title" style={{ fontSize: "1rem", marginBottom: "0.35rem" }}>
                  {PROJECT_CATEGORY_LABELS[category]}
                </h3>
                <p style={{ fontSize: "1.75rem", fontWeight: 600, margin: "0 0 0.35rem" }}>{count}</p>
                <p className="uwe-dashboard-muted">
                  {count === 1 ? "Projekt" : "Projekte"}
                  {active ? " · Filter aktiv" : ""}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="uwe-v2-section" aria-label="Status-Übersicht">
        <h2 className="uwe-v2-section-title">Status ({activeCount} offen)</h2>
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

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neues Projekt</h2>
        <form action={createProjectAction} className="uwe-brain-create-form">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Kategorie
            <select name="category" defaultValue={categoryFilter ?? "other"}>
              {Object.values(PersonalProjectCategoryEnum).map((category) => (
                <option key={category} value={category}>
                  {PROJECT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue="idea">
              {Object.values(PersonalProjectStatusEnum).map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nächste Aktion
            <input name="nextAction" />
          </label>
          <label>
            Fälligkeitsdatum
            <input name="nextActionDate" type="date" />
          </label>
          <label>
            Beschreibung
            <textarea name="description" rows={3} />
          </label>
          <label>
            Kosten (Cent)
            <input name="costCents" type="number" min={0} />
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Projekt anlegen
          </button>
        </form>
      </section>

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
                        Fällig: {DATE_FORMAT.format(project.nextActionDate)}
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

      <p className="uwe-dashboard-muted">
        <Link href="/today">← Heute</Link>
      </p>
    </StudioShell>
  );
}
