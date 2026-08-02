import { notFound } from "next/navigation";
import {
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { BrainDocumentClient } from "@/components/brain/BrainDocumentClient";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string; entryId: string }>;
}

export default async function StudioBrainDocumentPage({ params }: Props) {
  const { worldSlug, entryId } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const brain = createBrainStoreService();

  const document = await brain.getDocumentByIdForWorld(worldSlug, entryId);
  if (!document) notFound();

  const links = await brain.listLinksForSource(worldSlug, "brain_document", entryId);
  await db.$disconnect();

  return (
    <>
      <ShellBreadcrumb
        items={worldDetailBreadcrumb(
          world.name,
          worldSlug,
          "Brain Store",
          `/worlds/${worldSlug}/brain`,
          document.title,
        )}
      />
      <PageHeader
        title={document.title}
        summary="Brain-Dokument bearbeiten"
      />
      <BrainDocumentClient
        worldSlug={worldSlug}
        document={{
          id: document.id,
          title: document.title,
          content: document.content,
          documentType: document.documentType,
          status: document.status,
          source: document.source,
          chunks: document.chunks,
          page: document.page,
        }}
      />

      {links.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Links</h2>
          <ul className="list-disc pl-5 text-sm">
            {links.map((link) => (
              <li key={link.id}>
                {link.relationType}: {link.targetType} → {link.targetId}
                {link.label ? ` (${link.label})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
