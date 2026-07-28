import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createLifeAdminService,
  formatEuroFromCents,
  parseStringArray,
  prisma,
  WORKSHOP_PAINT_TARGET_LABELS,
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
import {
  advanceWorkshopStatusAction,
  deleteWorkshopAction,
  updateWorkshopAction,
} from "../../workshop-actions";

/**
 * Ein Werkstattprojekt im Detail — Material, Farben, Filamente, STL-Links und
 * die Farbrezepte und Druckprofile, die daran hängen.
 */

export const dynamic = "force-dynamic";

const STATUSES = Object.values(WorkshopStatusEnum) as WorkshopStatus[];
const TYPES = Object.values(WorkshopProjectTypeEnum) as WorkshopProjectType[];

interface Props {
  params: Promise<{ id: string }>;
}

function toDateInput(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="brain-section">
      <h2>{title}</h2>
      <ul className="brain-list">
        {items.map((entry) => (
          <li key={entry} className="brain-row">
            {entry}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function BrainWorkshopDetailPage({ params }: Props) {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/workshop" title="Werkstatt">
        <BrainDenied />
      </BrainShell>
    );
  }

  const { id } = await params;
  const service = createLifeAdminService(brainPrisma, prisma);
  const project = await service.getWorkshopProject(id);
  if (!project) notFound();

  const [recipes, profiles] = await Promise.all([
    service.listWorkshopPaintRecipes({ workshopProjectId: id, limit: 50 }),
    service.listWorkshopPrintProfiles({ workshopProjectId: id, limit: 50 }),
  ]);

  const materialsNeeded = parseStringArray(project.materialsNeeded);
  const materialsUsed = parseStringArray(project.materialsUsed);
  const colorsUsed = parseStringArray(project.colorsUsed);
  const filamentsUsed = parseStringArray(project.filamentsUsed);
  const stlLinks = parseStringArray(project.stlLinks);

  return (
    <BrainShell
      active="/workshop"
      title={project.title}
      lede={`${WORKSHOP_TYPE_LABELS[project.projectType]} · ${WORKSHOP_STATUS_LABELS[project.status]}${
        project.costCents ? ` · ${formatEuroFromCents(project.costCents)}` : ""
      }`}
      actions={
        <Link className="brain-btn brain-btn-ghost brain-btn-sm" href="/workshop">
          ← Werkstatt
        </Link>
      }
    >
      <nav className="brain-form-row" aria-label="Status setzen">
        <form action={advanceWorkshopStatusAction}>
          <input type="hidden" name="id" value={project.id} />
          <button type="submit" className="brain-btn brain-btn-sm">
            Nächster Status →
          </button>
        </form>
        {project.nextAction ? (
          <span className="brain-muted">Nächster Schritt: {project.nextAction}</span>
        ) : null}
      </nav>

      {project.description ? (
        <section className="brain-section">
          <p style={{ whiteSpace: "pre-wrap" }}>{project.description}</p>
        </section>
      ) : null}

      <ListSection title="Material benötigt" items={materialsNeeded} />
      <ListSection title="Material verbraucht" items={materialsUsed} />
      <ListSection title="Farben" items={colorsUsed} />
      <ListSection title="Filamente" items={filamentsUsed} />

      {stlLinks.length > 0 ? (
        <section className="brain-section">
          <h2>STL-Links</h2>
          <ul className="brain-list">
            {stlLinks.map((link) => (
              <li key={link} className="brain-row" style={{ wordBreak: "break-all" }}>
                <a href={link} target="_blank" rel="noreferrer">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="brain-section">
        <h2>Farbrezepte · {recipes.length}</h2>
        {recipes.length === 0 ? (
          <p className="brain-muted">
            Keins verknüpft. <Link href="/workshop/recipes">Farbrezepte öffnen →</Link>
          </p>
        ) : (
          <ul className="brain-list">
            {recipes.map((recipe) => (
              <li key={recipe.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{recipe.name}</strong>
                  <span className="brain-tag">
                    {WORKSHOP_PAINT_TARGET_LABELS[recipe.targetType] ?? recipe.targetType}
                  </span>
                  {recipe.rating ? <span className="brain-muted">{"★".repeat(recipe.rating)}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="brain-section">
        <h2>Druckprofile · {profiles.length}</h2>
        {profiles.length === 0 ? (
          <p className="brain-muted">
            Keins verknüpft. <Link href="/workshop/print-profiles">Druckprofile öffnen →</Link>
          </p>
        ) : (
          <ul className="brain-list">
            {profiles.map((profile) => (
              <li key={profile.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{profile.name || "(ohne Namen)"}</strong>
                  <span className="brain-muted">
                    {[profile.printer, profile.nozzle, profile.filament].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {project.notes ? (
        <section className="brain-section">
          <h2>Notizen</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{project.notes}</p>
        </section>
      ) : null}

      <section className="brain-section">
        <h2>Bearbeiten</h2>
        <form action={updateWorkshopAction} className="brain-form brain-card">
          <input type="hidden" name="id" value={project.id} />
          <div className="brain-form-row">
            <label>
              Titel
              <input name="title" defaultValue={project.title} required />
            </label>
            <label>
              Art
              <select name="projectType" defaultValue={project.projectType}>
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {WORKSHOP_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue={project.status}>
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
            <textarea name="description" rows={3} defaultValue={project.description} />
          </label>
          <div className="brain-form-row">
            <label>
              Nächster Schritt
              <input name="nextAction" defaultValue={project.nextAction ?? ""} />
            </label>
            <label>
              Bis wann
              <input
                name="nextActionDate"
                type="date"
                defaultValue={toDateInput(project.nextActionDate)}
              />
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
              Material benötigt (eine Zeile pro Eintrag)
              <textarea name="materialsNeeded" rows={3} defaultValue={materialsNeeded.join("\n")} />
            </label>
            <label>
              Material verbraucht
              <textarea name="materialsUsed" rows={3} defaultValue={materialsUsed.join("\n")} />
            </label>
          </div>
          <div className="brain-form-row">
            <label>
              Farben
              <textarea name="colorsUsed" rows={3} defaultValue={colorsUsed.join("\n")} />
            </label>
            <label>
              Filamente
              <textarea name="filamentsUsed" rows={3} defaultValue={filamentsUsed.join("\n")} />
            </label>
          </div>
          <label>
            STL-Links (eine URL pro Zeile)
            <textarea name="stlLinks" rows={3} defaultValue={stlLinks.join("\n")} />
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

        <form action={deleteWorkshopAction} style={{ marginTop: "0.75rem" }}>
          <input type="hidden" name="id" value={project.id} />
          <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
            Projekt löschen
          </button>
        </form>
      </section>
    </BrainShell>
  );
}
