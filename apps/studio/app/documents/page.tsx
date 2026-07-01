import {
  createDocumentTemplateService,
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  DocumentTemplateCategoryEnum,
  prisma,
  type DocumentTemplate,
  type DocumentTemplateCategory,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { normalizeTemplateVariables } from "@/src/lib/document-template-utils";
import { DocumentTemplateEditor } from "@/components/documents/DocumentTemplateEditor";
import {
  DocumentGeneratorPanel,
  type DocumentTemplateDto,
} from "@/components/documents/DocumentGeneratorPanel";
import {
  createDocumentTemplateAction,
  deleteDocumentTemplateAction,
  updateDocumentTemplateAction,
} from "../document-actions";

const CATEGORY_ORDER: DocumentTemplateCategory[] = [
  DocumentTemplateCategoryEnum.contract,
  DocumentTemplateCategoryEnum.guide,
  DocumentTemplateCategoryEnum.checklist,
  DocumentTemplateCategoryEnum.other,
];

function toDto(template: DocumentTemplate): DocumentTemplateDto {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    body: template.body,
    variables: normalizeTemplateVariables(template.variables),
  };
}

function groupTemplatesByCategory(
  templates: DocumentTemplate[],
): Map<DocumentTemplateCategory, DocumentTemplate[]> {
  const grouped = new Map<DocumentTemplateCategory, DocumentTemplate[]>();
  for (const category of CATEGORY_ORDER) {
    grouped.set(category, []);
  }
  for (const template of templates) {
    const bucket = grouped.get(template.category) ?? [];
    bucket.push(template);
    grouped.set(template.category, bucket);
  }
  return grouped;
}

export default async function DocumentsPage() {
  await requireStudioAccess();

  const service = createDocumentTemplateService(prisma);
  const templates = await service.listTemplates();
  const templateDtos = templates.map(toDto);
  const grouped = groupTemplatesByCategory(templates);

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Dokumente" }]} />}>
      <PageHeader
        title="Dokumentengenerator"
        summary="Vorlagen für Verträge, Anleitungen und Checklisten — mit Platzhaltern füllen und Text erzeugen."
      />

      <DocumentGeneratorPanel templates={templateDtos} />

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Neue Vorlage</h2>
        <DocumentTemplateEditor
          action={createDocumentTemplateAction}
          submitLabel="Vorlage anlegen"
        />
      </section>

      {CATEGORY_ORDER.map((category) => {
        const items = grouped.get(category) ?? [];
        if (items.length === 0) {
          return null;
        }
        return (
          <section key={category} className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">
              {DOCUMENT_TEMPLATE_CATEGORY_LABELS[category]} ({items.length})
            </h2>
            <div className="uwe-today-card-list">
              {items.map((template) => (
                <article key={template.id} className="uwe-today-card uwe-v2-card-padded">
                  <DocumentTemplateEditor
                    templateId={template.id}
                    name={template.name}
                    category={template.category}
                    body={template.body}
                    action={updateDocumentTemplateAction}
                    submitLabel="Speichern"
                    deleteAction={deleteDocumentTemplateAction}
                  />
                </article>
              ))}
            </div>
          </section>
        );
      })}

      {templates.length === 0 ? (
        <p className="uwe-dashboard-muted">
          Noch keine Vorlagen — lege oben die erste an (z. B. Mietvertrag mit{" "}
          <code>{`{{mieter}}`}</code> und <code>{`{{vermieter}}`}</code>).
        </p>
      ) : null}
    </StudioShell>
  );
}
