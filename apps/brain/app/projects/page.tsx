import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

export const dynamic = "force-dynamic";

export default async function BrainProjectsPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/projects" title="Projekte">
        <BrainDenied />
      </BrainShell>
    );
  }

  const projects = await createLifeAdminService(brainPrisma, prisma).listPersonalProjects();

  return (
    <BrainShell active="/projects" title="Persönliche Projekte">
      <p>{projects.length} Projekt(e) — Daily Admin OS, lokal auf deiner Hardware.</p>
      {projects.length === 0 ? (
        <p>Keine Projekte.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0", display: "grid", gap: "0.6rem" }}>
          {projects.map((project) => (
            <li key={project.id} className="brain-row">
              <strong>{project.name}</strong>
              <span className="brain-tag">{project.status}</span>
              <span className="brain-muted"> · {project.category}</span>
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
