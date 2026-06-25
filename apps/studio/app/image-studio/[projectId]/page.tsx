import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createImageStudioService,
  extractImageStudioErrorMessage,
  IMAGE_STUDIO_STATUS_LABELS,
  prisma,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { ImageStudioProjectReview } from "@/components/ImageStudioProjectReview";
import { ImageStudioStatusBadge } from "@/components/ImageStudioStatusBadge";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ImageStudioProjectPage({ params }: Props) {
  const { projectId } = await params;
  const imageStudio = createImageStudioService(prisma);
  const project = await imageStudio.getProject(projectId);
  if (!project) notFound();

  const world = project.worldId
    ? await prisma.world.findUnique({ where: { id: project.worldId }, select: { slug: true } })
    : null;
  const errorMessage = extractImageStudioErrorMessage(project.metadata);

  return (
    <AdminModuleShell
      activePath="/image-studio"
      title={project.title}
      summary="Versionen prüfen, Entwurf speichern, Asset übernehmen oder im Canvas bearbeiten."
      actions={
        <Link href="/image-studio" className="uwe-v2-btn uwe-v2-btn-secondary">
          ← Alle Projekte
        </Link>
      }
    >
      <ImageStudioStatusBadge
        status={project.status}
        label={IMAGE_STUDIO_STATUS_LABELS[project.status]}
      />

      {project.status === "failed" && errorMessage ? (
        <p className="uwe-notice uwe-notice-error">{errorMessage}</p>
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
    </AdminModuleShell>
  );
}
