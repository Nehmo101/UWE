import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  createImageStudioService,
  getAppRepository,
  IMAGE_STUDIO_OPERATION_LABELS,
  IMAGE_STUDIO_STATUS_LABELS,
  prisma,
  resolveImageStudioConfig,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { ImageStudioJobForm } from "@/components/ImageStudioJobForm";
import { ImageStudioWorkspace } from "@/components/ImageStudioWorkspace";
import { createImageStudioJobAction } from "../integration-actions";

interface Props {
  searchParams: Promise<{ pageId?: string }>;
}

export default async function ImageStudioPage({ searchParams }: Props) {
  const { pageId } = await searchParams;
  const config = resolveImageStudioConfig();
  const imageStudio = createImageStudioService(prisma);
  const repo = getAppRepository();
  const [projects, worlds] = await Promise.all([
    imageStudio.listProjects(),
    repo.listWorldsWithGuestMode(),
  ]);

  const jobForm = (
    <ImageStudioJobForm
      action={createImageStudioJobAction}
      worlds={worlds.map((world) => ({ slug: world.slug, name: world.name }))}
      operationLabels={IMAGE_STUDIO_OPERATION_LABELS}
      defaultWorldSlug={worlds[0]?.slug}
      defaultProviderMode={config.defaultProviderMode}
      enabled={config.enabled}
      pageId={pageId}
      linkTargetType="page"
    />
  );

  return (
    <AdminModuleShell
      activePath="/image-studio"
      title="Image Studio"
      summary="Prompt-Generierung und Inpainting (RTX) — optional Cloud nur für generate/variant."
    >
      {!config.enabled && (
        <p className="uwe-notice uwe-notice-warn">
          Image Studio ist deaktiviert. Setze IMAGE_STUDIO_ENABLED=true in der Umgebung.
        </p>
      )}

      {pageId && (
        <p className="uwe-notice">
          Verknüpft mit Seite <code>{pageId}</code> — Ergebnis wird automatisch verlinkt.
        </p>
      )}

      <ImageStudioWorkspace inlineForm={jobForm} disabled={!config.enabled} />

      <section>
        <h2 className="uwe-section-title">Projekte</h2>
        {projects.length === 0 ? (
          <EmptyState
            title="Noch keine Image-Studio-Projekte"
            description="Starte oben mit einem Prompt."
          />
        ) : (
          <ul className="uwe-list-cards">
            {projects.map((project) => (
              <li key={project.id} className="uwe-list-card">
                <strong>{project.title}</strong>
                <span className="uwe-badge">
                  {IMAGE_STUDIO_STATUS_LABELS[project.status]}
                </span>
                {project.prompt && (
                  <p className="uwe-dashboard-muted">{project.prompt.slice(0, 120)}</p>
                )}
                {project.versions[0]?.assetId && (
                  <Link href={`/api/assets/${project.versions[0].assetId}/file`} target="_blank">
                    Vorschau
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminModuleShell>
  );
}
