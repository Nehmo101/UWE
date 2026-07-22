import { createLifeAdminService, prisma } from "@uwe/database/server";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

export const dynamic = "force-dynamic";

export default async function BrainWorkshopPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/workshop" title="Werkstatt">
        <BrainDenied />
      </BrainShell>
    );
  }

  const projects = await createLifeAdminService(prisma).listWorkshopProjects();

  return (
    <BrainShell active="/workshop" title="Werkstatt">
      <p>{projects.length} Werkstatt-Projekt(e) — Miniaturen, 3D-Druck, Gelände; lokal.</p>
      {projects.length === 0 ? (
        <p>Keine Werkstatt-Projekte.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0", display: "grid", gap: "0.6rem" }}>
          {projects.map((project) => (
            <li key={project.id} className="brain-row">
              <strong>{project.title}</strong>
              <span className="brain-tag">{project.projectType}</span>
              <span className="brain-muted"> · {project.status}</span>
              {project.nextAction ? (
                <p style={{ margin: "0.35rem 0 0" }} className="brain-muted">
                  Nächster Schritt: {project.nextAction}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </BrainShell>
  );
}
