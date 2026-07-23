import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { createWorkshopAction, deleteWorkshopAction } from "../brain-actions";

export const dynamic = "force-dynamic";

const TYPES: Array<{ value: string; label: string }> = [
  { value: "miniature", label: "Miniatur" },
  { value: "dnd_terrain", label: "D&D-Gelände" },
  { value: "printing_3d", label: "3D-Druck" },
  { value: "diorama", label: "Diorama" },
  { value: "artwork", label: "Artwork" },
  { value: "other", label: "Sonstiges" },
];

const STATUS: Array<{ value: string; label: string }> = [
  { value: "idea", label: "Idee" },
  { value: "planned", label: "Geplant" },
  { value: "material_missing", label: "Material fehlt" },
  { value: "in_progress", label: "In Arbeit" },
  { value: "paused", label: "Pausiert" },
  { value: "done", label: "Fertig" },
  { value: "archived", label: "Archiviert" },
];

export default async function BrainWorkshopPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/workshop" title="Werkstatt">
        <BrainDenied />
      </BrainShell>
    );
  }

  const projects = await createLifeAdminService(brainPrisma, prisma).listWorkshopProjects();

  return (
    <BrainShell
      active="/workshop"
      title="Werkstatt"
      lede={`${projects.length} Werkstatt-Projekt(e) — Miniaturen, 3D-Druck, Gelände. Lokal auf deiner Hardware.`}
    >
      <section className="brain-section">
        <h2>Neues Werkstatt-Projekt</h2>
        <form action={createWorkshopAction} className="brain-form brain-card">
          <label>
            Titel
            <input name="title" required placeholder="z. B. Ork-Warband bemalen" />
          </label>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Typ
              <select name="projectType" defaultValue="miniature">
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue="idea">
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Beschreibung
            <textarea name="description" rows={2} />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Projekt anlegen
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Projekte · {projects.length}</h2>
        {projects.length === 0 ? (
          <p className="brain-muted">Keine Werkstatt-Projekte.</p>
        ) : (
          <ul className="brain-list">
            {projects.map((project) => (
              <li key={project.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{project.title}</strong>
                  <span className="brain-tag">{project.projectType}</span>
                  <span className="brain-muted">{project.status}</span>
                  <form action={deleteWorkshopAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={project.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
                {project.nextAction ? (
                  <p style={{ margin: "0.35rem 0 0" }} className="brain-muted">
                    Nächster Schritt: {project.nextAction}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
