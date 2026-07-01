import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createImageStudioService,
  extractImageStudioErrorMessage,
  getAppRepository,
  IMAGE_STUDIO_OPERATION_LABELS,
  IMAGE_STUDIO_STATUS_LABELS,
  prisma,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { ImageStudioProjectReview } from "@/components/ImageStudioProjectReview";
import { ImageStudioStatusBadge } from "@/components/ImageStudioStatusBadge";
import { ImageStudioJobForm } from "@/components/ImageStudioJobForm";
import { ImageStudioRetryButton } from "@/components/ImageStudioRetryButton";
import { createImageStudioJobAction } from "@/app/integration-actions";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ImageStudioProjectPage({ params }: Props) {
  const { projectId } = await params;
  const imageStudio = createImageStudioService(prisma);
  const project = await imageStudio.getProject(projectId);
  if (!project) notFound();

  const world = project.worldId
    ? await prisma.world.findUnique({ where: { id: project.worldId }, select: { slug: true, name: true } })
    : null;
  const errorMessage = extractImageStudioErrorMessage(project.metadata);
  const repo = getAppRepository();
  const settings = await repo.getSystemSettings();
  const config = settings.imageStudio;
  const worlds = await repo.listWorldsWithGuestMode();
  const latestWithAsset = project.versions.find((version) => version.assetId);
  const sourceAssetUrl = latestWithAsset?.assetId
    ? `/api/assets/${latestWithAsset.assetId}/file`
    : null;

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Image Studio", href: "/image-studio" },
            { label: project.title },
          ]}
        />
      }
    >
      <PageHeader
        title={project.title}
        summary="Versionen prüfen, Entwurf speichern, Asset übernehmen oder im Canvas bearbeiten."
        actions={
          <>
            {world?.slug ? (
              <Link
                href={`/worlds/${world.slug}/assets`}
                className="uwe-v2-btn uwe-v2-btn-secondary"
              >
                Medienbibliothek
              </Link>
            ) : null}
            <Link href="/image-studio" className="uwe-v2-btn uwe-v2-btn-secondary">
              ← Alle Projekte
            </Link>
          </>
        }
      />
      <ImageStudioStatusBadge
        status={project.status}
        label={IMAGE_STUDIO_STATUS_LABELS[project.status]}
      />

      {project.status === "failed" && errorMessage ? (
        <div className="uwe-notice uwe-notice-error">
          <p>{errorMessage}</p>
          <ImageStudioRetryButton projectId={project.id} />
        </div>
      ) : null}

      {world?.slug && config.enabled ? (
        <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
          <h2 className="uwe-v2-section-title">Weitere Operation</h2>
          <ImageStudioJobForm
            action={createImageStudioJobAction}
            worlds={worlds.map((entry) => ({ slug: entry.slug, name: entry.name }))}
            operationLabels={IMAGE_STUDIO_OPERATION_LABELS}
            defaultWorldSlug={world.slug}
            defaultProviderMode={config.defaultProviderMode}
            enabled={config.enabled}
            projectId={project.id}
            defaultPrompt={project.prompt ?? ""}
            defaultTitle={project.title}
            sourceAssetUrl={sourceAssetUrl}
          />
        </section>
      ) : null}

      <ImageStudioProjectReview
        projectId={project.id}
        title={project.title}
        prompt={project.prompt}
        status={project.status}
        statusLabel={IMAGE_STUDIO_STATUS_LABELS[project.status]}
        worldSlug={world?.slug ?? null}
        versions={project.versions.map((version) => ({
          id: version.id,
          versionNumber: version.versionNumber,
          operation: version.operation,
          prompt: version.prompt,
          assetId: version.assetId,
          providerMode: version.providerMode,
        }))}
        links={project.links.map((link) => ({
          targetType: link.targetType,
          targetId: link.targetId,
        }))}
      />
    </StudioShell>
  );
}
