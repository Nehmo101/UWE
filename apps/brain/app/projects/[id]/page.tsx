import Link from "next/link";
import { notFound } from "next/navigation";
import {
  asLinkList,
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  formatEuroFromCents,
  formatLinksForForm,
  PersonalProjectCategoryEnum,
  PersonalProjectStatusEnum,
  prisma,
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
  type PersonalProjectCategory,
  type PersonalProjectStatus,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  addProjectStepAction,
  deleteProjectAction,
  deleteProjectStepAction,
  toggleProjectStepAction,
  updateProjectAction,
  updateProjectStatusAction,
} from "../../project-actions";

/**
 * Ein Projekt im Detail — Schritte, Notizen, Links, Kosten und die Captures,
 * die beim Einsortieren hierher gewandert sind.
 *
 * Entspricht der Studio-Detailseite (Abschnitt H4), ohne Welt-Zuordnung und
 * ohne Medien-Bibliothek: Assets gehören zu Welten und damit zu Studio.
 */

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const STATUSES = Object.values(PersonalProjectStatusEnum) as PersonalProjectStatus[];
const CATEGORIES = Object.values(PersonalProjectCategoryEnum) as PersonalProjectCategory[];

interface Props {
  params: Promise<{ id: string }>;
}

function toDateInput(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function BrainProjectDetailPage({ params }: Props) {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/projects" title="Projekt">
        <BrainDenied />
      </BrainShell>
    );
  }

  const { id } = await params;
  const detail = await createLifeAdminService(brainPrisma, prisma).getPersonalProjectDetail(id);
  if (!detail) notFound();

  const { project, linkedCaptures } = detail;
  const links = asLinkList(project.links);
  const doneSteps = project.steps.filter((step) => step.done).length;

  return (
    <BrainShell
      active="/projects"
      title={project.name}
      lede={`${PROJECT_CATEGORY_LABELS[project.category]} · ${PROJECT_STATUS_LABELS[project.status]}${
        project.costCents ? ` · ${formatEuroFromCents(project.costCents)}` : ""
      }`}
      actions={
        <Link className="brain-btn brain-btn-ghost brain-btn-sm" href="/projects">
          ← Alle Projekte
        </Link>
      }
    >
      <nav className="brain-form-row" aria-label="Status setzen">
        {STATUSES.map((status) => (
          <form key={status} action={updateProjectStatusAction}>
            <input type="hidden" name="id" value={project.id} />
            <input type="hidden" name="status" value={status} />
            <button
              type="submit"
              className={
                project.status === status
                  ? "brain-btn brain-btn-sm"
                  : "brain-btn brain-btn-ghost brain-btn-sm"
              }
              aria-current={project.status === status ? "true" : undefined}
            >
              {PROJECT_STATUS_LABELS[status]}
            </button>
          </form>
        ))}
      </nav>

      {project.description ? (
        <section className="brain-section">
          <p style={{ whiteSpace: "pre-wrap" }}>{project.description}</p>
        </section>
      ) : null}

      <section className="brain-section">
        <h2>
          Schritte · {doneSteps}/{project.steps.length}
        </h2>
        {project.steps.length === 0 ? (
          <p className="brain-muted">Noch keine Schritte.</p>
        ) : (
          <ul className="brain-list">
            {project.steps.map((step) => (
              <li key={step.id} className={step.done ? "brain-step done" : "brain-step"}>
                <form action={toggleProjectStepAction}>
                  <input type="hidden" name="stepId" value={step.id} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="done" value={step.done ? "false" : "true"} />
                  <button
                    type="submit"
                    className="brain-btn brain-btn-ghost brain-btn-sm"
                    aria-label={step.done ? "Als offen markieren" : "Als erledigt markieren"}
                  >
                    {step.done ? "✓" : "○"}
                  </button>
                </form>
                <span>{step.title}</span>
                <form action={deleteProjectStepAction}>
                  <input type="hidden" name="stepId" value={step.id} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addProjectStepAction} className="brain-form-row">
          <input type="hidden" name="projectId" value={project.id} />
          <input name="title" placeholder="Schritt hinzufügen …" required />
          <button type="submit" className="brain-btn brain-btn-sm">
            + Schritt
          </button>
        </form>
      </section>

      {links.length > 0 ? (
        <section className="brain-section">
          <h2>Links</h2>
          <ul className="brain-list">
            {links.map((link) => (
              <li key={link.url} className="brain-row">
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.label || link.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {project.notes ? (
        <section className="brain-section">
          <h2>Notizen</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{project.notes}</p>
        </section>
      ) : null}

      <section className="brain-section">
        <h2>Verknüpfte Captures · {linkedCaptures.length}</h2>
        {linkedCaptures.length === 0 ? (
          <p className="brain-muted">
            Nichts verknüpft. Beim Einsortieren in der <Link href="/capture">Capture-Inbox</Link>{" "}
            landet es hier.
          </p>
        ) : (
          <ul className="brain-list">
            {linkedCaptures.map((capture) => (
              <li key={capture.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{capture.title || "(ohne Titel)"}</strong>
                  <span className="brain-tag">{CAPTURE_TYPE_LABELS[capture.captureType]}</span>
                  <span className="brain-muted">{DATE_FORMAT.format(capture.capturedAt)}</span>
                </div>
                {capture.content ? <p className="brain-muted">{capture.content.slice(0, 200)}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="brain-section" id="projekt-bearbeiten">
        <h2>Bearbeiten</h2>
        <form action={updateProjectAction} className="brain-form brain-card">
          <input type="hidden" name="id" value={project.id} />
          <label>
            Name
            <input name="name" defaultValue={project.name} required />
          </label>
          <label>
            Beschreibung
            <textarea name="description" rows={3} defaultValue={project.description} />
          </label>
          <div className="brain-form-row">
            <label>
              Status
              <select name="status" defaultValue={project.status}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kategorie
              <select name="category" defaultValue={project.category}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {PROJECT_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kosten (€)
              <input
                name="cost"
                inputMode="decimal"
                defaultValue={project.costCents ? (project.costCents / 100).toFixed(2) : ""}
              />
            </label>
          </div>
          <div className="brain-form-row">
            <label>
              Nächster Schritt
              <input name="nextAction" defaultValue={project.nextAction ?? ""} />
            </label>
            <label>
              Bis wann
              <input name="nextActionDate" type="date" defaultValue={toDateInput(project.nextActionDate)} />
            </label>
          </div>
          <label>
            Links (eine Zeile: <code>Titel | URL</code>)
            <textarea name="links" rows={3} defaultValue={formatLinksForForm(project.links)} />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={4} defaultValue={project.notes} />
          </label>
          <div>
            <button type="submit" className="brain-btn brain-btn-sm">
              Speichern
            </button>
          </div>
        </form>

        <form action={deleteProjectAction} style={{ marginTop: "0.75rem" }}>
          <input type="hidden" name="id" value={project.id} />
          <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
            Projekt löschen
          </button>
        </form>
      </section>
    </BrainShell>
  );
}
