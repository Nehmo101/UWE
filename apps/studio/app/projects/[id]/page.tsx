import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  formatEuroFromCents,
  PersonalProjectCategoryEnum,
  PersonalProjectStatusEnum,
  prisma,
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@uwe/database/server";
import { AdminEntityLinksPanel } from "@/components/admin/AdminEntityLinksPanel";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  deleteProjectAction,
  updateProjectAction,
} from "../../life-admin-actions";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await createLifeAdminService(prisma).getPersonalProjectDetail(id);

  if (!detail) {
    notFound();
  }

  const { project, linkedCaptures } = detail;

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Projekte", href: "/projects" },
            { label: project.name },
          ]}
        />
      }
    >
      <PageHeader
        title={project.name}
        summary={`${PROJECT_CATEGORY_LABELS[project.category]} · ${PROJECT_STATUS_LABELS[project.status]}`}
      />
      <p className="uwe-dashboard-muted">
        <Link href="/projects">← Alle Projekte</Link>
      </p>

      {(project.nextAction || project.nextActionDate) && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2 className="uwe-v2-section-title">Nächster Schritt</h2>
          {project.nextAction && <p>{project.nextAction}</p>}
          {project.nextActionDate && (
            <p className="uwe-dashboard-muted">
              Fällig: {DATE_FORMAT.format(project.nextActionDate)}
            </p>
          )}
        </section>
      )}

      <section className="uwe-v2-card uwe-v2-section">
        <h2 className="uwe-v2-section-title">Projekt bearbeiten</h2>
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
            <textarea name="description" rows={3} defaultValue={project.description} />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} defaultValue={project.notes} />
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
            {formatEuroFromCents(project.costCents ?? 0)} · Aktualisiert{" "}
            {DATE_FORMAT.format(project.updatedAt)}
          </p>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Speichern
          </button>
        </form>
      </section>

      {linkedCaptures.length > 0 && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2 className="uwe-v2-section-title">Quellen / Captures</h2>
          <ul className="uwe-today-card-list">
            {linkedCaptures.map((capture) => (
              <li key={capture.id} className="uwe-today-card">
                <h3>
                  <Link href={`/capture/${capture.id}`}>{capture.title || "Capture"}</Link>
                </h3>
                <p className="uwe-dashboard-muted">
                  {CAPTURE_TYPE_LABELS[capture.captureType]} ·{" "}
                  {DATE_FORMAT.format(capture.capturedAt)}
                </p>
                {capture.content && <p>{capture.content}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <AdminEntityLinksPanel sourceType="personal_project" sourceId={project.id} />

      <form action={deleteProjectAction}>
        <input type="hidden" name="id" value={project.id} />
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
          Projekt löschen
        </button>
      </form>
    </StudioShell>
  );
}
