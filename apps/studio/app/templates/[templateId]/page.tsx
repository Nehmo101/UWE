import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BLOCK_TYPE_LABELS,
  PAGE_TYPE_LABELS,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import { createPageTemplateService, prisma } from "@uwe/database/server";
import { updateTemplateAction } from "../../template-actions";
import { TemplateEditorClient } from "../TemplateEditorClient";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";

interface Props {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ saved?: string; error?: string; edit?: string }>;
}

export default async function EditTemplatePage({ params, searchParams }: Props) {
  const { templateId } = await params;
  const { saved, error, edit } = await searchParams;

  const template = await createPageTemplateService(prisma).getTemplate(templateId);
  if (!template) notFound();

  const isEditMode = edit === "1";

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
        actions={
          isEditMode ? (
            <Link href={`/templates/${template.id}`} className="uwe-v2-btn uwe-v2-btn-secondary">
              Lesemodus
            </Link>
          ) : (
            <Link href={`/templates/${template.id}?edit=1`} className="uwe-v2-btn uwe-v2-btn-primary">
              Bearbeiten
            </Link>
          )
        }
      />
      {saved && <p className="uwe-inspector-ok" role="status">✓ Gespeichert.</p>}
      {error && <p className="uwe-form-error" role="alert">{error}</p>}

      {isEditMode ? (
        <TemplateEditorClient
          template={template}
          action={updateTemplateAction}
          submitLabel="Template speichern"
        />
      ) : (
        <article className="uwe-v2-card uwe-v2-section">
          <p className="uwe-dashboard-muted">
            {template.description || "Keine Beschreibung"}
            {" · "}
            {PAGE_TYPE_LABELS[template.pageType]}
            {" · "}
            Standard: {VISIBILITY_LABELS[template.defaultVisibility]}
          </p>
          {template.titlePlaceholder ? (
            <p className="uwe-hint">Titel-Platzhalter: {template.titlePlaceholder}</p>
          ) : null}
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Blöcke ({template.blocks.length})</h2>
            {template.blocks.map((block, index) => (
              <section key={index} className="uwe-v2-section">
                <p className="uwe-dashboard-muted">
                  {BLOCK_TYPE_LABELS[block.type]} · {VISIBILITY_LABELS[block.visibility]}
                </p>
                <div style={{ whiteSpace: "pre-wrap" }}>{block.content}</div>
              </section>
            ))}
          </section>
        </article>
      )}
    </StudioShell>
  );
}
