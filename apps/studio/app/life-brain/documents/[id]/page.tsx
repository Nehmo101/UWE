import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  prisma,
} from "@uwe/database/server";
import { LifeBrainDocumentClient } from "@/components/life-brain/LifeBrainDocumentClient";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LifeBrainDocumentDetailPage({ params }: Props) {
  const { id } = await params;
  const service = createLifeAdminService(prisma);
  const detail = await service.getPersonalBrainDocumentDetail(id);

  if (!detail) {
    notFound();
  }

  const { document, tags, linkedCaptures } = detail;

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Persönliches Brain", href: "/life-brain" },
            { label: document.title },
          ]}
        />
      }
    >
      <PageHeader
        title={document.title}
        summary="Life-Brain-Dokument — nur lokal, nicht für Cloud-KI."
        actions={
          <Link href="/life-brain" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
            Zurück zur Suche
          </Link>
        }
      />
      <p className="uwe-form-error" role="note">
        Privates Brain wird nur lokal gespeichert und darf nicht an Cloud-KI gesendet werden.
      </p>

      <LifeBrainDocumentClient
        document={document}
        categoryLabel={
          document.category
            ? (PERSONAL_BRAIN_CATEGORY_LABELS[document.category] ?? document.category)
            : "Allgemein"
        }
        tags={tags}
        linkedCaptures={linkedCaptures}
        captureTypeLabels={CAPTURE_TYPE_LABELS}
      />
    </StudioShell>
  );
}
