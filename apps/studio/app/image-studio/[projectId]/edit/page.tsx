import Link from "next/link";
import { notFound } from "next/navigation";
import { createImageStudioService, prisma } from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { ImageStudioCanvasEditor } from "@/components/ImageStudioCanvasEditor";
import { saveImageStudioCanvasAction } from "@/app/integration-actions";

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
    <AdminModuleShell
      activePath="/image-studio"
      title={`Bearbeiten — ${project.title}`}
      summary="Drehen und als neue Version speichern (Odysseus-Gallery-Editor, vereinfacht)."
      actions={
        <Link href={`/image-studio/${projectId}`} className="uwe-btn uwe-btn-secondary">
          ← Projekt
        </Link>
      }
    >
      <ImageStudioCanvasEditor
        projectId={projectId}
        sourceImageUrl={`/api/assets/${latestVersion.assetId}/file`}
        onSave={saveImageStudioCanvasAction}
      />
    </AdminModuleShell>
  );
}
