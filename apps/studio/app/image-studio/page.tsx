import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@uwe/shared-ui";
import {
  createImageStudioService,
  getAppRepository,
  IMAGE_STUDIO_OPERATION_LABELS,
  IMAGE_STUDIO_STATUS_LABELS,
  ImageStudioStatusEnum,
  prisma,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { ImageStudioJobForm } from "@/components/ImageStudioJobForm";
import { ImageStudioStatusBadge } from "@/components/ImageStudioStatusBadge";
import { ImageStudioWorkspace } from "@/components/ImageStudioWorkspace";
import { createImageStudioJobAction } from "../integration-actions";

interface Props {
  searchParams: Promise<{ pageId?: string; project?: string; status?: string }>;
}

export default async function ImageStudioPage({ searchParams }: Props) {
  const { pageId, project, status: statusRaw } = await searchParams;
  if (project?.trim()) {
    redirect(`/image-studio/${project.trim()}`);
  }
  const repo = getAppRepository();
  const settings = await repo.getSystemSettings();
  const config = settings.imageStudio;
  const statusFilter =
    statusRaw && Object.values(ImageStudioStatusEnum).includes(statusRaw as (typeof ImageStudioStatusEnum)[keyof typeof ImageStudioStatusEnum])
      ? (statusRaw as (typeof ImageStudioStatusEnum)[keyof typeof ImageStudioStatusEnum])
      : undefined;

  const imageStudio = createImageStudioService(prisma);
  const [projects, worlds] = await Promise.all([
    imageStudio.listProjects(undefined, { status: statusFilter }),
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
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Image Studio" }]} />}>
      <PageHeader
        title="Image Studio"
        summary="Prompt-Generierung und Inpainting (RTX) — optional Cloud nur für generate/variant."
        actions={
          <Link href="/settings?tab=image-studio" className="uwe-v2-btn uwe-v2-btn-secondary">
            Einstellungen
          </Link>
        }
      />
      {!config.enabled && (
        <p className="uwe-notice uwe-notice-warn">
          Image Studio ist deaktiviert. Aktiviere unter{" "}
          <Link href="/settings?tab=image-studio">Einstellungen → Image Studio</Link>.
        </p>
      )}

      {pageId && (
        <p className="uwe-notice">
          Verknüpft mit Seite <code>{pageId}</code> — Ergebnis wird automatisch verlinkt.
        </p>
      )}

      <ImageStudioWorkspace inlineForm={jobForm} disabled={!config.enabled} />

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Projekte</h2>
        <nav className="uwe-today-quick-chips" aria-label="Status-Filter">
          <Link
            href="/image-studio"
            className="uwe-today-quick-chip"
            data-severity={!statusFilter ? "warn" : "info"}
          >
            Alle
          </Link>
          {Object.values(ImageStudioStatusEnum).map((status) => (
            <Link
              key={status}
              href={`/image-studio?status=${status}`}
              className="uwe-today-quick-chip"
              data-severity={statusFilter === status ? "warn" : "info"}
            >
              {IMAGE_STUDIO_STATUS_LABELS[status]}
            </Link>
          ))}
        </nav>
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
                <ImageStudioStatusBadge
                  status={project.status}
                  label={IMAGE_STUDIO_STATUS_LABELS[project.status]}
                />
                {project.prompt && (
                  <p className="uwe-dashboard-muted">{project.prompt.slice(0, 120)}</p>
                )}
                {project.versions[0]?.assetId && (
                  <Link href={`/api/assets/${project.versions[0].assetId}/file`} target="_blank">
                    Vorschau
                  </Link>
                )}
                <Link href={`/image-studio/${project.id}`}>Projekt öffnen</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StudioShell>
  );
}
