import Link from "next/link";
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
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { createProjectAction } from "../project-actions";

/**
 * Persönliche Projekte — Abschnitt H4, Brain gewinnt.
 *
 * Die Liste hat die Filter der Studio-Fassung bekommen (Kategorie-Kacheln,
 * Statusfilter) und verlinkt in die Detailseite; Schritte, Notizen, Links und
 * Kosten stehen dort. Was nicht mitkommt: die Welt-Zuordnung und die
 * Medien-Bibliothek — beides Studio-Sache.
 */

export const dynamic = "force-dynamic";

const STATUSES = Object.values(PersonalProjectStatusEnum) as PersonalProjectStatus[];
const CATEGORIES = Object.values(PersonalProjectCategoryEnum) as PersonalProjectCategory[];

interface Props {
  searchParams: Promise<{ category?: string; status?: string }>;
}

function resolveCategory(value: string | undefined): PersonalProjectCategory | null {
  return CATEGORIES.includes(value as PersonalProjectCategory)
    ? (value as PersonalProjectCategory)
    : null;
}

function resolveStatus(value: string | undefined): PersonalProjectStatus | null {
  return STATUSES.includes(value as PersonalProjectStatus)
    ? (value as PersonalProjectStatus)
    : null;
}

function chipClass(active: boolean): string {
  return active ? "brain-btn brain-btn-sm" : "brain-btn brain-btn-ghost brain-btn-sm";
}

function buildHref(category: string | null, status: string | null): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}

export default async function BrainProjectsPage({ searchParams }: Props) {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/projects" title="Projekte">
        <BrainDenied />
      </BrainShell>
    );
  }

  const { category: categoryRaw, status: statusRaw } = await searchParams;
  const categoryFilter = resolveCategory(categoryRaw);
  const statusFilter = resolveStatus(statusRaw);

  const service = createLifeAdminService(brainPrisma, prisma);
  const [projects, stats] = await Promise.all([
    service.listPersonalProjects({
      category: categoryFilter ?? undefined,
      status: statusFilter ?? undefined,
    }),
    service.getPersonalProjectDashboardStats(),
  ]);

  return (
    <BrainShell
      active="/projects"
      title="Persönliche Projekte"
      lede={`${stats.activeTotal} aktiv · ${stats.openTotal} offen · ${stats.total} gesamt.`}
    >
      <div className="brain-kpis">
        {stats.categories.map((summary) => {
          const active = categoryFilter === summary.category;
          return (
            <Link
              key={summary.category}
              className="brain-kpi"
              href={buildHref(active ? null : summary.category, statusFilter)}
              aria-current={active ? "page" : undefined}
            >
              <strong>{summary.active}</strong>
              <span>
                {summary.label} · {summary.total} gesamt
                {active ? " · Filter aktiv" : ""}
              </span>
            </Link>
          );
        })}
      </div>

      <nav className="brain-form-row" aria-label="Status-Filter">
        <Link className={chipClass(!statusFilter)} href={buildHref(categoryFilter, null)}>
          Alle Status
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            className={chipClass(statusFilter === status)}
            href={buildHref(categoryFilter, statusFilter === status ? null : status)}
            aria-current={statusFilter === status ? "page" : undefined}
          >
            {PROJECT_STATUS_LABELS[status]} · {stats.byStatus[status] ?? 0}
          </Link>
        ))}
      </nav>

      <section className="brain-section">
        <h2>Neues Projekt</h2>
        <form action={createProjectAction} className="brain-form brain-card">
          <label>
            Name
            <input name="name" required placeholder="z. B. Homelab-Backup einrichten" />
          </label>
          <label>
            Beschreibung
            <textarea name="description" rows={2} />
          </label>
          <div className="brain-form-row">
            <label>
              Status
              <select name="status" defaultValue="idea">
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kategorie
              <select name="category" defaultValue={categoryFilter ?? "other"}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {PROJECT_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kosten (€)
              <input name="cost" inputMode="decimal" placeholder="0,00" />
            </label>
          </div>
          <div className="brain-form-row">
            <label>
              Nächster Schritt
              <input name="nextAction" placeholder="Was ist als Nächstes zu tun?" />
            </label>
            <label>
              Bis wann
              <input name="nextActionDate" type="date" />
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
          {categoryFilter ? ` · ${PROJECT_CATEGORY_LABELS[categoryFilter]}` : ""}
          {statusFilter ? ` · ${PROJECT_STATUS_LABELS[statusFilter]}` : ""}
        </h2>
        {projects.length === 0 ? (
          <p className="brain-muted">
            Keine Projekte in dieser Auswahl.{" "}
            {categoryFilter || statusFilter ? <Link href="/projects">Filter zurücksetzen</Link> : null}
          </p>
        ) : (
          <ul className="brain-list">
            {projects.map((project) => (
              <li key={project.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>
                    <Link href={`/projects/${project.id}`}>{project.name}</Link>
                  </strong>
                  <span className="brain-tag">{PROJECT_STATUS_LABELS[project.status]}</span>
                  <span className="brain-muted">
                    {PROJECT_CATEGORY_LABELS[project.category]}
                    {project.costCents ? ` · ${formatEuroFromCents(project.costCents)}` : ""}
                  </span>
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
