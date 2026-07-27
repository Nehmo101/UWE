import { Suspense } from "react";
import {
  createDocumentTemplateService,
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  DocumentTemplateCategoryEnum,
  type DocumentTemplate,
  type DocumentTemplateCategory,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { familyPrisma } from "@uwe/database/family-client";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui";
import { requireStudioAccess } from "@/src/lib/auth";
import { normalizeTemplateVariables } from "@/src/lib/document-template-utils";
import { DocumentTemplateEditor } from "@/components/documents/DocumentTemplateEditor";
import {
  DocumentGeneratorPanel,
  type DocumentTemplateDto,
} from "@/components/documents/DocumentGeneratorPanel";
import { AdminListSearch } from "@/components/AdminListSearch";
import { matchesAdminListQuery } from "@/src/lib/admin-list-search";
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

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStudioAccess();
  const { q } = await searchParams;

  const service = createDocumentTemplateService(familyPrisma, brainPrisma);
  const templates = await service.listTemplates();
  const filteredTemplates = templates.filter((template) =>
    matchesAdminListQuery(q, [template.name, template.body, template.category]),
  );
  const templateDtos = filteredTemplates.map(toDto);
  const grouped = groupTemplatesByCategory(filteredTemplates);

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Dokumente" }]} />}>
      <PageHeader
        title="Dokumentengenerator"
        summary="Vorlagen für Verträge, Anleitungen und Checklisten — mit Platzhaltern füllen und Text erzeugen."
      />

      <Suspense fallback={null}>
        <AdminListSearch placeholder="Vorlagen nach Name oder Inhalt filtern…" />
      </Suspense>

      {q?.trim() && filteredTemplates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Vorlagen für „{q.trim()}“.</p>
      ) : null}

      <DocumentGeneratorPanel templates={templateDtos} />

      <Card>
        <CardHeader>
          <CardTitle>Neue Vorlage</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentTemplateEditor
            action={createDocumentTemplateAction}
            submitLabel="Vorlage anlegen"
          />
        </CardContent>
      </Card>

      {CATEGORY_ORDER.map((category) => {
        const items = grouped.get(category) ?? [];
        if (items.length === 0) {
          return null;
        }
        return (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              {DOCUMENT_TEMPLATE_CATEGORY_LABELS[category]} ({items.length})
            </h2>
            <div className="flex flex-col gap-2">
              {items.map((template) => (
                <Card key={template.id}>
                  <CardContent className="pt-6">
                    <DocumentTemplateEditor
                      templateId={template.id}
                      name={template.name}
                      category={template.category}
                      body={template.body}
                      action={updateDocumentTemplateAction}
                      submitLabel="Speichern"
                      deleteAction={deleteDocumentTemplateAction}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Vorlagen — lege oben die erste an (z. B. Mietvertrag mit{" "}
          <code>{`{{mieter}}`}</code> und <code>{`{{vermieter}}`}</code>).
        </p>
      ) : null}
    </StudioShell>
  );
}
