import { notFound } from "next/navigation";
import { createPageTemplateService, prisma } from "@uwe/database/server";
import { updateTemplateAction } from "../../template-actions";
import { TemplateForm } from "../TemplateForm";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";

interface Props {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}

export default async function EditTemplatePage({ params, searchParams }: Props) {
  const { templateId } = await params;
  const { saved, error } = await searchParams;

  const template = await createPageTemplateService(prisma).getTemplate(templateId);
  if (!template) notFound();

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Seiten-Templates", href: "/templates" },
            { label: template.name },
          ]}
        />
      }
    >
      <PageHeader
        title={template.name}
        summary={
          template.isSystem
            ? "System-Template — Änderungen wirken auf Quick Create in allen Welten."
            : "Eigenes Template bearbeiten."
        }
      />
      {saved && <p className="uwe-inspector-ok" role="status">✓ Gespeichert.</p>}
      {error && <p className="uwe-form-error" role="alert">{error}</p>}

      <TemplateForm
        template={template}
        action={updateTemplateAction}
        submitLabel="Template speichern"
      />
    </StudioShell>
  );
}
