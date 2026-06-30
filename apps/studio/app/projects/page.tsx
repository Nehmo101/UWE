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
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  createProjectAction,
  deleteProjectAction,
  updateProjectAction,
} from "../life-admin-actions";

function formatProjectBudget(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return formatEuroFromCents(cents);
}

export default async function ProjectsPage() {
  const projects = await createLifeAdminService(prisma).listPersonalProjects({ limit: 200 });

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Projekte" }]} />}>
      <PageHeader
        title="Projekte"
        summary="Persönliche Projekte — UWE, Hardware, DnD, Werkstatt und mehr."
      />
      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neues Projekt</h2>
        <form action={createProjectAction} className="uwe-brain-create-form">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Kategorie
            <select name="category" defaultValue="other">
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
        <h2 className="uwe-v2-section-title">Projekte ({projects.length})</h2>
        {projects.length === 0 ? (
          <EmptyState
            title="Noch keine Projekte"
            description="Lege ein Projekt an oder erfasse eine Projektidee per Capture."
            action={<Link href="/capture">Capture öffnen</Link>}
          />
        ) : (
          <div className="uwe-today-card-list">
            {projects.map((project) => (
              <article key={project.id} className="uwe-today-card uwe-v2-card uwe-v2-card-padded">
                <h3>
                  <Link href={`/projects/${project.id}`}>{project.name}</Link>
                </h3>
                <form action={updateProjectAction} className="uwe-brain-create-form">
                  <input type="hidden" name="id" value={project.id} />
                  <label>
                    Name
                    <input name="name" defaultValue={project.name} required />
                  </label>
                  <label>
                    Kategorie
                    <select name="category" defaultValue={project.category}>
                      {Object.values(PersonalProjectCategoryEnum).map((category) => (
                        <option key={category} value={category}>
                          {PROJECT_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue={project.status}>
                      {Object.values(PersonalProjectStatusEnum).map((status) => (
                        <option key={status} value={status}>
                          {PROJECT_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nächste Aktion
                    <input name="nextAction" defaultValue={project.nextAction ?? ""} />
                  </label>
                  <label>
                    Fälligkeitsdatum
                    <input
                      name="nextActionDate"
                      type="date"
                      defaultValue={
                        project.nextActionDate
                          ? project.nextActionDate.toISOString().slice(0, 10)
                          : ""
                      }
                    />
                  </label>
                  <label>
                    Beschreibung
                    <textarea name="description" rows={2} defaultValue={project.description} />
                  </label>
                  <label>
                    Kosten (Cent)
                    <input
                      name="costCents"
                      type="number"
                      min={0}
                      defaultValue={project.costCents ?? ""}
                    />
                  </label>
                  <p className="uwe-dashboard-muted">
                    {PROJECT_STATUS_LABELS[project.status]} · {formatProjectBudget(project.costCents)}
                  </p>
                  <div className="uwe-inline-actions">
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                      Speichern
                    </button>
                  </div>
                </form>
                <form action={deleteProjectAction}>
                  <input type="hidden" name="id" value={project.id} />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                    Löschen
                  </button>
                </form>
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
