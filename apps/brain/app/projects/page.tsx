import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  addProjectStepAction,
  createProjectAction,
  deleteProjectAction,
  deleteProjectStepAction,
  toggleProjectStepAction,
} from "../brain-actions";

export const dynamic = "force-dynamic";

const STATUS: Array<{ value: string; label: string }> = [
  { value: "idea", label: "Idee" },
  { value: "planned", label: "Geplant" },
  { value: "active", label: "Aktiv" },
  { value: "blocked", label: "Blockiert" },
  { value: "paused", label: "Pausiert" },
  { value: "done", label: "Fertig" },
  { value: "archived", label: "Archiviert" },
];

const CATEGORY: Array<{ value: string; label: string }> = [
  { value: "uwe", label: "UWE" },
  { value: "hardware_homelab", label: "Hardware/Homelab" },
  { value: "dnd", label: "D&D" },
  { value: "art_workshop", label: "Kunst/Werkstatt" },
  { value: "printing_3d", label: "3D-Druck" },
  { value: "other", label: "Sonstiges" },
];

export default async function BrainProjectsPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/projects" title="Projekte">
        <BrainDenied />
      </BrainShell>
    );
  }

  const service = createLifeAdminService(brainPrisma, prisma);
  const list = await service.listPersonalProjects();
  const projects = (await Promise.all(list.map((p) => service.getPersonalProject(p.id)))).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );

  return (
    <BrainShell
      active="/projects"
      title="Persönliche Projekte"
      lede={`${projects.length} Projekt(e) — dein Daily Admin OS. Projekte anlegen, Schritte abhaken, den nächsten Zug festhalten.`}
    >
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
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
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
            <label>
              Kategorie
              <select name="category" defaultValue="other">
                {CATEGORY.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Nächster Schritt
            <input name="nextAction" placeholder="Was ist als Nächstes zu tun?" />
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
          <p className="brain-muted">Noch keine Projekte.</p>
        ) : (
          <ul className="brain-list">
            {projects.map((project) => (
              <li key={project.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{project.name}</strong>
                  <span className="brain-tag">{project.status}</span>
                  <span className="brain-muted">{project.category}</span>
                  <form action={deleteProjectAction} style={{ marginLeft: "auto" }}>
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

                {project.steps.length > 0 ? (
                  <ul style={{ listStyle: "none", padding: 0, margin: "0.6rem 0 0", display: "grid", gap: "0.3rem" }}>
                    {project.steps.map((step) => (
                      <li key={step.id} className={`brain-step${step.done ? " done" : ""}`}>
                        <form action={toggleProjectStepAction}>
                          <input type="hidden" name="stepId" value={step.id} />
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
                          <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                            ✕
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <form action={addProjectStepAction} className="brain-form brain-form-inline" style={{ marginTop: "0.6rem" }}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <label style={{ margin: 0 }}>
                    <input name="title" placeholder="Schritt hinzufügen …" required />
                  </label>
                  <button type="submit" className="brain-btn brain-btn-sm">
                    + Schritt
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
