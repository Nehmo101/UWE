import Link from "next/link";
import { notFound } from "next/navigation";
import {
  asLinkList,
  buildPageUrl,
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  formatEuroFromCents,
  formatLinksForForm,
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
  updateProjectStatusAction,
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
  const links = asLinkList(project.links);

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
        <Link href="/projects">← Alle Projekte</Link> ·{" "}
        <Link href={`/projects?category=${project.category}`}>
          {PROJECT_CATEGORY_LABELS[project.category]} filtern
        </Link>
      </p>

      <section className="uwe-v2-card uwe-v2-section">
        <h2 className="uwe-v2-section-title">Domänen-Module</h2>
        <ul className="uwe-list-cards">
          {project.category === "uwe" && (
            <>
              <li className="uwe-list-card">
                <Link href="/ideas">Ideen & Feature-Registry →</Link>
              </li>
              <li className="uwe-list-card">
                <Link href="/command">NL-Befehlszentrale →</Link>
              </li>
            </>
          )}
          {project.category === "hardware_homelab" && (
            <li className="uwe-list-card">
              <Link href="/hardware">Hardware / Homelab →</Link>
            </li>
          )}
          {project.category === "dnd" && (
            <li className="uwe-list-card">
              <Link href={project.world ? `/worlds/${project.world.slug}/dashboard` : "/worlds"}>
                {project.world ? `DnD-Welt: ${project.world.name}` : "Welten-Übersicht"} →
              </Link>
            </li>
          )}
          {(project.category === "art_workshop" || project.category === "printing_3d") && (
            <li className="uwe-list-card">
              <Link href="/workshop">Werkstatt →</Link>
            </li>
          )}
          {project.category === "other" && (
            <li className="uwe-list-card">
              <Link href="/capture">Capture-Inbox →</Link>
            </li>
          )}
        </ul>
      </section>

      <section className="uwe-v2-card uwe-v2-section">
        <h2 className="uwe-v2-section-title">Status wechseln</h2>
        <div className="uwe-today-quick-chips">
          {Object.values(PersonalProjectStatusEnum).map((status) =>
            status === project.status ? (
              <span
                key={status}
                className="uwe-today-quick-chip"
                data-severity="info"
                aria-current="true"
              >
                {PROJECT_STATUS_LABELS[status]} (aktuell)
              </span>
            ) : (
              <form
                key={status}
                action={updateProjectStatusAction}
                style={{ display: "inline-flex" }}
              >
                <input type="hidden" name="id" value={project.id} />
                <input type="hidden" name="status" value={status} />
                <button
                  type="submit"
                  className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                >
                  {PROJECT_STATUS_LABELS[status]}
                </button>
              </form>
            ),
          )}
        </div>
      </section>

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

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Übersicht</h2>
        <div className="uwe-dashboard-grid">
          <article className="uwe-v2-card uwe-dashboard-card">
            <h3>Status & Kategorie</h3>
            <p>{PROJECT_STATUS_LABELS[project.status]}</p>
            <p className="uwe-dashboard-muted">{PROJECT_CATEGORY_LABELS[project.category]}</p>
            <p className="uwe-dashboard-muted">
              Angelegt {DATE_FORMAT.format(project.createdAt)} · Aktualisiert{" "}
              {DATE_FORMAT.format(project.updatedAt)}
            </p>
          </article>
          {(project.world || project.page) && (
            <article className="uwe-v2-card uwe-dashboard-card">
              <h3>Welt & Seite</h3>
              {project.world && (
                <p>
                  <Link href={`/worlds/${project.world.slug}/dashboard`}>
                    {project.world.name}
                  </Link>
                </p>
              )}
              {project.page && (
                <p>
                  <Link
                    href={buildPageUrl(
                      project.page.world.slug,
                      project.page.type,
                      project.page.slug,
                    )}
                  >
                    {project.page.title}
                  </Link>
                </p>
              )}
            </article>
          )}
          <article className="uwe-v2-card uwe-dashboard-card">
            <h3>Kosten</h3>
            <p>{project.costCents != null ? formatEuroFromCents(project.costCents) : "—"}</p>
          </article>
          <article className="uwe-v2-card uwe-dashboard-card">
            <h3>Links</h3>
            {links.length > 0 ? (
              <ul>
                {links.map((entry) => (
                  <li key={entry.url}>
                    <a href={entry.url} target="_blank" rel="noreferrer">
                      {entry.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="uwe-dashboard-muted">Keine Links</p>
            )}
          </article>
        </div>
      </section>

      {project.description && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2 className="uwe-v2-section-title">Beschreibung</h2>
          <p>{project.description}</p>
        </section>
      )}

      {project.notes && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2 className="uwe-v2-section-title">Notizen</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{project.notes}</p>
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
            Links (eine Zeile pro Link: <code>Label | https://…</code>)
            <textarea name="links" rows={3} defaultValue={formatLinksForForm(project.links)} />
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
