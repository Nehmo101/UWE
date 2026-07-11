import Link from "next/link";
import { notFound } from "next/navigation";
import { createImageStudioService, prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { ImageStudioCanvasEditor } from "@/components/ImageStudioCanvasEditor";
import { ImageStudioPromptHistory } from "@/src/components/ux/ImageStudioPromptHistory";
import { saveImageStudioCanvasAction } from "@/app/integration-actions";
import { buttonVariants } from "@/src/components/ui";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ImageStudioEditPage({ params }: Props) {
  const { projectId } = await params;
  const imageStudio = createImageStudioService(prisma);
  const project = await imageStudio.getProject(projectId);
  if (!project) notFound();

  const latestVersion = project.versions.find((version) => version.assetId);
  if (!latestVersion?.assetId) {
    notFound();
  }

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Image Studio", href: "/image-studio" },
            { label: project.title, href: `/image-studio/${projectId}` },
            { label: "Bearbeiten" },
          ]}
        />
      }
    >
      <PageHeader
        title={`Bearbeiten — ${project.title}`}
        summary="Drehen und als neue Version speichern (Odysseus-Gallery-Editor, vereinfacht)."
        actions={
          <Link href={`/image-studio/${projectId}`} className={buttonVariants({ variant: "secondary" })}>
            ← Projekt
          </Link>
        }
      />
      <ImageStudioPromptHistory projectId={projectId} />
      <ImageStudioCanvasEditor
        projectId={projectId}
        sourceImageUrl={`/api/assets/${latestVersion.assetId}/file`}
        onSave={saveImageStudioCanvasAction}
      />
    </StudioShell>
  );
}
