import Link from "next/link";
import {
  createLifeAdminService,
  formatEuroFromCents,
  prisma,
  WORKSHOP_STATUS_LABELS,
  WORKSHOP_TYPE_LABELS,
  WorkshopProjectTypeEnum,
  WorkshopStatusEnum,
  type WorkshopProjectType,
  type WorkshopStatus,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { advanceWorkshopStatusAction, createWorkshopAction } from "../workshop-actions";

/**
 * Werkstatt — Abschnitt H5, Brain gewinnt.
 *
 * Studio hatte fünf Seiten: Übersicht, Detail, Farbrezepte, Druckprofile und
 * Terrain-Verleih. Alle vier Bereiche liegen jetzt hier. Die Welt-Zuordnung
 * kommt nicht mit: eine Werkstattarbeit gehört zu dir, nicht zu einer Welt.
 */

export const dynamic = "force-dynamic";

const STATUSES = Object.values(WorkshopStatusEnum) as WorkshopStatus[];
const TYPES = Object.values(WorkshopProjectTypeEnum) as WorkshopProjectType[];

interface Props {
  searchParams: Promise<{ status?: string; type?: string }>;
}

function chipClass(active: boolean): string {
  return active ? "brain-btn brain-btn-sm" : "brain-btn brain-btn-ghost brain-btn-sm";
}

function buildHref(status: string | null, type: string | null): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  const query = params.toString();
  return query ? `/workshop?${query}` : "/workshop";
}

export default async function BrainWorkshopPage({ searchParams }: Props) {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/workshop" title="Werkstatt">
        <BrainDenied />
      </BrainShell>
    );
  }

  const params = await searchParams;
  const statusFilter = STATUSES.includes(params.status as WorkshopStatus)
    ? (params.status as WorkshopStatus)
    : null;
  const typeFilter = TYPES.includes(params.type as WorkshopProjectType)
    ? (params.type as WorkshopProjectType)
    : null;

  const service = createLifeAdminService(brainPrisma, prisma);
  const [projects, statusCounts, openTasks] = await Promise.all([
    service.listWorkshopProjects({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { projectType: typeFilter } : {}),
      limit: 200,
    }),
    service.getWorkshopStatusCounts(),
    service.listWorkshopOpenTasks(10),
  ]);

  return (
    <BrainShell
      active="/workshop"
      title="Werkstatt"
      lede="3D-Druck, Terrain, Miniaturen — was gerade auf dem Tisch liegt und was als Nächstes drankommt."
    >
      <nav className="brain-form-row" aria-label="Werkstatt-Bereiche">
        <Link className="brain-btn brain-btn-ghost brain-btn-sm" href="/workshop/recipes">
          Farbrezepte
        </Link>
        <Link className="brain-btn brain-btn-ghost brain-btn-sm" href="/workshop/print-profiles">
          Druckprofile
        </Link>
        <Link className="brain-btn brain-btn-ghost brain-btn-sm" href="/workshop/rental">
          Terrain-Verleih
        </Link>
        <Link className="brain-btn brain-btn-ghost brain-btn-sm" href="/miniatures">
          Miniaturen-Sammlung
        </Link>
      </nav>

      <div className="brain-kpis">
        {STATUSES.map((status) => (
          <Link
            key={status}
            className="brain-kpi"
            href={buildHref(statusFilter === status ? null : status, typeFilter)}
            aria-current={statusFilter === status ? "page" : undefined}
          >
            <strong>{statusCounts[status] ?? 0}</strong>
            <span>
              {WORKSHOP_STATUS_LABELS[status]}
              {statusFilter === status ? " · Filter aktiv" : ""}
            </span>
          </Link>
        ))}
      </div>

      <nav className="brain-form-row" aria-label="Nach Art filtern">
        <Link className={chipClass(!typeFilter)} href={buildHref(statusFilter, null)}>
          Alle Arten
        </Link>
        {TYPES.map((type) => (
          <Link
            key={type}
            className={chipClass(typeFilter === type)}
            href={buildHref(statusFilter, typeFilter === type ? null : type)}
          >
            {WORKSHOP_TYPE_LABELS[type]}
          </Link>
        ))}
      </nav>

      {openTasks.length > 0 ? (
        <section className="brain-section">
          <h2>Als Nächstes</h2>
          <ul className="brain-list">
            {openTasks.map((task) => (
              <li key={task.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>
                    <Link href={`/workshop/${task.id}`}>{task.title}</Link>
                  </strong>
                  <span className="brain-muted">{task.nextAction}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="brain-section">
        <h2>Neues Werkstattprojekt</h2>
        <form action={createWorkshopAction} className="brain-form brain-card">
          <div className="brain-form-row">
            <label>
              Titel
              <input name="title" required placeholder="z. B. Ruinen-Set drucken" />
            </label>
            <label>
              Art
              <select name="projectType" defaultValue={typeFilter ?? "other"}>
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {WORKSHOP_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue="idea">
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {WORKSHOP_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Beschreibung
            <textarea name="description" rows={2} />
          </label>
          <div className="brain-form-row">
            <label>
              Nächster Schritt
              <input name="nextAction" />
            </label>
            <label>
              Bis wann
              <input name="nextActionDate" type="date" />
            </label>
            <label>
              Kosten (€)
              <input name="cost" inputMode="decimal" placeholder="0,00" />
            </label>
          </div>
          <div>
            <button type="submit" className="brain-btn">
              Projekt anlegen
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>
          Projekte · {projects.length}
          {statusFilter ? ` · ${WORKSHOP_STATUS_LABELS[statusFilter]}` : ""}
          {typeFilter ? ` · ${WORKSHOP_TYPE_LABELS[typeFilter]}` : ""}
        </h2>
        {projects.length === 0 ? (
          <p className="brain-muted">
            Nichts in dieser Auswahl.{" "}
            {statusFilter || typeFilter ? <Link href="/workshop">Filter zurücksetzen</Link> : null}
          </p>
        ) : (
          <ul className="brain-list">
            {projects.map((project) => (
              <li key={project.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>
                    <Link href={`/workshop/${project.id}`}>{project.title}</Link>
                  </strong>
                  <span className="brain-tag">{WORKSHOP_STATUS_LABELS[project.status]}</span>
                  <span className="brain-muted">
                    {WORKSHOP_TYPE_LABELS[project.projectType]}
                    {project.costCents ? ` · ${formatEuroFromCents(project.costCents)}` : ""}
                  </span>
                  <form action={advanceWorkshopStatusAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={project.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Weiter →
                    </button>
                  </form>
                </div>
                {project.nextAction ? (
                  <p className="brain-muted">Nächster Schritt: {project.nextAction}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
