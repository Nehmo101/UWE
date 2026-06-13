import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  BRAIN_DOCUMENT_TYPE_LABELS,
  BRAIN_SOURCE_LABELS,
  BRAIN_STATUS_LABELS,
  BRAIN_VISIBILITY_LABELS,
  createBrainStoreService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { updateBrainDocumentAction } from "../../../../brain-actions";

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
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />}
      sidebar={
        <SidebarSection title="Brain">
          <SidebarNav
            items={[
              { label: "← Brain Store", href: `/worlds/${worldSlug}/brain` },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Brain Store", href: `/worlds/${worldSlug}/brain` },
              { label: document.title },
            ]}
          />
          <PageHeader title={document.title} summary="Brain-Dokument bearbeiten" />

          <form action={updateBrainDocumentAction} className="uwe-brain-edit-form">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="documentId" value={document.id} />

            <label>
              Titel
              <input name="title" defaultValue={document.title} required className="uwe-input" />
            </label>

            <label>
              Inhalt
              <textarea
                name="content"
                defaultValue={document.content}
                className="uwe-input"
                rows={12}
              />
            </label>

            <label>
              Typ
              <select name="documentType" defaultValue={document.documentType} className="uwe-input">
                {Object.entries(BRAIN_DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Sichtbarkeit
              <select name="visibility" defaultValue={document.visibility} className="uwe-input">
                {Object.entries(BRAIN_VISIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select name="status" defaultValue={document.status} className="uwe-input">
                {Object.entries(BRAIN_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <p className="uwe-brain-meta">
              Quelle: {BRAIN_SOURCE_LABELS[document.source]} ·{" "}
              {document.chunks.length} Chunks
              {document.page && (
                <>
                  {" "}
                  · Seite:{" "}
                  <Link href={`/worlds/${worldSlug}/pages/${document.page.slug}`}>
                    {document.page.title}
                  </Link>
                </>
              )}
            </p>

            <button type="submit" className="uwe-btn uwe-btn-primary">
              Speichern
            </button>
          </form>

          {links.length > 0 && (
            <section className="uwe-brain-section">
              <h2>Links</h2>
              <ul>
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
      }
    />
  );
}
